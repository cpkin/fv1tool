/**
 * Audio Simulation Metrics
 * 
 * Captures metrics from rendered audio buffers for validation
 * against expected baselines.
 */

export interface AudioMetrics {
  peak: number
  rms: number
  hasNaN: boolean
  hasInfinity: boolean
  channelCount: number
  sampleRate: number
  duration: number
}

/**
 * Compute audio metrics from an AudioBuffer
 */
export function computeAudioMetrics(buffer: AudioBuffer): AudioMetrics {
  let peak = 0
  let sumSquares = 0
  let sampleCount = 0
  let hasNaN = false
  let hasInfinity = false
  
  // Analyze all channels
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const channelData = buffer.getChannelData(ch)
    
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i]
      
      if (isNaN(sample)) {
        hasNaN = true
      }
      if (!isFinite(sample)) {
        hasInfinity = true
      }
      
      const absSample = Math.abs(sample)
      if (absSample > peak) {
        peak = absSample
      }
      
      sumSquares += sample * sample
      sampleCount++
    }
  }
  
  const rms = Math.sqrt(sumSquares / sampleCount)
  
  return {
    peak,
    rms,
    hasNaN,
    hasInfinity,
    channelCount: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    duration: buffer.duration,
  }
}

/**
 * Compare metrics against expected values with tolerance
 */
export interface MetricsComparison {
  pass: boolean
  errors: string[]
}

export function compareMetrics(
  actual: AudioMetrics,
  expected: Partial<AudioMetrics>,
  tolerance: { peak?: number; rms?: number } = {}
): MetricsComparison {
  const errors: string[] = []
  
  // Check for invalid values
  if (actual.hasNaN) {
    errors.push('Output contains NaN values')
  }
  if (actual.hasInfinity) {
    errors.push('Output contains Infinity values')
  }
  
  // Check peak if specified
  if (expected.peak !== undefined) {
    const peakTolerance = tolerance.peak ?? 0.01
    const diff = Math.abs(actual.peak - expected.peak)
    if (diff > peakTolerance) {
      errors.push(`Peak mismatch: expected ${expected.peak.toFixed(4)}, got ${actual.peak.toFixed(4)} (diff: ${diff.toFixed(4)})`)
    }
  }
  
  // Check RMS if specified
  if (expected.rms !== undefined) {
    const rmsTolerance = tolerance.rms ?? 0.01
    const diff = Math.abs(actual.rms - expected.rms)
    if (diff > rmsTolerance) {
      errors.push(`RMS mismatch: expected ${expected.rms.toFixed(4)}, got ${actual.rms.toFixed(4)} (diff: ${diff.toFixed(4)})`)
    }
  }
  
  // Check channel count
  if (expected.channelCount !== undefined && actual.channelCount !== expected.channelCount) {
    errors.push(`Channel count mismatch: expected ${expected.channelCount}, got ${actual.channelCount}`)
  }
  
  return {
    pass: errors.length === 0,
    errors,
  }
}
