import { useMemo } from 'react'

import { useValidationStore } from '../store/validationStore'

const DiagnosticsPanel = () => {
  const diagnostics = useValidationStore((state) => state.diagnostics)

  const summary = useMemo(() => {
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
    const info = diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length
    return { errors, warnings, info }
  }, [diagnostics])

  return (
    <div className="diagnostics-panel">
      <div className="panel-header">
        <h2>Diagnostics</h2>
        <span className="panel-meta">
          {summary.errors} errors, {summary.warnings} warnings, {summary.info} info
        </span>
      </div>
      <div className="diagnostics-list">
        {diagnostics.length === 0 ? (
          <div className="diagnostics-empty">
            <p className="diagnostic-message">No diagnostics yet.</p>
            <p className="diagnostic-location">Paste SpinASM code to get started.</p>
          </div>
        ) : (
          diagnostics.map((diagnostic) => (
            <div key={`${diagnostic.message}-${diagnostic.line ?? 0}`} className="diagnostic-row">
              <span className={`pill ${diagnostic.severity}`}>
                {diagnostic.severity}
              </span>
              <div>
                <p className="diagnostic-message">{diagnostic.message}</p>
                <p className="diagnostic-location">
                  {diagnostic.line ? `Line ${diagnostic.line}` : 'Line —'}
                  {diagnostic.column ? `, Column ${diagnostic.column}` : ''}
                </p>
                {diagnostic.suggestedFix ? (
                  <p className="diagnostic-fix">Suggested: {diagnostic.suggestedFix}</p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default DiagnosticsPanel
