import type { AsrEvent, AsrEventListener } from '../types'

const SAMPLE_RATE = 16000
const CHUNK_SIZE = [5, 10, 5]
const CHUNK_INTERVAL = 10
const FINAL_FLUSH_WAIT_MS = 5000

type FunAsrProviderOptions = {
  wsUrl: string
  sessionId: string
}

type FunAsrMessage = {
  mode?: string
  text?: string
  wav_name?: string
  is_final?: boolean
  spk_name?: string
  spk_score?: number
  speaker?: string | number
  speaker_id?: string | number
  spk?: string | number
  spk_id?: string | number
  sentence_info?: FunAsrSentence[]
  sentences?: FunAsrSentence[]
}

type FunAsrSentence = {
  text?: string
  voice_text_str?: string
  speaker?: string | number
  speaker_id?: string | number
  spk?: string | number
  spk_id?: string | number
}

export class FunAsrProvider {
  private socket: WebSocket | null = null
  private listeners = new Set<AsrEventListener>()
  private receivedMessages = 0
  private sentBytes = 0
  private finalizedKeys = new Set<string>()
  private closeTimer: number | null = null

  onEvent(listener: AsrEventListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(options: FunAsrProviderOptions) {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer)
      this.closeTimer = null
    }

    const socket = new WebSocket(options.wsUrl, 'binary')
    socket.binaryType = 'arraybuffer'
    this.emit({ type: 'status', message: '正在连接本地 FunASR' })

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`连接本地 FunASR 超时：${options.wsUrl}`)), 5000)
      socket.onopen = () => {
        window.clearTimeout(timer)
        resolve()
      }
      socket.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error(`无法连接本地 FunASR：${options.wsUrl}`))
      }
      socket.onclose = () => {
        window.clearTimeout(timer)
        reject(new Error(`本地 FunASR 连接已关闭：${options.wsUrl}`))
      }
    })

    this.socket = socket
    this.receivedMessages = 0
    this.sentBytes = 0
    this.finalizedKeys = new Set()

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      this.receivedMessages += 1
      this.emitStats()
      try {
        this.handleMessage(JSON.parse(event.data) as FunAsrMessage)
      } catch {
        this.emit({ type: 'error', message: 'FunASR 返回了无法解析的结果' })
      }
    }
    socket.onerror = () => this.emit({ type: 'error', message: 'FunASR WebSocket 出错' })
    socket.onclose = () => {
      if (this.closeTimer !== null) {
        window.clearTimeout(this.closeTimer)
        this.closeTimer = null
      }
      if (this.socket === socket) this.socket = null
      this.emit({ type: 'status', message: 'FunASR 连接已关闭' })
    }

    socket.send(
      JSON.stringify({
        mode: 'offline',
        wav_name: `meeting-${options.sessionId}-${Date.now()}`,
        wav_format: 'pcm',
        audio_fs: SAMPLE_RATE,
        is_speaking: true,
        chunk_size: CHUNK_SIZE,
        chunk_interval: CHUNK_INTERVAL,
        itn: true,
      }),
    )
    this.emit({ type: 'status', message: 'FunASR 已连接，正在发送音频；句末输出稳定转写' })
  }

  pushAudio(pcm: Int16Array) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    const payload = new ArrayBuffer(pcm.byteLength)
    new Int16Array(payload).set(pcm)
    this.socket.send(payload)
    this.sentBytes += pcm.byteLength
    this.emitStats()
  }

  stop() {
    const socket = this.socket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ is_speaking: false }))
      this.emit({ type: 'status', message: '正在等待 FunASR 输出最后一段稳定转写' })
      this.closeTimer = window.setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) socket.close()
        if (this.socket === socket) this.socket = null
        this.closeTimer = null
      }, FINAL_FLUSH_WAIT_MS)
      return
    }
    this.socket = null
  }

  private handleMessage(message: FunAsrMessage) {
    const text = normalizeFunAsrText(stringFromUnknown(message.text))
    if (!text) {
      this.emit({ type: 'status', message: 'FunASR 已返回消息' })
      return
    }

    const mode = message.mode ?? ''
    const final = message.is_final === true || mode.includes('offline')
    if (!final) {
      this.emit({ type: 'status', message: 'FunASR 正在接收音频，等待稳定转写结果' })
      return
    }

    const key = `${message.wav_name ?? 'funasr'}:${text}`
    if (this.finalizedKeys.has(key)) return
    this.finalizedKeys.add(key)

    for (const part of getFunAsrTranscriptParts(message, text)) {
      this.emit({ type: 'final', text: part.text, speaker: part.speaker })
    }
    this.emit({ type: 'status', message: '已收到 FunASR 稳定转写结果' })
  }

  private emitStats() {
    this.emit({ type: 'stats', sentBytes: this.sentBytes, receivedMessages: this.receivedMessages })
  }

  private emit(event: AsrEvent) {
    for (const listener of this.listeners) listener(event)
  }
}

function getFunAsrTranscriptParts(message: FunAsrMessage, fallbackText: string) {
  const sentenceParts = (message.sentence_info ?? message.sentences ?? [])
    .map((sentence) => ({
      speaker: resolveSpeakerLabel(sentence.speaker, sentence.speaker_id, sentence.spk, sentence.spk_id, getFunAsrSpeaker(message)),
      text: normalizeFunAsrText(stringFromUnknown(sentence.text) || stringFromUnknown(sentence.voice_text_str)),
    }))
    .filter((part) => part.text)

  return sentenceParts.length ? sentenceParts : [{ speaker: getFunAsrSpeaker(message), text: fallbackText }]
}

function getFunAsrSpeaker(message: FunAsrMessage) {
  if (message.spk_name && message.spk_name !== 'unknown' && (message.spk_score ?? 0) >= 0.2) {
    return message.spk_name
  }
  return resolveSpeakerLabel(message.speaker, message.speaker_id, message.spk, message.spk_id, 'Speaker 1')
}

function resolveSpeakerLabel(...values: Array<string | number | undefined>) {
  const value = values.find((item) => item !== undefined && String(item).trim() !== '')
  if (value === undefined) return 'Speaker 1'
  const raw = String(value).trim()
  if (/^speaker\s*\d+$/i.test(raw)) return raw.replace(/^speaker\s*/i, 'Speaker ')
  if (/^\d+$/.test(raw)) return `Speaker ${raw}`
  return raw
}

function normalizeFunAsrText(text: string) {
  return text
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
    .replace(/\s+([，。！？、；：])/g, '$1')
    .replace(/([，。！？、；：])\s+/g, '$1')
    .trim()
}

function stringFromUnknown(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
