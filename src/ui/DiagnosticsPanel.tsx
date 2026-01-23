import { useMemo } from 'react'

import { getLineContext } from '../diagnostics/context'
import { useValidationStore } from '../store/validationStore'
import CopyDiagnosticsButton from './CopyDiagnosticsButton'

const DiagnosticsPanel = () => {
  const diagnostics = useValidationStore((state) => state.diagnostics)
  const source = useValidationStore((state) => state.source)

  const summary = useMemo(() => {
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
    const info = diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length
    return { errors, warnings, info }
  }, [diagnostics])

  const sortedDiagnostics = useMemo(() => {
    return [...diagnostics].sort((a, b) => {
      const lineA = a.line ?? Number.POSITIVE_INFINITY
      const lineB = b.line ?? Number.POSITIVE_INFINITY
      if (lineA !== lineB) {
        return lineA - lineB
      }
      return (a.column ?? 0) - (b.column ?? 0)
    })
  }, [diagnostics])

  const formatContext = (line?: number, contextOverride?: ReturnType<typeof getLineContext>) => {
    if (!line) {
      return null
    }

    const context = contextOverride ?? getLineContext(source, line)
    return context.lines
      .map((contextLine) => {
        const indicator = contextLine.lineNumber === line ? '>' : ' '
        const lineNumber = String(contextLine.lineNumber).padStart(3, ' ')
        return `${indicator} ${lineNumber} | ${contextLine.text}`
      })
      .join('\n')
  }

  return (
    <div className="diagnostics-panel">
      <div className="panel-header">
        <div>
          <h2>Diagnostics</h2>
          <span className="panel-meta">
            {summary.errors} errors, {summary.warnings} warnings, {summary.info} info
          </span>
        </div>
        <CopyDiagnosticsButton />
      </div>
      <div className="diagnostics-list">
        {diagnostics.length === 0 ? (
          <div className="diagnostics-empty">
            <p className="diagnostic-message">No diagnostics yet.</p>
            <p className="diagnostic-location">Paste SpinASM code to get started.</p>
          </div>
        ) : (
          sortedDiagnostics.map((diagnostic) => {
            const location = diagnostic.line
              ? `Line ${diagnostic.line}${diagnostic.column ? `, Column ${diagnostic.column}` : ''}`
              : 'Line -'
            const contextSnippet = formatContext(diagnostic.line, diagnostic.context)

            return (
              <div
                key={`${diagnostic.message}-${diagnostic.line ?? 0}-${diagnostic.column ?? 0}`}
                className="diagnostic-row"
              >
              <span className={`pill ${diagnostic.severity}`}>
                {diagnostic.severity}
              </span>
              <div>
                <p className="diagnostic-message">{diagnostic.message}</p>
                <p className="diagnostic-location">{location}</p>
                {contextSnippet ? (
                  <pre className="diagnostic-context">{contextSnippet}</pre>
                ) : null}
                {diagnostic.suggestedFix ? (
                  <p className="diagnostic-fix">Suggested: {diagnostic.suggestedFix}</p>
                ) : null}
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default DiagnosticsPanel
