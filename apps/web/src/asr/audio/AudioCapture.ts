import type { AudioDiagnostics, AudioStats } from '../types'

const TARGET_SAMPLE_RATE = 16000
const FRAME_MS = 60
const SAMPLES_PER_FRAME = (TARGET_SAMPLE_RATE * FRAME_MS) / 1000
const WORKLET_URL = '/asr/pcm-capture-worklet.js'

type AudioCaptureOptions = {
  onPcm: (pcm: Int16Array) => void
  onStats?: (stats: AudioStats) => void
  onEnhancementChunk?: (chunk: EnhancementAudioChunk) => void
  enhancementChunkSeconds?: number
  enhancementOverlapSeconds?: number
  enhancementInitialChunkIndex?: number
  enhancementStartOffsetSeconds?: number
}

export type EnhancementAudioChunk = {
  chunkIndex: number
  startMs: number
  endMs: number
  overlapMs: number
  wavBlob: Blob
}

export class AudioCapture {
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: AudioWorkletNode | null = null
  private monitor: GainNode | null = null
  private pending = new Int16Array()
  private frames: Int16Array[] = []
  private enhancementFrames: Int16Array[] = []
  private enhancementChunkIndex = 0
  private enhancementStartSample = 0
  private totalSamples = 0
  private enhancementOptions: Pick<
    AudioCaptureOptions,
    'onEnhancementChunk' | 'enhancementChunkSeconds' | 'enhancementOverlapSeconds'
  > = {}
  private micFrames = 0
  private lastStats = { rms: 0, peak: 0, clippingRatio: 0 }

  async start(options: AudioCaptureOptions) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持麦克风录音')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    })
    const audioContext = new AudioContext()
    this.enhancementOptions = {
      onEnhancementChunk: options.onEnhancementChunk,
      enhancementChunkSeconds: options.enhancementChunkSeconds,
      enhancementOverlapSeconds: options.enhancementOverlapSeconds,
    }
    this.enhancementChunkIndex = options.enhancementInitialChunkIndex ?? 0
    this.enhancementStartSample = Math.floor((options.enhancementStartOffsetSeconds ?? 0) * TARGET_SAMPLE_RATE)
    this.totalSamples = this.enhancementStartSample
    await audioContext.audioWorklet.addModule(WORKLET_URL)
    await audioContext.resume()

    const source = audioContext.createMediaStreamSource(stream)
    const processor = new AudioWorkletNode(audioContext, 'pcm-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    const monitor = audioContext.createGain()
    monitor.gain.value = 0

    processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const pcm = downsampleToPcm16(event.data, audioContext.sampleRate, TARGET_SAMPLE_RATE)
      this.micFrames += 1
      this.lastStats = measurePcm(pcm)
      options.onStats?.({ ...this.lastStats, micFrames: this.micFrames })
      this.pushPcm(pcm, options.onPcm)
    }

    source.connect(processor)
    processor.connect(monitor)
    monitor.connect(audioContext.destination)

    this.stream = stream
    this.audioContext = audioContext
    this.source = source
    this.processor = processor
    this.monitor = monitor
  }

  exportDiagnostics(extra: Record<string, unknown>): AudioDiagnostics | null {
    const pcm = concatInt16Frames(this.frames)
    if (pcm.length === 0) return null
    const stats = {
      sampleRate: TARGET_SAMPLE_RATE,
      channels: 1,
      frameMs: FRAME_MS,
      samples: pcm.length,
      durationSeconds: pcm.length / TARGET_SAMPLE_RATE,
      micFrames: this.micFrames,
      ...this.lastStats,
      ...extra,
    }
    return {
      wavBlob: new Blob([encodeWav(pcm)], { type: 'audio/wav' }),
      statsBlob: new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' }),
    }
  }

  stop() {
    this.processor?.port.close()
    this.processor?.disconnect()
    this.monitor?.disconnect()
    this.source?.disconnect()
    this.audioContext?.close().catch(() => undefined)
    this.stream?.getTracks().forEach((track) => track.stop())

    this.stream = null
    this.audioContext = null
    this.source = null
    this.processor = null
    this.monitor = null
    this.pending = new Int16Array()
    this.frames = []
    this.enhancementFrames = []
    this.enhancementChunkIndex = 0
    this.enhancementStartSample = 0
    this.totalSamples = 0
    this.enhancementOptions = {}
    this.micFrames = 0
    this.lastStats = { rms: 0, peak: 0, clippingRatio: 0 }
  }

  flushEnhancementChunk() {
    if (!this.enhancementOptions.onEnhancementChunk) return
    const pcm = concatInt16Frames(this.enhancementFrames)
    if (pcm.length < TARGET_SAMPLE_RATE * 2) return
    this.emitEnhancementChunk(pcm)
    this.enhancementFrames = []
  }

  private pushPcm(pcm: Int16Array, onPcm: (pcm: Int16Array) => void) {
    this.pending = concatInt16Arrays(this.pending, pcm)
    while (this.pending.length >= SAMPLES_PER_FRAME) {
      const frame = this.pending.slice(0, SAMPLES_PER_FRAME)
      this.pending = this.pending.slice(SAMPLES_PER_FRAME)
      this.frames.push(frame)
      this.pushEnhancementFrame(frame)
      onPcm(frame)
    }
  }

  private pushEnhancementFrame(frame: Int16Array) {
    const onEnhancementChunk = this.enhancementOptions.onEnhancementChunk
    if (!onEnhancementChunk) {
      this.totalSamples += frame.length
      return
    }

    this.enhancementFrames.push(frame)
    this.totalSamples += frame.length

    const chunkSeconds = this.enhancementOptions.enhancementChunkSeconds ?? 600
    const chunkSamples = Math.max(1, Math.floor(chunkSeconds * TARGET_SAMPLE_RATE))
    const currentSamples = this.totalSamples - this.enhancementStartSample
    if (currentSamples < chunkSamples) return

    const pcm = concatInt16Frames(this.enhancementFrames)
    this.emitEnhancementChunk(pcm)

    const overlapSeconds = this.enhancementOptions.enhancementOverlapSeconds ?? 120
    const overlapSamples = Math.min(pcm.length, Math.floor(overlapSeconds * TARGET_SAMPLE_RATE))
    const retained = overlapSamples > 0 ? pcm.slice(pcm.length - overlapSamples) : new Int16Array()
    this.enhancementFrames = retained.length > 0 ? [retained] : []
    this.enhancementStartSample = this.totalSamples - retained.length
  }

  private emitEnhancementChunk(pcm: Int16Array) {
    const onEnhancementChunk = this.enhancementOptions.onEnhancementChunk
    if (!onEnhancementChunk) return
    const startMs = Math.round((this.enhancementStartSample / TARGET_SAMPLE_RATE) * 1000)
    const endMs = Math.round(((this.enhancementStartSample + pcm.length) / TARGET_SAMPLE_RATE) * 1000)
    const overlapMs = Math.round(((this.enhancementOptions.enhancementOverlapSeconds ?? 120) * 1000))
    onEnhancementChunk({
      chunkIndex: this.enhancementChunkIndex,
      startMs,
      endMs,
      overlapMs,
      wavBlob: new Blob([encodeWav(pcm)], { type: 'audio/wav' }),
    })
    this.enhancementChunkIndex += 1
  }
}

function downsampleToPcm16(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (outputSampleRate === inputSampleRate) return floatToPcm16(input)
  const sampleRateRatio = inputSampleRate / outputSampleRate
  const outputLength = Math.floor(input.length / sampleRateRatio)
  const output = new Int16Array(outputLength)
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * sampleRateRatio)
    const end = Math.min(Math.floor((index + 1) * sampleRateRatio), input.length)
    let sum = 0
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      sum += input[sampleIndex]
    }
    output[index] = clampPcmSample(sum / Math.max(1, end - start))
  }
  return output
}

function floatToPcm16(input: Float32Array) {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    output[index] = clampPcmSample(input[index])
  }
  return output
}

function clampPcmSample(sample: number) {
  const clamped = Math.max(-1, Math.min(1, sample))
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
}

function concatInt16Arrays(left: Int16Array, right: Int16Array) {
  const output = new Int16Array(left.length + right.length)
  output.set(left, 0)
  output.set(right, left.length)
  return output
}

function concatInt16Frames(frames: Int16Array[]) {
  const length = frames.reduce((total, frame) => total + frame.length, 0)
  const output = new Int16Array(length)
  let offset = 0
  for (const frame of frames) {
    output.set(frame, offset)
    offset += frame.length
  }
  return output
}

function measurePcm(pcm: Int16Array) {
  if (pcm.length === 0) return { rms: 0, peak: 0, clippingRatio: 0 }
  let sumSquares = 0
  let peak = 0
  let clipped = 0
  for (const sample of pcm) {
    const normalized = Math.abs(sample) / 32768
    sumSquares += normalized * normalized
    peak = Math.max(peak, normalized)
    if (Math.abs(sample) >= 32760) clipped += 1
  }
  return {
    rms: Math.sqrt(sumSquares / pcm.length),
    peak,
    clippingRatio: clipped / pcm.length,
  }
}

function encodeWav(pcm: Int16Array) {
  const buffer = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  new Int16Array(buffer, 44).set(pcm)
  return buffer
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
