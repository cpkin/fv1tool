/**
 * WAV file encoding utilities for exporting rendered audio
 */

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * Encode an AudioBuffer to WAV file format
 * 
 * @param buffer - The AudioBuffer to encode
 * @returns Blob containing WAV file data
 */
export function encodeWAV(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8

  // Interleave channels into single Float32Array
  const interleaved = new Float32Array(length * channels)
  for (let channel = 0; channel < channels; channel++) {
    const channelData = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      interleaved[i * channels + channel] = channelData[i]
    }
  }

  // Convert float32 (-1 to 1) to int16
  const samples = new Int16Array(interleaved.length)
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]))
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Build WAV header
  const dataSize = samples.length * bytesPerSample
  const bufferSize = 44 + dataSize
  const view = new DataView(new ArrayBuffer(bufferSize))

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, bufferSize - 8, true)
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * bytesPerSample, true) // byte rate
  view.setUint16(32, channels * bytesPerSample, true) // block align
  view.setUint16(34, bitsPerSample, true)

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write samples
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true)
    offset += 2
  }

  return new Blob([view], { type: 'audio/wav' })
}

/**
 * Download an AudioBuffer as a WAV file
 * 
 * @param buffer - The AudioBuffer to download
 * @param filename - The filename for the download
 */
export function downloadWAV(buffer: AudioBuffer, filename: string): void {
  const blob = encodeWAV(buffer)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download text content as a file
 * 
 * @param content - The text content to download
 * @param filename - The filename for the download
 * @param mimeType - The MIME type for the file
 */
export function downloadText(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Calculate the estimated file size for a WAV export
 * 
 * @param buffer - The AudioBuffer to estimate
 * @returns Human-readable file size string
 */
export function estimateWAVSize(buffer: AudioBuffer): string {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  const bytesPerSample = 2 // 16-bit
  const dataSize = length * channels * bytesPerSample
  const totalSize = 44 + dataSize // header + data

  if (totalSize < 1024) {
    return `${totalSize} B`
  } else if (totalSize < 1024 * 1024) {
    return `${(totalSize / 1024).toFixed(1)} KB`
  } else {
    return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
  }
}
