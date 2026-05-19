import type { AsrEvent, AsrEventListener } from '../types'

type BrowserSpeechRecognitionAlternative = {
  transcript: string
  confidence: number
}

type BrowserSpeechRecognitionResult = {
  isFinal: boolean
  length: number
  0?: BrowserSpeechRecognitionAlternative
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: {
    length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

type BrowserSpeechRecognitionErrorEvent = {
  error: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }

export class BrowserSpeechProvider {
  private recognition: BrowserSpeechRecognition | null = null
  private listeners = new Set<AsrEventListener>()
  private shouldRestart = false

  onEvent(listener: AsrEventListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start() {
    const Recognition = (window as SpeechRecognitionWindow).SpeechRecognition ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition
    if (!Recognition) throw new Error('当前浏览器不支持实时语音识别，请使用 Chrome 或 Edge')

    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'zh-CN'
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0]?.transcript.trim() ?? ''
        if (!text) continue
        this.emit({ type: result.isFinal ? 'final' : 'partial', text, speaker: 'Speaker 1' })
      }
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      this.shouldRestart = false
      this.emit({ type: 'error', message: event.error === 'not-allowed' ? '浏览器未授权麦克风，无法录音' : `语音识别失败：${event.error}` })
    }
    recognition.onend = () => {
      if (!this.shouldRestart) return
      try {
        recognition.start()
      } catch {
        this.shouldRestart = false
      }
    }

    this.recognition = recognition
    this.shouldRestart = true
    recognition.start()
    this.emit({ type: 'status', message: '正在使用浏览器实时语音识别' })
  }

  stop() {
    this.shouldRestart = false
    this.recognition?.stop()
    this.recognition = null
  }

  private emit(event: AsrEvent) {
    for (const listener of this.listeners) listener(event)
  }
}
