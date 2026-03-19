import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useAudioStore } from '../store/audioStore'
import { analyzeDelayAccess } from '../utils/delayAnalysis'

const CANVAS_HEIGHT = 90
const MAX_ADDRESS = 0x7FFF
const ML = 40 // margin left
const MR = 12
const MT = 8
const MB = 20

export default function DelayMemoryMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const cachedInstructions = useAudioStore((state) => state.cachedInstructions)

  const delayRecords = useMemo(() => {
    if (!cachedInstructions) return []
    return analyzeDelayAccess(cachedInstructions)
  }, [cachedInstructions])

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

    const plotWidth = width - ML - MR
    const plotHeight = height - MT - MB

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, width, height)

    // Plot area
    ctx.fillStyle = '#161b22'
    ctx.fillRect(ML, MT, plotWidth, plotHeight)

    // Address axis ticks
    ctx.font = '9px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    const addrTicks = [0x0000, 0x1000, 0x2000, 0x3000, 0x4000, 0x5000, 0x6000, 0x7000, 0x7FFF]
    for (const addr of addrTicks) {
      const x = ML + (addr / MAX_ADDRESS) * plotWidth
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, MT)
      ctx.lineTo(x, MT + plotHeight)
      ctx.stroke()
      if (addr === 0 || addr === 0x4000 || addr === 0x7FFF) {
        ctx.fillText(`0x${addr.toString(16).toUpperCase().padStart(4, '0')}`, x, height - 4)
      }
    }

    // Y-axis label
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '8px "IBM Plex Mono", monospace'
    ctx.textAlign = 'right'
    ctx.fillText('R', ML - 6, MT + plotHeight * 0.25 + 3)
    ctx.fillText('W', ML - 6, MT + plotHeight * 0.75 + 3)

    if (delayRecords.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '10px "IBM Plex Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('No delay RAM access detected', width / 2, MT + plotHeight / 2 + 4)

      // Plot border
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1
      ctx.strokeRect(ML, MT, plotWidth, plotHeight)
      return
    }

    // Separate read and write regions into top/bottom halves
    const readRegions = delayRecords.filter(r => r.type === 'read')
    const writeRegions = delayRecords.filter(r => r.type === 'write')

    const drawRegions = (regions: typeof delayRecords, yStart: number, barHeight: number, color: string, borderColor: string) => {
      for (const record of regions) {
        const x0 = ML + (record.startAddress / MAX_ADDRESS) * plotWidth
        const x1 = Math.max(x0 + 4, ML + (record.endAddress / MAX_ADDRESS) * plotWidth)

        ctx.fillStyle = color
        ctx.fillRect(x0, yStart, x1 - x0, barHeight)

        ctx.strokeStyle = borderColor
        ctx.lineWidth = 1
        ctx.strokeRect(x0, yStart, x1 - x0, barHeight)

        if (x1 - x0 > 40) {
          ctx.fillStyle = '#fff'
          ctx.font = '8px "IBM Plex Mono", monospace'
          ctx.textAlign = 'left'
          ctx.fillText(`0x${record.startAddress.toString(16).toUpperCase()}`, x0 + 3, yStart + 10)
        }
      }
    }

    // Read regions in top half (red)
    drawRegions(readRegions, MT + 2, plotHeight / 2 - 3, 'rgba(255, 80, 80, 0.5)', 'rgba(255, 80, 80, 0.8)')
    // Write regions in bottom half (yellow)
    drawRegions(writeRegions, MT + plotHeight / 2 + 1, plotHeight / 2 - 3, 'rgba(255, 200, 50, 0.5)', 'rgba(255, 200, 50, 0.8)')

    // Legend
    ctx.font = '9px "IBM Plex Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255, 80, 80, 0.9)'
    ctx.fillText('READ', ML + plotWidth - 80, MT + 12)
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)'
    ctx.fillText('WRITE', ML + plotWidth - 80, MT + plotHeight - 4)

    // Plot border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.strokeRect(ML, MT, plotWidth, plotHeight)
  }, [delayRecords])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  if (!cachedInstructions) return null

  return (
    <div className="viz-card viz-card-dark">
      <h3 className="viz-card-title">Delay Memory Map</h3>
      <div ref={containerRef} className="delay-map-canvas-container">
        <canvas ref={canvasRef} className="delay-map-canvas" />
      </div>
    </div>
  )
}
