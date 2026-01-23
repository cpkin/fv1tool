const placeholderDiagnostics = [
  {
    severity: 'warning',
    message: 'Delay line declared but never written to.',
    location: 'Line 42, Column 3',
  },
  {
    severity: 'info',
    message: 'Unused pot: POT2 is never referenced.',
    location: 'Line 18, Column 1',
  },
]

function App() {
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
        <section className="meter-row">
          <div className="meter-card">
            <p className="meter-label">Instructions</p>
            <p className="meter-value">84 / 128</p>
            <div className="meter-track">
              <span className="meter-fill" style={{ width: '66%' }} />
            </div>
          </div>
          <div className="meter-card">
            <p className="meter-label">Delay RAM</p>
            <p className="meter-value">20480 / 32768</p>
            <div className="meter-track">
              <span className="meter-fill" style={{ width: '62%' }} />
            </div>
          </div>
          <div className="meter-card warning">
            <p className="meter-label">Registers</p>
            <p className="meter-value">10 / 16</p>
            <div className="meter-track">
              <span className="meter-fill" style={{ width: '62%' }} />
            </div>
          </div>
        </section>

        <section className="editor-shell">
          <div className="panel-header">
            <h2>SpinASM Editor</h2>
            <span className="panel-meta">Auto-validate on line completion</span>
          </div>
          <div className="editor-placeholder">
            <p className="hint-label">Start typing SpinASM</p>
            <p>
              Paste your code here to see inline diagnostics. The editor will
              show line numbers and lint markers once parsing is live.
            </p>
          </div>
        </section>

        <aside className="diagnostics-shell">
          <div className="panel-header">
            <h2>Diagnostics</h2>
            <span className="panel-meta">2 warnings, 0 errors</span>
          </div>
          <div className="diagnostics-list">
            {placeholderDiagnostics.map((diagnostic) => (
              <div key={diagnostic.message} className="diagnostic-row">
                <span className={`pill ${diagnostic.severity}`}>
                  {diagnostic.severity}
                </span>
                <div>
                  <p className="diagnostic-message">{diagnostic.message}</p>
                  <p className="diagnostic-location">{diagnostic.location}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="primary-button copy-button" type="button">
            Copy diagnostics payload
          </button>
        </aside>
      </main>
    </div>
  )
}

export default App
