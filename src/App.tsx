import SpinEditor from './editor/SpinEditor'
import { useValidationStore } from './store/validationStore'
import DiagnosticsPanel from './ui/DiagnosticsPanel'
import ResourceMeters from './ui/ResourceMeters'

function App() {
  const source = useValidationStore((state) => state.source)
  const setSource = useValidationStore((state) => state.setSource)
  const hasSource = source.trim().length > 0

  return (
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
        </aside>
      </main>
    </div>
  )
}

export default App
