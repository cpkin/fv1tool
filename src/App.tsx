import { useEffect, useState, useMemo, useCallback } from 'react'
import SpinEditor from './editor/SpinEditor'
import { useValidationStore } from './store/validationStore'
import { useAudioStore } from './store/audioStore'
import DiagnosticsPanel from './ui/DiagnosticsPanel'
import ResourceMeters from './ui/ResourceMeters'
import FidelityModal from './ui/FidelityModal'
import Oscilloscope from './ui/Oscilloscope'
import Spectrogram from './ui/Spectrogram'
import DspControls from './ui/DspControls'
import DelayMemoryMap from './ui/DelayMemoryMap'
import DebugPanel from './ui/DebugPanel'
import SignalPathDiagram from './components/SignalPathDiagram'
import PlaybackControls from './ui/PlaybackControls'
import { decodeState } from './utils/urlState'
import { extractMetadata } from './utils/metadataParser'
import { buildCytoscapeElements } from './utils/graphBuilder'
import { useDebugStore } from './store/debugStore'
import { mstratmanExamples, MSTRATMAN_REPO_URL } from './utils/mstratmanExamples'
import { downloadText } from './utils/exportWAV'
import SideDrawer from './ui/SideDrawer'
import { Analytics } from '@vercel/analytics/react'

function App() {
  const source = useValidationStore((state) => state.source)
  const setSource = useValidationStore((state) => state.setSource)
  const setPots = useAudioStore((state) => state.setPots)
  const setSelectedDemo = useAudioStore((state) => state.setSelectedDemo)
  const renderStatus = useAudioStore((state) => state.renderStatus)
  const outputBuffer = useAudioStore((state) => state.outputBuffer)
  const darkMode = useAudioStore((state) => state.darkMode)
  const setDarkMode = useAudioStore((state) => state.setDarkMode)
  const hasSource = source.trim().length > 0
  const [urlStateMessage, setUrlStateMessage] = useState<string | null>(null)
  const [diagramExpanded, setDiagramExpanded] = useState(false)
  const [exampleLoading, setExampleLoading] = useState(false)
  const [manifestCopied, setManifestCopied] = useState(false)
  const [guideExpanded, setGuideExpanded] = useState(false)
  const [userGuideExpanded, setUserGuideExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const {
    enabled: debugEnabled,
    entries: debugEntries,
    setEnabled: setDebugEnabled,
    clear: clearDebugEntries,
  } = useDebugStore()

  // Parse metadata for signal path diagram
  const metadata = useMemo(() => extractMetadata(source), [source])
  const diagramElements = useMemo(() =>
    metadata?.graph ? buildCytoscapeElements(metadata) : [],
    [metadata]
  )

  useEffect(() => {
    if (metadata?.graph) setDiagramExpanded(true)
  }, [metadata])

  // Apply dark mode class to body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Load state from URL on mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const state = decodeState(hash)
      if (state) {
        setSource(state.code)
        setPots({
          pot0: state.pot0 / 11,
          pot1: state.pot1 / 11,
          pot2: state.pot2 / 11,
        })
        if (state.demo) setSelectedDemo(state.demo)
        setUrlStateMessage('State loaded from URL. Click Render to hear audio.')
        setTimeout(() => setUrlStateMessage(null), 5000)
      }
    }
  }, [])

  // Load mstratman example
  const handleLoadExample = useCallback(async (url: string) => {
    setExampleLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      setSource(text)
    } catch (error) {
      console.error('Failed to load example:', error)
    } finally {
      setExampleLoading(false)
    }
  }, [setSource])

  // Drag-and-drop .spn files into editor
  const handleEditorDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.spn')) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSource(reader.result)
        }
      }
      reader.readAsText(file)
    }
  }, [setSource])

  const handleEditorDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Download .spn
  const handleDownloadSpn = () => {
    if (!hasSource) return
    downloadText(source, 'fv1tool-program.spn', 'text/plain')
  }

  // LLM manifest copy
  const handleCopyManifest = async () => {
    try {
      const manifestUrl = 'https://raw.githubusercontent.com/cpkin/fv1tool/main/docs/fv1-development-guide.md'
      const prompt = `Please read and internalize the FV-1 SpinASM development guide at:\n${manifestUrl}\n\nThis guide covers the FV-1 DSP architecture, SpinASM instruction set, delay RAM, LFOs, and programming patterns. Use it as reference when helping me write FV-1 programs.`
      await navigator.clipboard.writeText(prompt)
      setManifestCopied(true)
      setTimeout(() => setManifestCopied(false), 3000)
    } catch {
      // Fallback: try to copy just the URL
      try {
        await navigator.clipboard.writeText('https://raw.githubusercontent.com/cpkin/fv1tool/main/docs/fv1-development-guide.md')
        setManifestCopied(true)
        setTimeout(() => setManifestCopied(false), 3000)
      } catch {
        // ignore
      }
    }
  }

  const isComplete = renderStatus === 'complete' && outputBuffer

  return (
    <>
      <FidelityModal />
      <div className={`app ${darkMode ? 'dark' : 'light'}`}>
        {/* Compact header */}
        <header className="app-header">
          <div>
            <p className="app-eyebrow">FV1Tool</p>
            <h1>FV-1 SpinASM IDE</h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              type="button"
              className="toolbar-btn hamburger-btn"
              onClick={() => setDrawerOpen(true)}
              title="Menu"
            >
              ☰
            </button>
          </div>
        </header>

        {urlStateMessage && (
          <div className="url-state-message">
            <span className="info-icon">i</span>
            <span>{urlStateMessage}</span>
          </div>
        )}

        {/* Guides — full width above main layout */}
        <div className="llm-guide">
          <button
            type="button"
            className="llm-guide-toggle"
            onClick={() => setUserGuideExpanded(!userGuideExpanded)}
          >
            <span>User Guide</span>
            <span>{userGuideExpanded ? '▼' : '▶'}</span>
          </button>
          {userGuideExpanded && (
            <div className="llm-guide-body">
              <p><strong>FV1Tool</strong> is a browser-based IDE for the Spin Semiconductor FV-1 DSP chip. Write SpinASM code, simulate the effect, and hear the result.</p>
              <ol>
                <li><strong>Load audio</strong> — Pick a demo clip from the <em>Demo</em> dropdown, or click <em>Upload .wav</em> to use your own audio. The IDE auto-detects mono/stereo input.</li>
                <li><strong>Write or paste code</strong> — Use an LLM (check out the LLM Usage Guide) to come up with an effect or drop a <code>.spn</code> file into the editor. Or pick an example from the <em>Examples</em> dropdown. Diagnostics update as you type.</li>
                <li><strong>Render</strong> — Click <em>Render</em> to compile and run the FV-1 simulation. The oscilloscope and FFT spectrum show the output waveform and frequency content.</li>
                <li><strong>Listen</strong> — Hit <em>Play</em> to hear the rendered audio. Use <em>Loop</em> for continuous playback. Click the waveform to seek.</li>
                <li><strong>Tweak the pots</strong> — Adjust POT0–POT2 and Wet mix with the sliders. In <em>Live</em> mode, changes auto-render a 3-second preview. In <em>Manual</em> mode, click <em>Re-render</em> to listen to the full clip.</li>
                <li><strong>Export</strong> — Download the rendered audio as a WAV file or save your SpinASM source as a <code>.spn</code> file.</li>
              </ol>
            </div>
          )}
        </div>

        <div className="llm-guide">
          <button
            type="button"
            className="llm-guide-toggle"
            onClick={() => setGuideExpanded(!guideExpanded)}
          >
            <span>FV-1 LLM Usage Guide</span>
            <span>{guideExpanded ? '▼' : '▶'}</span>
          </button>
          {guideExpanded && (
            <div className="llm-guide-body">
              <p>
                Use any LLM (Claude, Deepseek, etc.) to generate FV-1 SpinASM code for your pedal effects.
                The LLM needs a reference guide so it understands the FV-1 instruction set and hardware constraints.
              </p>
              <ol>
                <li>Copy the prompt below and paste it into your LLM conversation. It asks the LLM to read the FV-1 development guide hosted on GitHub. Most LLMs can fetch and parse this URL directly.</li>
              </ol>
              <div className="llm-guide-prompt-line">
                <code className="llm-guide-prompt-text">Please read and internalize the FV-1 SpinASM development guide at: https://raw.githubusercontent.com/cpkin/fv1tool/main/docs/fv1-development-guide.md{'\n\n'}This guide covers the FV-1 DSP architecture, SpinASM instruction set, delay RAM, LFOs, and programming patterns. Use it as reference when helping me write FV-1 programs.</code>
                <button
                  type="button"
                  className={`llm-guide-copy-btn ${manifestCopied ? 'llm-guide-copy-btn-active' : ''}`}
                  onClick={handleCopyManifest}
                  title="Copy prompt to clipboard"
                >
                  {manifestCopied ? '✓' : '⧉'}
                </button>
              </div>
              <ol start={2}>
                <li>Then describe what you want your pedal to do. Be specific about the effect type and how it should sound. For example:</li>
              </ol>
              <div className="llm-guide-example">
                <code>"Write a plate reverb with POT0 controlling decay time (0.2s to 5s), POT1 controlling pre-delay, and POT2 as a tone knob that rolls off highs. Keep it lush but not muddy."</code>
              </div>
              <ol start={3}>
                <li><strong>Expect iteration.</strong> It will likely take multiple attempts for the LLM to produce a usable effect. When you get results back, look for lines marked <code>; TWEAK:</code> in the code — these are the values the LLM suggests you adjust to dial in the sound. Paste any errors from FV1Tool back into the LLM conversation to help it fix issues.</li>
              </ol>
            </div>
          )}
        </div>

        <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {/* Main content: viz LEFT, editor RIGHT */}
        <main className="app-main">
          {/* Left panel: controls + visualizations */}
          <aside className="left-panel">
            <DspControls />

            <div className="viz-card viz-card-dark scope-fft-block">
              <Oscilloscope />
              {isComplete && <Spectrogram />}
            </div>

            <DelayMemoryMap />

            <div className="viz-card">
              <DiagnosticsPanel />
            </div>

            {isComplete && (
              <div className="viz-card">
                <DebugPanel
                  enabled={debugEnabled}
                  entries={debugEntries}
                  onToggle={setDebugEnabled}
                  onClear={clearDebugEntries}
                />
              </div>
            )}
          </aside>

          {/* Right column: editor */}
          <section className="editor-column">
            <div className="editor-shell"
              onDrop={handleEditorDrop}
              onDragOver={handleEditorDragOver}
            >
              <div className="editor-top-bar">
                <div className="editor-top-left">
                  <h2 className="editor-title">SpinASM Editor</h2>
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={handleDownloadSpn}
                    disabled={!hasSource}
                    title="Download .spn source"
                  >
                    Export .spn
                  </button>
                </div>

                <div className="editor-top-right">
                  <select
                    className="toolbar-select"
                    onChange={(e) => {
                      if (e.target.value) handleLoadExample(e.target.value)
                      e.target.value = ''
                    }}
                    disabled={exampleLoading}
                    title="Load example from mstratman/fv1-programs"
                  >
                    <option value="">Examples...</option>
                    {mstratmanExamples.map((ex) => (
                      <option key={ex.file} value={ex.url}>{ex.name}</option>
                    ))}
                  </select>
                  <a
                    href={MSTRATMAN_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="toolbar-btn toolbar-link"
                    title="View source repository"
                  >
                    Source
                  </a>
                </div>
              </div>

              <ResourceMeters />

              <div className="editor-area">
                <SpinEditor value={source} onChange={setSource} />
                {!hasSource && (
                  <div className="editor-empty">
                    <p className="hint-label">Start typing SpinASM</p>
                    <p>Paste code or drop a .spn file here.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        {metadata?.graph && (
          <footer className="app-footer">
            <div className="footer-right">
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => setDiagramExpanded(!diagramExpanded)}
              >
                Signal Path {diagramExpanded ? '▼' : '▶'}
              </button>
            </div>
          </footer>
        )}

        {diagramExpanded && metadata?.graph && (
          <div className="diagram-flyout">
            <SignalPathDiagram elements={diagramElements} />
          </div>
        )}

        <PlaybackControls />
      </div>
      <Analytics />
    </>
  )
}

export default App
