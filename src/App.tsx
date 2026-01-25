import { useEffect, useState } from 'react'
import SpinEditor from './editor/SpinEditor'
import { useValidationStore } from './store/validationStore'
import { useAudioStore } from './store/audioStore'
import DiagnosticsPanel from './ui/DiagnosticsPanel'
import ResourceMeters from './ui/ResourceMeters'
import SimulationPanel from './ui/SimulationPanel'
import SimulationDiagnostics from './ui/SimulationDiagnostics'
import FidelityModal from './ui/FidelityModal'
import { decodeState } from './utils/urlState'

function App() {
  const source = useValidationStore((state) => state.source)
  const setSource = useValidationStore((state) => state.setSource)
  const setPots = useAudioStore((state) => state.setPots)
  const setSelectedDemo = useAudioStore((state) => state.setSelectedDemo)
  const hasSource = source.trim().length > 0
  const [urlStateMessage, setUrlStateMessage] = useState<string | null>(null)

  // Load state from URL on mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const state = decodeState(hash)
      if (state) {
        setSource(state.code)
        setPots({
          pot0: state.pot0 / 11, // Convert 0-11 to 0.0-1.0
          pot1: state.pot1 / 11,
          pot2: state.pot2 / 11,
        })
        if (state.demo) {
          setSelectedDemo(state.demo)
        }
        setUrlStateMessage('State loaded from URL. Click Render to hear audio.')
        setTimeout(() => setUrlStateMessage(null), 5000)
      }
    }
  }, [])

  return (
    <>
      <FidelityModal />
      <div className="app">
        <header className="app-header">
          <div>
            <p className="app-eyebrow">SpinGPT</p>
            <h1>FV-1 SpinASM Validation</h1>
            <p className="app-subtitle">
              Paste your .spn program and preview lint feedback instantly.
            </p>
          </div>
          <div className="header-actions">
            <button className="ghost-button" type="button">
              Load Example
            </button>
            <button className="primary-button" type="button">
              Validate Now
            </button>
          </div>
        </header>

        {urlStateMessage && (
          <div className="url-state-message">
            <span className="info-icon">ℹ️</span>
            <span>{urlStateMessage}</span>
          </div>
        )}

        <main className="app-main">
          <ResourceMeters />

          <section className="editor-shell">
            <div className="panel-header">
              <h2>SpinASM Editor</h2>
              <span className="panel-meta">Auto-validate on line completion</span>
            </div>
            <div className="editor-area">
              <SpinEditor value={source} onChange={setSource} />
              {!hasSource ? (
                <div className="editor-empty">
                  <p className="hint-label">Start typing SpinASM</p>
                  <p>
                    Paste your code here to see inline diagnostics. The editor
                    will show line numbers and lint markers once parsing is live.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="diagnostics-shell">
            <DiagnosticsPanel />
            <SimulationPanel />
            <SimulationDiagnostics />
          </aside>
        </main>
      </div>
    </>
  )
}

export default App
