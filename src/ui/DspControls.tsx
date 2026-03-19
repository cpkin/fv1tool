import { useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '../store/audioStore'
import { renderSimulation } from '../audio/renderSimulation'
import { useDebugStore } from '../store/debugStore'
import { useRenderPipeline } from '../hooks/useRenderPipeline'
import { usePlaybackStore } from '../store/playbackStore'
import { playbackManager } from '../audio/playbackManager'
import { demoAudioFiles } from '../demos'
import ExportButtons from './ExportButtons'
import PotSlider from './PotSlider'

const LIVE_DEBOUNCE_MS = 150
const LIVE_PREVIEW_SECONDS = 3

export default function DspControls() {
  const {
    pots,
    wetMix,
    knobMode,
    renderStatus,
    bypass,
    cachedInstructions,
    cachedIOMode,
    cachedInputBuffer,
    inputChannels,
    setPots,
    setWetMix,
    setKnobMode,
    setBypass,
    setRenderStatus,
    setRenderProgress,
    setRenderError,
    setRenderResult,
    setOutputBuffer,
  } = useAudioStore()

  const outputBuffer = useAudioStore((state) => state.outputBuffer)

  const {
    fileInputRef,
    isDemoLoading,
    uploadedFile,
    inputError,
    ioMode,
    renderError,
    selectedDemo,
    handleRender,
    canRender,
    renderProgress,
    handleDemoChange,
    handleFileInputChange,
    setIoMode,
  } = useRenderPipeline()

  const { isPlaying, isLooping, setPlaying, setIsLooping } = usePlaybackStore()

  const { enabled: debugEnabled, addEntry: addDebugEntry } = useDebugStore()

  const debounceTimerRef = useRef<number | null>(null)
  const previousPotsRef = useRef(pots)
  const previousWetMixRef = useRef(wetMix)
  const abortRef = useRef<AbortController | null>(null)

  const isRendering = renderStatus === 'rendering'
  const hasCache = !!(cachedInstructions && cachedIOMode && cachedInputBuffer)

  const handleOutputModeChange = (outputStereo: boolean) => {
    const inputMono = inputChannels < 2
    if (inputMono) {
      setIoMode(outputStereo ? 'mono_stereo' : 'mono_mono')
    } else {
      setIoMode(outputStereo ? 'stereo_stereo' : 'mono_mono')
    }
  }
  const outputIsStereo = ioMode === 'stereo_stereo' || ioMode === 'mono_stereo'

  const handleTogglePlayback = () => {
    if (!outputBuffer) return
    if (isPlaying) {
      playbackManager.pause()
      setPlaying(false)
    } else {
      playbackManager.play()
      setPlaying(true)
    }
  }

  const handleToggleLoop = () => {
    if (!outputBuffer) return
    const newLoopState = !isLooping
    setIsLooping(newLoopState)
    playbackManager.setLooping(newLoopState)
  }

  const doRender = useCallback(async (previewSeconds?: number) => {
    if (!cachedInstructions || !cachedIOMode || !cachedInputBuffer) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRenderStatus('rendering')
    setRenderError(null)

    try {
      const currentPots = useAudioStore.getState().pots
      const currentWetMix = useAudioStore.getState().wetMix
      const currentBypass = useAudioStore.getState().bypass

      const effectiveMixWet = currentBypass ? 0 : currentWetMix
      const effectiveMixDry = currentBypass ? 1 : 1 - currentWetMix

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
        mixWet: effectiveMixWet,
        mixDry: effectiveMixDry,
      })

      if (controller.signal.aborted) return

      setRenderStatus('complete')
      setRenderResult(result)
      setOutputBuffer(result.buffer)
      setRenderError(null)
    } catch (error) {
      if (controller.signal.aborted) return
      setRenderStatus('error')
      const message = error instanceof Error ? error.message : 'Re-render failed'
      setRenderError(`Re-render error: ${message}`)
    }
  }, [cachedInstructions, cachedIOMode, cachedInputBuffer, debugEnabled, addDebugEntry, setRenderStatus, setRenderError, setRenderProgress, setRenderResult, setOutputBuffer])

  // Debounced re-render on control change (live mode only)
  useEffect(() => {
    const potsChanged =
      pots.pot0 !== previousPotsRef.current.pot0 ||
      pots.pot1 !== previousPotsRef.current.pot1 ||
      pots.pot2 !== previousPotsRef.current.pot2
    const wetMixChanged = wetMix !== previousWetMixRef.current

    if (!potsChanged && !wetMixChanged) return

    previousPotsRef.current = pots
    previousWetMixRef.current = wetMix

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (knobMode === 'manual') return
    if (!hasCache || isRendering) return

    debounceTimerRef.current = window.setTimeout(() => {
      doRender(LIVE_PREVIEW_SECONDS)
    }, LIVE_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
      }
    }
  }, [pots, wetMix, knobMode, hasCache, isRendering, doRender])

  return (
    <div className="viz-card control-block">
      {/* Row 1: Render, Demo, Upload, I/O, Bypass */}
      <div className="control-row">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-primary render-block-btn"
          onClick={handleRender}
          disabled={!canRender}
          title="Render full simulation"
        >
          {renderStatus === 'rendering' ? 'Rendering...' : 'Render'}
        </button>

        <select
          value={selectedDemo ?? ''}
          onChange={handleDemoChange}
          disabled={isDemoLoading}
          className="toolbar-select"
          title="Select demo audio"
        >
          <option value="">Demo...</option>
          {demoAudioFiles.map((demo) => (
            <option key={demo.id} value={demo.id}>{demo.name}</option>
          ))}
        </select>

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title={uploadedFile ? uploadedFile.name : 'Upload .wav audio file'}
        >
          {uploadedFile ? uploadedFile.name.slice(0, 16) : 'Upload .wav'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.m4a"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        <span className="toolbar-input-indicator" title="Detected input format">
          {inputChannels >= 2 ? 'St' : 'Mo'} In
        </span>
        <div className="pill-group">
          <button
            type="button"
            className={`pill-btn ${!outputIsStereo ? 'pill-btn-active' : ''}`}
            onClick={() => handleOutputModeChange(false)}
          >
            Mono Out
          </button>
          <button
            type="button"
            className={`pill-btn ${outputIsStereo ? 'pill-btn-active' : ''}`}
            onClick={() => handleOutputModeChange(true)}
          >
            Stereo Out
          </button>
        </div>

      </div>

      {/* Progress bar */}
      {renderStatus === 'rendering' && renderProgress && (
        <div className="render-block-progress">
          <div className="progress-track">
            <span className="progress-fill" style={{ width: `${(renderProgress.progress * 100).toFixed(0)}%` }} />
          </div>
          <span className="render-block-label">{renderProgress.processedSeconds.toFixed(1)}s / {renderProgress.totalSeconds.toFixed(1)}s</span>
        </div>
      )}

      {/* Row 2: Play, Loop, Download .wav, Bypass */}
      <div className="control-row">
        <button
          type="button"
          className={`toolbar-btn ${isPlaying ? 'toolbar-btn-active' : ''}`}
          onClick={handleTogglePlayback}
          disabled={!outputBuffer}
          title={isPlaying ? 'Pause playback' : 'Play rendered audio'}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <button
          type="button"
          className={`toolbar-btn ${isLooping ? 'toolbar-btn-active' : ''}`}
          onClick={handleToggleLoop}
          disabled={!outputBuffer}
          title={isLooping ? 'Disable Loop' : 'Enable Loop'}
        >
          Loop
        </button>

        <ExportButtons wavOnly />

        <button
          type="button"
          className={`toolbar-btn ${bypass ? 'toolbar-btn-active' : ''}`}
          onClick={() => setBypass(!bypass)}
          title={bypass ? 'Bypass ON (dry signal)' : 'Bypass OFF (wet signal)'}
        >
          Bypass
        </button>
      </div>

      {/* Errors */}
      {inputError && <div className="toolbar-error">{inputError}</div>}
      {renderError && <div className="toolbar-error">{renderError}</div>}

      {/* Divider */}
      <div className="control-divider" />

      {/* DSP Controls header */}
      <div className="viz-card-header">
        <h3 className="viz-card-title">DSP Controls</h3>
        <div className="dsp-header-right">
          <div className="knob-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${knobMode === 'live' ? 'mode-btn-active' : ''}`}
              onClick={() => setKnobMode('live')}
              title="Auto-render 3s preview on change"
            >
              Live
            </button>
            <button
              type="button"
              className={`mode-btn ${knobMode === 'manual' ? 'mode-btn-active' : ''}`}
              onClick={() => setKnobMode('manual')}
              title="Adjust freely, then click Re-render"
            >
              Manual
            </button>
          </div>
        </div>
      </div>

      <div className={isRendering ? 'dsp-controls-disabled' : ''}>
        <PotSlider
          label="POT0"
          value={pots.pot0}
          onChange={(v) => setPots({ pot0: v })}
          disabled={isRendering}
        />
        <PotSlider
          label="POT1"
          value={pots.pot1}
          onChange={(v) => setPots({ pot1: v })}
          disabled={isRendering}
        />
        <PotSlider
          label="POT2"
          value={pots.pot2}
          onChange={(v) => setPots({ pot2: v })}
          disabled={isRendering}
        />
        <PotSlider
          label="Wet"
          value={wetMix}
          onChange={setWetMix}
          disabled={isRendering || bypass}
          displayFormat={(v) => `${Math.round(v * 100)}%`}
        />
      </div>

      {knobMode === 'manual' && hasCache && (
        <button
          type="button"
          className="toolbar-btn toolbar-btn-primary dsp-rerender-btn"
          onClick={() => doRender()}
          disabled={isRendering}
        >
          {isRendering ? 'Rendering...' : 'Re-render'}
        </button>
      )}
      <p className="dsp-hint">
        {knobMode === 'live'
          ? `Live mode: Auto-renders ${LIVE_PREVIEW_SECONDS}s preview on change`
          : 'Manual mode: Click render to hear changes'}
      </p>
    </div>
  )
}
