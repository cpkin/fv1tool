import { useState, useRef, useMemo, useEffect } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useValidationStore } from '../store/validationStore'
import { usePlaybackStore } from '../store/playbackStore'
import { parseSpinAsm } from '../parser/parseSpinAsm'
import { compileProgram } from '../fv1/compileProgram'
import { renderSimulation } from '../audio/renderSimulation'
import { decodeAudio } from '../audio/decodeAudio'
import { analyzeSimulationLimitations } from '../fv1/warnings'
import { playbackManager } from '../audio/playbackManager'
import ProgressBar from './ProgressBar'
import WaveformDisplay from './WaveformDisplay'
import PlaybackControls from './PlaybackControls'
import ExportButtons from './ExportButtons'
import KnobPanel from './KnobPanel'
import SignalPathDiagram from '../components/SignalPathDiagram'
import { extractMetadata } from '../utils/metadataParser'
import { buildCytoscapeElements } from '../utils/graphBuilder'
import { demoAudioFiles } from '../demos'
import type { IOMode } from '../fv1/types'
import type { SimulationWarning } from '../fv1/warnings'

const SUPPORTED_AUDIO_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a']
const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.m4a']

function validateAudioFile(file: File): string | null {
  // Check file extension
  const fileName = file.name.toLowerCase()
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext))
  
  if (!hasValidExtension) {
    return `Unsupported file type. Please upload WAV, MP3, or M4A files.`
  }
  
  // Check MIME type if available
  if (file.type && !SUPPORTED_AUDIO_TYPES.includes(file.type)) {
    return `Unsupported file type "${file.type}". Please upload WAV, MP3, or M4A files.`
  }
  
  return null
}

export default function SimulationPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [warnings, setWarnings] = useState<SimulationWarning[]>([])
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [diagramExpanded, setDiagramExpanded] = useState(false)
  
  const {
    uploadedFile,
    audioBuffer,
    inputError,
    ioMode,
    renderStatus,
    renderProgress,
    renderError,
    renderResult,
    outputBuffer,
    pots,
    selectedDemo,
    setUploadedFile,
    setInputError,
    setIoMode,
    setRenderStatus,
    setRenderProgress,
    setRenderError,
    setRenderResult,
    setOutputBuffer,
    setAudioBuffer,
    resetRenderState,
    setSelectedDemo,
    setCachedRender,
    clearCachedRender,
  } = useAudioStore()
  
  const { isPlaying, playheadTime, reset: resetPlayback } = usePlaybackStore()
  
  const source = useValidationStore((state) => state.source)
  
  // Parse metadata and build diagram elements
  const metadata = useMemo(() => extractMetadata(source), [source])
  const diagramElements = useMemo(() => 
    metadata?.graph ? buildCytoscapeElements(metadata) : [], 
    [metadata]
  )
  
  // Auto-expand diagram when valid metadata is detected
  useEffect(() => {
    if (metadata?.graph) {
      setDiagramExpanded(true)
    }
  }, [metadata])
  
  const handleFileSelect = async (file: File) => {
    resetRenderState()
    clearCachedRender()
    setInputError(null)
    
    // Validate file type
    const validationError = validateAudioFile(file)
    if (validationError) {
      setInputError(validationError)
      setUploadedFile(null)
      setAudioBuffer(null)
      return
    }
    
    setUploadedFile(file)
    setSelectedDemo(null)
    
    // Decode audio
    try {
      const buffer = await decodeAudio(file)
      setAudioBuffer(buffer)
      setInputError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode audio file'
      setInputError(`Decode failed: ${message}. File may be corrupted or unsupported.`)
      setAudioBuffer(null)
    }
  }
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = () => {
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDemoChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const demoId = event.target.value
    resetRenderState()
    clearCachedRender()
    setInputError(null)
    setUploadedFile(null)

    if (!demoId) {
      setSelectedDemo(null)
      setAudioBuffer(null)
      return
    }

    const demo = demoAudioFiles.find((item) => item.id === demoId)
    if (!demo) {
      setSelectedDemo(null)
      setAudioBuffer(null)
      return
    }

    setSelectedDemo(demoId)
    setIsDemoLoading(true)

    try {
      const response = await fetch(demo.path)
      if (!response.ok) {
        throw new Error(`Failed to load demo: ${response.status}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const buffer = await decodeAudio(arrayBuffer)
      setAudioBuffer(buffer)
      setInputError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load demo audio'
      setInputError(`Demo load failed: ${message}`)
      setAudioBuffer(null)
    } finally {
      setIsDemoLoading(false)
    }
  }
  
  const handleRender = async () => {
    if (!uploadedFile && !audioBuffer) {
      setRenderError('No audio file selected')
      return
    }
    
    if (!source.trim()) {
      setRenderError('No SpinASM code to render')
      return
    }
    
    // Stop playback if currently playing
    if (isPlaying) {
      playbackManager.pause()
    }
    
    // Reset states
    resetRenderState()
    clearCachedRender()
    resetPlayback()
    setRenderStatus('rendering')
    
    try {
      // Parse editor source
      const parseResult = parseSpinAsm(source)
      
      if (parseResult.diagnostics.some(d => d.severity === 'error')) {
        setRenderStatus('error')
        setRenderError('Cannot render: code has parse errors. Fix errors in the editor first.')
        return
      }
      
      // Compile instructions
      let compiled
      try {
        compiled = compileProgram(parseResult, ioMode)
      } catch (error) {
        setRenderStatus('error')
        const message = error instanceof Error ? error.message : 'Compilation failed'
        setRenderError(`Compilation error: ${message}`)
        return
      }
      
      // Analyze for simulation limitations
      const programWarnings = analyzeSimulationLimitations(compiled.instructions)
      setWarnings(programWarnings)
      
      // Render simulation
      const inputSource = uploadedFile ?? audioBuffer
      if (!inputSource) {
        setRenderStatus('error')
        setRenderError('No audio input available')
        return
      }

      const result = await renderSimulation({
        input: inputSource,
        instructions: compiled.instructions,
        ioMode,
        pots,
        onProgress: (progress) => {
          setRenderProgress(progress)
        },
      })
      
      // Update render state and set output buffer for waveform/playback
      setRenderStatus('complete')
      setRenderResult(result)
      setOutputBuffer(result.buffer)
      setRenderError(null)
      
      // Cache compiled instructions and input buffer for fast re-render on knob changes
      setCachedRender(compiled.instructions, ioMode, result.buffer)
      console.log('Cached instructions for fast re-render')
    } catch (error) {
      setRenderStatus('error')
      const message = error instanceof Error ? error.message : 'Render failed'
      setRenderError(`Render error: ${message}`)
    }
  }
  
  const ioModeOptions: { value: IOMode; label: string }[] = [
    { value: 'mono_mono', label: 'Mono In → Mono Out' },
    { value: 'stereo_stereo', label: 'Stereo In → Stereo Out' },
    { value: 'mono_stereo', label: 'Mono In → Stereo Out' },
  ]
  
  const hasInput = (!!uploadedFile || !!audioBuffer) && !inputError
  const canRender = hasInput && source.trim().length > 0 && renderStatus !== 'rendering'
  
  return (
    <section className="simulation-panel">
      <div className="panel-header">
        <h2>Audio Simulation</h2>
        <span className="panel-meta">Upload audio and render through FV-1</span>
      </div>

      <div className="demo-picker">
        <label htmlFor="demo-select" className="control-label">
          Demo input
        </label>
        <select
          id="demo-select"
          value={selectedDemo ?? ''}
          onChange={handleDemoChange}
          disabled={isDemoLoading}
          className="demo-select"
        >
          <option value="">Select a demo...</option>
          {demoAudioFiles.map((demo) => (
            <option key={demo.id} value={demo.id}>
              {demo.name}
            </option>
          ))}
        </select>
        {isDemoLoading && <span className="demo-loading">Loading demo...</span>}
        {selectedDemo && (
          <span className="demo-description">
            {demoAudioFiles.find((demo) => demo.id === selectedDemo)?.description}
          </span>
        )}
      </div>
      
      {/* File upload area */}
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${inputError ? 'error' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4,audio/x-m4a"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        {uploadedFile ? (
          <div className="upload-status">
            <p className="upload-filename">{uploadedFile.name}</p>
            <p className="upload-hint">Click or drag to replace</p>
          </div>
        ) : (
          <div className="upload-prompt">
            <p className="upload-label">Drop audio file or click to upload</p>
            <p className="upload-hint">WAV, MP3, or M4A</p>
          </div>
        )}
      </div>
      
      {inputError && (
        <div className="input-error">
          <span className="error-icon">⚠️</span>
          <span>{inputError}</span>
        </div>
      )}
      
      {/* IO Mode selector */}
      <div className="control-row">
        <label htmlFor="io-mode-select" className="control-label">
          IO Mode
        </label>
        <select
          id="io-mode-select"
          value={ioMode}
          onChange={(e) => setIoMode(e.target.value as IOMode)}
          className="io-mode-select"
        >
          {ioModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* Render button */}
      <button
        className="render-button primary-button"
        onClick={handleRender}
        disabled={!canRender}
        type="button"
      >
        {renderStatus === 'rendering' ? 'Rendering...' : 'Render Simulation'}
      </button>
      
      {/* Progress bar */}
      {renderStatus === 'rendering' && renderProgress && (
        <ProgressBar
          progress={renderProgress.progress}
          label={`Rendering: ${renderProgress.processedSeconds.toFixed(1)}s / ${renderProgress.totalSeconds.toFixed(1)}s`}
        />
      )}
      
      {/* Render error */}
      {renderError && (
        <div className="render-error">
          <span className="error-icon">❌</span>
          <span>{renderError}</span>
        </div>
      )}
      
      {/* Simulation warnings */}
      {warnings.length > 0 && (
        <div className="simulation-warnings">
          <h3 className="warnings-header">⚠️ Simulation Limitations</h3>
          <ul className="warnings-list">
            {warnings.map((warning, idx) => (
              <li key={idx} className={`warning-item warning-${warning.severity}`}>
                <strong>{warning.type}:</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Render result */}
      {renderStatus === 'complete' && renderResult && outputBuffer && (
        <div className="render-result">
          <p className="result-success">✓ Render complete</p>
          <p className="result-meta">
            Duration: {renderResult.duration.toFixed(2)}s • 
            Sample rate: {renderResult.sampleRate} Hz • 
            Peak: {(renderResult.normalizedPeak * 100).toFixed(1)}%
          </p>
          {renderResult.warnings.length > 0 && (
            <ul className="result-warnings">
              {renderResult.warnings.map((warning, idx) => (
                <li key={idx}>{warning.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Waveform and playback controls */}
      {renderStatus === 'complete' && outputBuffer && (
        <>
          <WaveformDisplay
            audioBuffer={outputBuffer}
            ioMode={ioMode}
            playheadTime={playheadTime}
          />
          <PlaybackControls />
          <KnobPanel />
          
          {/* Signal Path Diagram - only show if metadata.graph exists */}
          {metadata?.graph && (
            <div className="diagram-section" style={{ marginTop: '2rem' }}>
              <button
                className="diagram-header"
                onClick={() => setDiagramExpanded(!diagramExpanded)}
                type="button"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f8f5f2',
                  border: '2px solid #8b7355',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: '#3a2f28',
                  marginBottom: diagramExpanded ? '1rem' : '0',
                }}
              >
                <span>Signal Path Diagram</span>
                <span style={{ fontSize: '1.2rem' }}>
                  {diagramExpanded ? '▼' : '▶'}
                </span>
              </button>
              
              {diagramExpanded && (
                <div className="diagram-content">
                  <SignalPathDiagram elements={diagramElements} />
                </div>
              )}
            </div>
          )}
          
          <ExportButtons />
        </>
      )}
    </section>
  )
}
