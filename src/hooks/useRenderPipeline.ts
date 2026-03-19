import { useState, useRef, useEffect } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useValidationStore } from '../store/validationStore'
import { usePlaybackStore } from '../store/playbackStore'
import { parseSpinAsm } from '../parser/parseSpinAsm'
import { compileProgram } from '../fv1/compileProgram'
import { renderSimulation } from '../audio/renderSimulation'
import { decodeAudio } from '../audio/decodeAudio'
import { analyzeSimulationLimitations } from '../fv1/warnings'
import { playbackManager } from '../audio/playbackManager'
import { useDebugStore } from '../store/debugStore'
import { demoAudioFiles } from '../demos'
import type { SimulationWarning } from '../fv1/warnings'

const SUPPORTED_EXTENSIONS = ['.wav', '.mp3', '.m4a']

function validateAudioFile(file: File): string | null {
  const fileName = file.name.toLowerCase()
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext))
  if (!hasValidExtension) {
    return `Unsupported file type. Please upload WAV, MP3, or M4A files.`
  }
  return null
}

export function useRenderPipeline() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [warnings, setWarnings] = useState<SimulationWarning[]>([])
  const [isDemoLoading, setIsDemoLoading] = useState(false)

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
    wetMix,
    choDepth,
    bypass,
    setUploadedFile,
    setInputError,
    setIoMode,
    setInputChannels,
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

  const { isPlaying, reset: resetPlayback } = usePlaybackStore()
  const source = useValidationStore((state) => state.source)
  const { enabled: debugEnabled, addEntry: addDebugEntry } = useDebugStore()

  const handleFileSelect = async (file: File) => {
    resetRenderState()
    clearCachedRender()
    setInputError(null)

    const validationError = validateAudioFile(file)
    if (validationError) {
      setInputError(validationError)
      setUploadedFile(null)
      setAudioBuffer(null)
      return
    }

    setUploadedFile(file)
    setSelectedDemo(null)

    try {
      const buffer = await decodeAudio(file)
      setAudioBuffer(buffer)
      setInputChannels(buffer.numberOfChannels)
      // Auto-detect IO mode based on input channels
      if (buffer.numberOfChannels >= 2) {
        setIoMode('stereo_stereo')
      } else {
        setIoMode('mono_stereo')
      }
      setInputError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode audio file'
      setInputError(`Decode failed: ${message}. File may be corrupted or unsupported.`)
      setAudioBuffer(null)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
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
    if (file) handleFileSelect(file)
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
      if (!response.ok) throw new Error(`Failed to load demo: ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = await decodeAudio(arrayBuffer)
      setAudioBuffer(buffer)
      setInputChannels(buffer.numberOfChannels)
      if (buffer.numberOfChannels >= 2) {
        setIoMode('stereo_stereo')
      } else {
        setIoMode('mono_stereo')
      }
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

    if (isPlaying) {
      playbackManager.pause()
    }

    resetRenderState()
    clearCachedRender()
    resetPlayback()
    setRenderStatus('rendering')

    try {
      const parseResult = parseSpinAsm(source)

      if (parseResult.diagnostics.some(d => d.severity === 'error')) {
        setRenderStatus('error')
        setRenderError('Cannot render: code has parse errors. Fix errors in the editor first.')
        return
      }

      let compiled
      try {
        compiled = compileProgram(parseResult, ioMode)
      } catch (error) {
        setRenderStatus('error')
        const message = error instanceof Error ? error.message : 'Compilation failed'
        setRenderError(`Compilation error: ${message}`)
        return
      }

      const programWarnings = analyzeSimulationLimitations(compiled.instructions)
      setWarnings(programWarnings)

      const inputSource = uploadedFile ?? audioBuffer
      if (!inputSource) {
        setRenderStatus('error')
        setRenderError('No audio input available')
        return
      }

      const effectiveMixWet = bypass ? 0 : wetMix
      const effectiveMixDry = bypass ? 1 : 1 - wetMix

      const result = await renderSimulation({
        input: inputSource,
        instructions: compiled.instructions,
        ioMode,
        pots,
        onProgress: (progress) => setRenderProgress(progress),
        onDebug: debugEnabled ? (entry) => addDebugEntry(entry) : undefined,
        debugLabel: 'render',
        mixWet: effectiveMixWet,
        mixDry: effectiveMixDry,
        choDepth,
      })

      setRenderStatus('complete')
      setRenderResult(result)
      setOutputBuffer(result.buffer)
      setRenderError(null)
      setCachedRender(compiled.instructions, ioMode, result.resampledInput)
    } catch (error) {
      setRenderStatus('error')
      const message = error instanceof Error ? error.message : 'Render failed'
      setRenderError(`Render error: ${message}`)
    }
  }

  // Auto-load guitar riff on first mount
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    // Only auto-load if no URL state was loaded and no audio selected
    if (!audioBuffer && !selectedDemo && !uploadedFile) {
      loadDemoById('guitar')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDemoById = async (demoId: string) => {
    const demo = demoAudioFiles.find((item) => item.id === demoId)
    if (!demo) return

    setSelectedDemo(demoId)
    setIsDemoLoading(true)
    try {
      const response = await fetch(demo.path)
      if (!response.ok) throw new Error(`Failed to load demo: ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = await decodeAudio(arrayBuffer)
      setAudioBuffer(buffer)
      setInputChannels(buffer.numberOfChannels)
      if (buffer.numberOfChannels >= 2) {
        setIoMode('stereo_stereo')
      } else {
        setIoMode('mono_stereo')
      }
      setInputError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load demo audio'
      setInputError(`Demo load failed: ${message}`)
      setAudioBuffer(null)
    } finally {
      setIsDemoLoading(false)
    }
  }

  const hasInput = (!!uploadedFile || !!audioBuffer) && !inputError
  const canRender = hasInput && source.trim().length > 0 && renderStatus !== 'rendering'

  return {
    // State
    fileInputRef,
    isDragging,
    isDemoLoading,
    warnings,
    canRender,
    hasInput,
    // From stores
    uploadedFile,
    audioBuffer,
    inputError,
    ioMode,
    renderStatus,
    renderProgress,
    renderError,
    renderResult,
    outputBuffer,
    selectedDemo,
    // Actions
    handleRender,
    handleDemoChange,
    handleFileSelect,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setIoMode,
  }
}
