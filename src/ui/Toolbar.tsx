import { useRenderPipeline } from '../hooks/useRenderPipeline'
import { useAudioStore } from '../store/audioStore'
import { usePlaybackStore } from '../store/playbackStore'
import { playbackManager } from '../audio/playbackManager'
import { demoAudioFiles } from '../demos'

export default function Toolbar() {
  const {
    fileInputRef,
    isDemoLoading,
    uploadedFile,
    inputError,
    ioMode,
    renderError,
    selectedDemo,
    handleDemoChange,
    handleFileInputChange,
    setIoMode,
  } = useRenderPipeline()

  const bypass = useAudioStore((state) => state.bypass)
  const setBypass = useAudioStore((state) => state.setBypass)
  const outputBuffer = useAudioStore((state) => state.outputBuffer)
  const inputChannels = useAudioStore((state) => state.inputChannels)
  const darkMode = useAudioStore((state) => state.darkMode)
  const setDarkMode = useAudioStore((state) => state.setDarkMode)

  // Build output mode options based on detected input
  const handleOutputModeChange = (outputStereo: boolean) => {
    const inputMono = inputChannels < 2
    if (inputMono) {
      setIoMode(outputStereo ? 'mono_stereo' : 'mono_mono')
    } else {
      setIoMode(outputStereo ? 'stereo_stereo' : 'mono_mono')
    }
  }
  const outputIsStereo = ioMode === 'stereo_stereo' || ioMode === 'mono_stereo'

  const { isPlaying, isLooping, setPlaying, setIsLooping } = usePlaybackStore()

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

  return (
    <div className="app-toolbar">
      <div className="toolbar-controls">
        {/* Demo select */}
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

        {/* Upload button */}
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => fileInputRef.current?.click()}
          title={uploadedFile ? uploadedFile.name : 'Upload audio file'}
        >
          {uploadedFile ? uploadedFile.name.slice(0, 16) : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.m4a"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Input indicator + Output mode */}
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

        {/* Bypass */}
        <button
          type="button"
          className={`toolbar-btn ${bypass ? 'toolbar-btn-active' : ''}`}
          onClick={() => setBypass(!bypass)}
          title={bypass ? 'Bypass ON (dry signal)' : 'Bypass OFF (wet signal)'}
        >
          Bypass
        </button>

        <div className="toolbar-separator" />

        {/* Playback */}
        <button
          type="button"
          className="toolbar-btn toolbar-btn-play"
          onClick={handleTogglePlayback}
          disabled={!outputBuffer}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
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

        <div className="toolbar-separator" />

        {/* Dark mode */}
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      {/* Error / status messages */}
      {inputError && (
        <div className="toolbar-error">{inputError}</div>
      )}
      {renderError && (
        <div className="toolbar-error">{renderError}</div>
      )}

    </div>
  )
}
