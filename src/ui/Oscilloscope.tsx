import { useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '../store/audioStore'
import { usePlaybackStore } from '../store/playbackStore'
import { playbackManager } from '../audio/playbackManager'
import LoopRegion from './LoopRegion'

const ML = 40 // margin left
const MR = 12
const MT = 12
const MB = 24

export default function Oscilloscope() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number | null>(null)

  const outputBuffer = useAudioStore((state) => state.outputBuffer)
  const audioBuffer = useAudioStore((state) => state.audioBuffer)
  const channel = useAudioStore((state) => state.oscilloscopeChannel)
  const setChannel = useAudioStore((state) => state.setOscilloscopeChannel)
  const timeScale = useAudioStore((state) => state.oscilloscopeTimeScale)
  const setTimeScale = useAudioStore((state) => state.setOscilloscopeTimeScale)
  const showCleanSignal = useAudioStore((state) => state.showCleanSignal)
  const setShowCleanSignal = useAudioStore((state) => state.setShowCleanSignal)

  const { isPlaying, playheadTime, setPlayheadTime } = usePlaybackStore()

  const draw = useCallback((forcePlayhead?: number) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !outputBuffer) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const plotLeft = ML
    const plotRight = width - MR
    const plotTop = MT
    const plotBottom = height - MB
    const plotWidth = plotRight - plotLeft
    const plotHeight = plotBottom - plotTop
    const halfPlot = plotTop + plotHeight / 2

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, width, height)

    // Plot area
    ctx.fillStyle = '#161b22'
    ctx.fillRect(plotLeft, plotTop, plotWidth, plotHeight)

    // Grid — horizontal (amplitude)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.font = '9px "IBM Plex Mono", monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.textAlign = 'right'
    const ampTicks = [-1, -0.5, 0, 0.5, 1]
    for (const amp of ampTicks) {
      const y = halfPlot - (amp * plotHeight / 2 * 0.9)
      ctx.beginPath()
      ctx.moveTo(plotLeft, y)
      ctx.lineTo(plotRight, y)
      ctx.stroke()
      ctx.fillText(amp.toFixed(1), plotLeft - 4, y + 3)
    }

    const sampleRate = outputBuffer.sampleRate
    const duration = outputBuffer.duration
    const currentPlayhead = forcePlayhead ?? playheadTime

    // Determine visible window
    let windowStart: number
    let windowEnd: number

    if (isPlaying && timeScale < duration) {
      windowStart = Math.max(0, currentPlayhead - timeScale / 2)
      windowEnd = windowStart + timeScale
      if (windowEnd > duration) {
        windowEnd = duration
        windowStart = Math.max(0, windowEnd - timeScale)
      }
    } else {
      if (timeScale >= duration) {
        windowStart = 0
        windowEnd = duration
      } else {
        windowStart = Math.max(0, currentPlayhead - timeScale / 2)
        windowEnd = windowStart + timeScale
        if (windowEnd > duration) {
          windowEnd = duration
          windowStart = Math.max(0, windowEnd - timeScale)
        }
      }
    }

    // Time axis ticks
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    const windowDuration = windowEnd - windowStart
    const tickInterval = windowDuration > 5 ? 1 : windowDuration > 1 ? 0.5 : windowDuration > 0.5 ? 0.1 : 0.05
    const firstTick = Math.ceil(windowStart / tickInterval) * tickInterval
    for (let t = firstTick; t <= windowEnd; t += tickInterval) {
      const x = plotLeft + ((t - windowStart) / windowDuration) * plotWidth
      if (x < plotLeft || x > plotRight) continue
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.moveTo(x, plotTop)
      ctx.lineTo(x, plotBottom)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText(`${t.toFixed(t < 1 ? 2 : 1)}s`, x, plotBottom + 14)
    }

    const startSample = Math.floor(windowStart * sampleRate)
    const endSample = Math.min(Math.floor(windowEnd * sampleRate), outputBuffer.length)
    const sampleCount = endSample - startSample

    const channels = outputBuffer.numberOfChannels
    const leftData = outputBuffer.getChannelData(0)
    const rightData = channels > 1 ? outputBuffer.getChannelData(1) : leftData

    const drawChannel = (data: Float32Array, startS: number, sCount: number, color: string, alpha: number) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = alpha
      ctx.beginPath()
      const samplesPerPixel = Math.max(1, Math.floor(sCount / plotWidth))
      for (let px = 0; px < plotWidth; px++) {
        const sampleIdx = startS + Math.floor((px / plotWidth) * sCount)
        let min = 1
        let max = -1
        for (let s = 0; s < samplesPerPixel && sampleIdx + s < data.length; s++) {
          const val = data[sampleIdx + s]
          if (val < min) min = val
          if (val > max) max = val
        }
        const avg = (min + max) / 2
        const x = plotLeft + px
        const y = halfPlot - (avg * plotHeight / 2 * 0.9)
        if (px === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Draw clean signal (ghosted) if enabled
    if (showCleanSignal && audioBuffer) {
      const cleanLeft = audioBuffer.getChannelData(0)
      const cleanRight = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : cleanLeft
      const cleanSampleRate = audioBuffer.sampleRate
      const cleanStartSample = Math.floor(windowStart * cleanSampleRate)
      const cleanEndSample = Math.min(Math.floor(windowEnd * cleanSampleRate), audioBuffer.length)
      const cleanSampleCount = cleanEndSample - cleanStartSample

      if (channel === 'both' && audioBuffer.numberOfChannels > 1) {
        drawChannel(cleanLeft, cleanStartSample, cleanSampleCount, 'rgba(100, 160, 255, 0.5)', 0.4)
        drawChannel(cleanRight, cleanStartSample, cleanSampleCount, 'rgba(255, 140, 100, 0.5)', 0.4)
      } else if (channel === 'right' && audioBuffer.numberOfChannels > 1) {
        drawChannel(cleanRight, cleanStartSample, cleanSampleCount, 'rgba(100, 160, 255, 0.5)', 0.4)
      } else {
        drawChannel(cleanLeft, cleanStartSample, cleanSampleCount, 'rgba(100, 160, 255, 0.5)', 0.4)
      }
    }

    // Draw wet channels
    if (channel === 'both' && channels > 1) {
      drawChannel(leftData, startSample, sampleCount, 'rgb(0, 255, 65)', 0.85)
      drawChannel(rightData, startSample, sampleCount, 'rgba(0, 180, 255, 0.7)', 0.85)
    } else if (channel === 'right' && channels > 1) {
      drawChannel(rightData, startSample, sampleCount, 'rgb(0, 255, 65)', 0.85)
    } else {
      drawChannel(leftData, startSample, sampleCount, 'rgb(0, 255, 65)', 0.85)
    }

    // Draw playhead
    if (currentPlayhead >= windowStart && currentPlayhead <= windowEnd) {
      const x = plotLeft + ((currentPlayhead - windowStart) / (windowEnd - windowStart)) * plotWidth
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, plotTop)
      ctx.lineTo(x, plotBottom)
      ctx.stroke()
    }

    // Plot border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(plotLeft, plotTop, plotWidth, plotHeight)

    // Legend
    ctx.font = '9px "IBM Plex Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgb(0, 255, 65)'
    ctx.fillText('WET', plotLeft + 6, plotTop + 14)
    if (showCleanSignal && audioBuffer) {
      ctx.fillStyle = 'rgba(100, 160, 255, 0.8)'
      ctx.fillText('DRY', plotLeft + 36, plotTop + 14)
    }
  }, [outputBuffer, audioBuffer, channel, timeScale, playheadTime, isPlaying, showCleanSignal])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    if (!isPlaying || !outputBuffer) return
    const animate = () => {
      draw(playbackManager.getCurrentTime())
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isPlaying, outputBuffer, draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!outputBuffer || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const duration = outputBuffer.duration

    // Map click x to time within visible window
    const plotWidth = rect.width - ML - MR
    const clickInPlot = x - ML
    if (clickInPlot < 0 || clickInPlot > plotWidth) return
    const ratio = clickInPlot / plotWidth

    let windowStart: number
    let windowEnd: number
    if (timeScale >= duration) {
      windowStart = 0; windowEnd = duration
    } else {
      windowStart = Math.max(0, playheadTime - timeScale / 2)
      windowEnd = windowStart + timeScale
      if (windowEnd > duration) { windowEnd = duration; windowStart = Math.max(0, windowEnd - timeScale) }
    }

    const seekTime = Math.max(0, Math.min(windowStart + ratio * (windowEnd - windowStart), duration))
    playbackManager.seek(seekTime)
    setPlayheadTime(seekTime)
  }

  const adjustTimeScale = (factor: number) => {
    const duration = outputBuffer?.duration ?? 10
    setTimeScale(Math.min(duration, timeScale * factor))
  }

  const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 0
  const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 0

  if (!outputBuffer) {
    return (
      <div className="oscilloscope-section">
        <h3 className="viz-card-title">Oscilloscope</h3>
        <div className="oscilloscope-empty">
          <p>Render to view waveform</p>
        </div>
      </div>
    )
  }

  return (
    <div className="oscilloscope-section">
      <div className="viz-card-header">
        <h3 className="viz-card-title">Oscilloscope</h3>
        <div className="oscilloscope-controls">
          <button
            type="button"
            className={`pill-btn ${showCleanSignal ? 'pill-btn-active' : ''}`}
            onClick={() => setShowCleanSignal(!showCleanSignal)}
            title={showCleanSignal ? 'Hide clean signal overlay' : 'Show clean signal overlay'}
          >
            {showCleanSignal ? 'Dry: On' : 'Dry: Off'}
          </button>
          <div className="pill-group">
            {(['left', 'right', 'both'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                className={`pill-btn ${channel === ch ? 'pill-btn-active' : ''}`}
                onClick={() => setChannel(ch)}
              >
                {ch === 'left' ? 'Left' : ch === 'right' ? 'Right' : 'Both'}
              </button>
            ))}
          </div>
          <div className="time-scale-controls">
            <button type="button" className="scale-btn" onClick={() => adjustTimeScale(0.5)} title="Zoom in">-</button>
            <button
              type="button"
              className="scale-btn"
              onClick={() => setTimeScale(outputBuffer.duration)}
              title="Reset to full"
            >
              {timeScale >= outputBuffer.duration ? 'Full' : `${timeScale.toFixed(1)}s`}
            </button>
            <button type="button" className="scale-btn" onClick={() => adjustTimeScale(2)} title="Zoom out">+</button>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="oscilloscope-canvas-container">
        <canvas
          ref={canvasRef}
          className="oscilloscope-canvas"
          onClick={handleClick}
          style={{ cursor: 'crosshair' }}
        />
        {containerWidth > 0 && containerHeight > 0 && (
          <LoopRegion
            duration={outputBuffer.duration}
            width={containerWidth}
            height={containerHeight}
          />
        )}
      </div>
    </div>
  )
}
