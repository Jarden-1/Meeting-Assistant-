class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0]?.[0]
    const output = outputs[0]?.[0]
    if (input) {
      this.port.postMessage(new Float32Array(input))
      if (output) output.set(input)
    } else if (output) {
      output.fill(0)
    }
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
