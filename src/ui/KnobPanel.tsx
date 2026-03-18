import { useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '../store/audioStore'
import { renderSimulation } from '../audio/renderSimulation'
import AnalogKnob from './AnalogKnob'
import { useDebugStore } from '../store/debugStore'

const LIVE_DEBOUNCE_MS = 150
const LIVE_PREVIEW_SECONDS = 3

export default function KnobPanel() {
  const {
    pots,
    wetMix,
    choDepth,
    knobMode,
    renderStatus,
    cachedInstructions,
    cachedIOMode,
    cachedInputBuffer,
    setPots,
    setKnobMode,
    setRenderStatus,
    setRenderProgress,
    setRenderError,
    setRenderResult,
    setOutputBuffer,
  } = useAudioStore()

  const { enabled: debugEnabled, addEntry: addDebugEntry } = useDebugStore()

  const debounceTimerRef = useRef<number | null>(null)
  const previousPotsRef = useRef(pots)
  const previousWetMixRef = useRef(wetMix)
  const previousChoDepthRef = useRef(choDepth)
  const abortRef = useRef<AbortController | null>(null)

  // Convert 0.0-1.0 internal range to 0-10 display range
  const displayPot0 = pots.pot0 * 10
  const displayPot1 = pots.pot1 * 10
  const displayPot2 = pots.pot2 * 10

  const isRendering = renderStatus === 'rendering'
  const hasCache = !!(cachedInstructions && cachedIOMode && cachedInputBuffer)

  // Track whether knobs have changed since last render (for manual mode indicator)
  const knobsDirty = useRef(false)

  const doRender = useCallback(async (previewSeconds?: number) => {
    if (!cachedInstructions || !cachedIOMode || !cachedInputBuffer) return

    // Abort any in-flight preview render
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRenderStatus('rendering')
    setRenderError(null)

    try {
      const currentPots = useAudioStore.getState().pots
      const currentWetMix = useAudioStore.getState().wetMix
      const currentChoDepth = useAudioStore.getState().choDepth

      const result = await renderSimulation({
        input: cachedInputBuffer,
        instructions: cachedInstructions,
        ioMode: cachedIOMode,
        pots: currentPots,
        renderSeconds: previewSeconds,
        abortSignal: controller.signal,
        onProgress: (progress) => setRenderProgress(progress),
        onDebug: debugEnabled ? (entry) => addDebugEntry(entry) : undefined,
        debugLabel: previewSeconds ? 'preview' : 'rerender',
        mixWet: currentWetMix,
        mixDry: 1 - currentWetMix,
        choDepth: currentChoDepth,
      })

      // Don't update if aborted
      if (controller.signal.aborted) return

      setRenderStatus('complete')
      setRenderResult(result)
      setOutputBuffer(result.buffer)
      setRenderError(null)
      knobsDirty.current = false
    } catch (error) {
      if (controller.signal.aborted) return
      setRenderStatus('error')
      const message = error instanceof Error ? error.message : 'Re-render failed'
      setRenderError(`Re-render error: ${message}`)
    }
  }, [cachedInstructions, cachedIOMode, cachedInputBuffer, debugEnabled, addDebugEntry, setRenderStatus, setRenderError, setRenderProgress, setRenderResult, setOutputBuffer])

  // Debounced re-render on knob change (live mode only)
  useEffect(() => {
    const potsChanged =
      pots.pot0 !== previousPotsRef.current.pot0 ||
      pots.pot1 !== previousPotsRef.current.pot1 ||
      pots.pot2 !== previousPotsRef.current.pot2
    const wetMixChanged = wetMix !== previousWetMixRef.current
    const choDepthChanged = choDepth !== previousChoDepthRef.current

    if (!potsChanged && !wetMixChanged && !choDepthChanged) return

    previousPotsRef.current = pots
    previousWetMixRef.current = wetMix
    previousChoDepthRef.current = choDepth
    knobsDirty.current = true

    // Clear any pending debounce
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // In manual mode, don't auto-render
    if (knobMode === 'manual') return

    // In live mode, debounce then render a short preview
    if (!hasCache || isRendering) return

    debounceTimerRef.current = window.setTimeout(() => {
      doRender(LIVE_PREVIEW_SECONDS)
    }, LIVE_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [pots, wetMix, choDepth, knobMode, hasCache, isRendering, doRender])

  const handleManualRender = () => {
    doRender() // full-length render
  }

  return (
    <div className="knob-panel-wrapper">
      <div className="knob-mode-toggle">
        <button
          type="button"
          className={`mode-btn ${knobMode === 'live' ? 'mode-btn-active' : ''}`}
          onClick={() => setKnobMode('live')}
          title="Knob changes auto-render a 3s preview"
        >
          Live Preview
        </button>
        <button
          type="button"
          className={`mode-btn ${knobMode === 'manual' ? 'mode-btn-active' : ''}`}
          onClick={() => setKnobMode('manual')}
          title="Adjust knobs freely, then click Re-render"
        >
          Manual
        </button>
      </div>
      <div className={`knob-panel ${isRendering ? 'knob-panel-disabled' : ''}`}>
        <AnalogKnob
          value={displayPot0}
          onChange={(v) => setPots({ pot0: v / 10 })}
          label="POT0"
          disabled={isRendering}
        />
        <AnalogKnob
          value={displayPot1}
          onChange={(v) => setPots({ pot1: v / 10 })}
          label="POT1"
          disabled={isRendering}
        />
        <AnalogKnob
          value={displayPot2}
          onChange={(v) => setPots({ pot2: v / 10 })}
          label="POT2"
          disabled={isRendering}
        />
      </div>
      {knobMode === 'manual' && hasCache && (
        <button
          type="button"
          className="render-button rerender-button"
          onClick={handleManualRender}
          disabled={isRendering}
        >
          {isRendering ? 'Rendering...' : 'Re-render'}
        </button>
      )}
      {knobMode === 'live' && (
        <p className="knob-mode-hint">
          Auto-renders {LIVE_PREVIEW_SECONDS}s preview on change
        </p>
      )}
    </div>
  )
}
