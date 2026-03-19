/**
 * Pure JS radix-2 FFT (Cooley-Tukey, in-place, iterative)
 * No external dependencies.
 */

/**
 * Compute FFT of a real-valued signal.
 * @param input - Real-valued samples (length must be power of 2)
 * @returns Magnitude spectrum (length N/2 + 1)
 */
export function fftMagnitude(input: Float32Array): Float32Array {
  const N = input.length
  // Pad/truncate to power of 2
  const n = nextPow2(N)

  // Interleaved complex: [re0, im0, re1, im1, ...]
  const buf = new Float32Array(n * 2)
  for (let i = 0; i < Math.min(N, n); i++) {
    buf[i * 2] = input[i]
  }

  fftInPlace(buf, n)

  // Compute magnitudes for bins 0..N/2
  const out = new Float32Array(n / 2 + 1)
  for (let i = 0; i <= n / 2; i++) {
    const re = buf[i * 2]
    const im = buf[i * 2 + 1]
    out[i] = Math.sqrt(re * re + im * im) / n
  }
  return out
}

/**
 * In-place iterative FFT on interleaved complex data.
 */
function fftInPlace(buf: Float32Array, n: number): void {
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
    j ^= bit

    if (i < j) {
      // Swap complex values
      let t = buf[i * 2]; buf[i * 2] = buf[j * 2]; buf[j * 2] = t
      t = buf[i * 2 + 1]; buf[i * 2 + 1] = buf[j * 2 + 1]; buf[j * 2 + 1] = t
    }
  }

  // Butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2
    const angleStep = -2 * Math.PI / size

    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const angle = angleStep * j
        const twRe = Math.cos(angle)
        const twIm = Math.sin(angle)

        const evenIdx = (i + j) * 2
        const oddIdx = (i + j + halfSize) * 2

        const tRe = twRe * buf[oddIdx] - twIm * buf[oddIdx + 1]
        const tIm = twRe * buf[oddIdx + 1] + twIm * buf[oddIdx]

        buf[oddIdx] = buf[evenIdx] - tRe
        buf[oddIdx + 1] = buf[evenIdx + 1] - tIm
        buf[evenIdx] += tRe
        buf[evenIdx + 1] += tIm
      }
    }
  }
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Apply a Hann window to a signal buffer in place.
 */
export function applyHannWindow(buf: Float32Array): void {
  const n = buf.length
  for (let i = 0; i < n; i++) {
    buf[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)))
  }
}
