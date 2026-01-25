import { useEffect, useRef } from 'react'
import type { IOMode } from '../fv1/types'
import { playbackManager } from '../audio/playbackManager'
import { usePlaybackStore } from '../store/playbackStore'

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null
  ioMode: IOMode
  playheadTime?: number
}

export default function WaveformDisplay({ 
  audioBuffer, 
  ioMode, 
  playheadTime 
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !audioBuffer) return

    // Set canvas resolution to match device pixel ratio (prevents blurriness)
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale context to match device pixel ratio
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const halfHeight = height / 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw center line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, halfHeight)
    ctx.lineTo(width, halfHeight)
    ctx.stroke()

    // Get channel data
    const channels = audioBuffer.numberOfChannels
    const leftChannel = audioBuffer.getChannelData(0)
    const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : leftChannel

    // Sample every Nth sample based on canvas width
    const samplesPerPixel = Math.max(1, Math.floor(leftChannel.length / width))

    // Draw waveforms
    if (ioMode === 'stereo_stereo' && channels > 1) {
      // Draw left channel (blue)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel)
        const sample = leftChannel[sampleIndex]
        const y = halfHeight - (sample * halfHeight * 0.9)
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Draw right channel (orange)
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel)
        const sample = rightChannel[sampleIndex]
        const y = halfHeight - (sample * halfHeight * 0.9)
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    } else {
      // Draw mono waveform (blue)
      ctx.strokeStyle = 'rgb(59, 130, 246)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel)
        const sample = leftChannel[sampleIndex]
        const y = halfHeight - (sample * halfHeight * 0.9)
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    // Draw playhead cursor
    if (playheadTime !== undefined && audioBuffer.duration > 0) {
      const x = (playheadTime / audioBuffer.duration) * width
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }, [audioBuffer, ioMode, playheadTime])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Trigger re-render by forcing update
      if (canvasRef.current && containerRef.current && audioBuffer) {
        const rect = containerRef.current.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvasRef.current.width = rect.width * dpr
        canvasRef.current.height = rect.height * dpr
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [audioBuffer])

  const setPlayheadTime = usePlaybackStore((state) => state.setPlayheadTime)

  // Handle waveform click-to-seek
  const handleWaveformClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const clickRatio = x / rect.width
    const seekTime = Math.max(0, Math.min(clickRatio * audioBuffer.duration, audioBuffer.duration))
    
    playbackManager.seek(seekTime)
    setPlayheadTime(seekTime)
  }

  if (!audioBuffer) {
    return (
      <div className="waveform-placeholder">
        <p>Waveform will appear after rendering</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="waveform-container">
      <canvas 
        ref={canvasRef} 
        className="waveform-canvas" 
        onClick={handleWaveformClick}
        style={{ cursor: 'pointer' }}
      />
    </div>
  )
}
