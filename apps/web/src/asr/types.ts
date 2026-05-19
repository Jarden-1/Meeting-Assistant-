export type AsrEvent =
  | {
      type: 'partial'
      text: string
      speaker: string
    }
  | {
      type: 'final'
      text: string
      speaker: string
    }
  | {
      type: 'status'
      message: string
    }
  | {
      type: 'stats'
      sentBytes?: number
      receivedMessages?: number
      micFrames?: number
      rms?: number
      peak?: number
      clippingRatio?: number
    }
  | {
      type: 'error'
      message: string
    }

export type AsrEventListener = (event: AsrEvent) => void

export type AudioStats = {
  micFrames: number
  rms: number
  peak: number
  clippingRatio: number
}

export type AudioDiagnostics = {
  wavBlob: Blob
  statsBlob: Blob
}
