import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useAudioStore } from '../store/audioStore'
import { fftMagnitude, applyHannWindow } from '../utils/fft'

const FFT_SIZE = 4096
const CANVAS_HEIGHT = 180
const MIN_FREQ = 20
const MAX_FREQ = 20000
const DB_MIN = -90
const DB_MAX = 0

/**
 * Compute a single FFT magnitude spectrum (dB) at a given time position.
 */
function computeFFT(buffer: AudioBuffer, timeSec: number): { magnitudes: Float32Array; sampleRate: number } | null {
  const channelData = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const centerSample = Math.floor(timeSec * sampleRate)
  const start = Math.max(0, centerSample - FFT_SIZE / 2)

  if (start + FFT_SIZE > channelData.length) return null

  const frame = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) {
    frame[i] = channelData[start + i]
  }
  applyHannWindow(frame)

  const mags = fftMagnitude(frame)
  const db = new Float32Array(mags.length)
  for (let i = 0; i < mags.length; i++) {
    db[i] = 20 * Math.log10(Math.max(mags[i], 1e-10))
  }
  return { magnitudes: db, sampleRate }
}

function freqToX(freq: number, width: number, margin: number): number {
  const logMin = Math.log10(MIN_FREQ)
  const logMax = Math.log10(MAX_FREQ)
  const logFreq = Math.log10(Math.max(freq, MIN_FREQ))
  return margin + ((logFreq - logMin) / (logMax - logMin)) * (width - margin * 2)
}

function dbToY(db: number, height: number, marginTop: number, marginBottom: number): number {
  const plotHeight = height - marginTop - marginBottom
  const normalized = Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)))
  return marginTop + plotHeight * (1 - normalized)
}

export default function FFTDisplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const outputBuffer = useAudioStore((state) => state.outputBuffer)
  const audioBuffer = useAudioStore((state) => state.audioBuffer)
  const spectrogramEnabled = useAudioStore((state) => state.spectrogramEnabled)
  const setSpectrogramEnabled = useAudioStore((state) => state.setSpectrogramEnabled)
  const showCleanSignal = useAudioStore((state) => state.showCleanSignal)

  // Compute FFT at midpoint of buffer
  const wetFFT = useMemo(() => {
    if (!outputBuffer || !spectrogramEnabled) return null
    const midTime = outputBuffer.duration / 2
    return computeFFT(outputBuffer, midTime)
  }, [outputBuffer, spectrogramEnabled])

  const cleanFFT = useMemo(() => {
    if (!audioBuffer || !spectrogramEnabled || !showCleanSignal) return null
    const midTime = audioBuffer.duration / 2
    return computeFFT(audioBuffer, midTime)
  }, [audioBuffer, spectrogramEnabled, showCleanSignal])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = rect.width
    const height = CANVAS_HEIGHT

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const ML = 40 // margin left
    const MR = 12
    const MT = 12
    const MB = 24

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, width, height)

    // Plot area background
    ctx.fillStyle = '#161b22'
    ctx.fillRect(ML, MT, width - ML - MR, height - MT - MB)

    // Grid lines — horizontal (dB)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.font = '9px "IBM Plex Mono", monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.textAlign = 'right'
    for (let db = DB_MIN; db <= DB_MAX; db += 10) {
      const y = dbToY(db, height, MT, MB)
      ctx.beginPath()
      ctx.moveTo(ML, y)
      ctx.lineTo(width - MR, y)
      ctx.stroke()
      ctx.fillText(`${db}`, ML - 4, y + 3)
    }

    // Grid lines — vertical (frequency)
    ctx.textAlign = 'center'
    const freqTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
    for (const freq of freqTicks) {
      const x = freqToX(freq, width, ML)
      if (x < ML || x > width - MR) continue
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.moveTo(x, MT)
      ctx.lineTo(x, height - MB)
      ctx.stroke()
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillText(label, x, height - MB + 14)
    }

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '8px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Hz', width / 2, height - 2)
    ctx.save()
    ctx.translate(8, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('dB', 0, 0)
    ctx.restore()

    // Draw FFT curve helper
    const drawFFTCurve = (fftData: { magnitudes: Float32Array; sampleRate: number }, color: string, alpha: number) => {
      const { magnitudes, sampleRate } = fftData
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = alpha
      ctx.beginPath()
      let started = false
      for (let bin = 1; bin < magnitudes.length; bin++) {
        const freq = (bin * sampleRate) / FFT_SIZE
        if (freq < MIN_FREQ || freq > MAX_FREQ) continue
        const x = freqToX(freq, width, ML)
        const y = dbToY(magnitudes[bin], height, MT, MB)
        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Draw clean signal (ghosted)
    if (cleanFFT) {
      drawFFTCurve(cleanFFT, 'rgba(100, 160, 255, 0.6)', 0.5)
    }

    // Draw wet signal
    if (wetFFT) {
      drawFFTCurve(wetFFT, 'rgb(0, 255, 65)', 0.85)
    }

    // Legend
    if (wetFFT) {
      ctx.font = '9px "IBM Plex Mono", monospace'
      ctx.fillStyle = 'rgb(0, 255, 65)'
      ctx.textAlign = 'left'
      ctx.fillText('WET', ML + 8, MT + 14)
      if (cleanFFT) {
        ctx.fillStyle = 'rgba(100, 160, 255, 0.8)'
        ctx.fillText('DRY', ML + 40, MT + 14)
      }
    }

    // Plot border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(ML, MT, width - ML - MR, height - MT - MB)
  }, [wetFFT, cleanFFT])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  if (!outputBuffer) return null

  return (
    <div className="fft-section">
      <div className="viz-card-header">
        <h3 className="viz-card-title">FFT Spectrum</h3>
        <button
          type="button"
          className={`pill-btn ${spectrogramEnabled ? 'pill-btn-active' : ''}`}
          onClick={() => setSpectrogramEnabled(!spectrogramEnabled)}
        >
          {spectrogramEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
      {spectrogramEnabled && (
        <div ref={containerRef} className="fft-canvas-container">
          <canvas ref={canvasRef} className="fft-canvas" />
        </div>
      )}
    </div>
  )
}
