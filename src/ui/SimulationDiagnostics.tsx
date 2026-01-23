import { useState, useEffect } from 'react'
import { useAudioStore } from '../store/audioStore'
import { runOfficialCorpus } from '../fv1/validation/corpusRunner'

export default function SimulationDiagnostics() {
  const { corpusStatus, corpusResult, setCorpusStatus, setCorpusResult } = useAudioStore()
  const [expanded, setExpanded] = useState(false)
  
  useEffect(() => {
    // Run corpus validation on mount
    const runValidation = async () => {
      setCorpusStatus('running')
      try {
        const result = await runOfficialCorpus()
        setCorpusResult(result)
        setCorpusStatus('complete')
      } catch (error) {
        console.error('Corpus validation failed:', error)
        setCorpusStatus('error')
      }
    }
    
    if (corpusStatus === 'idle') {
      runValidation()
    }
  }, [corpusStatus, setCorpusStatus, setCorpusResult])
  
  if (corpusStatus === 'idle' || corpusStatus === 'running') {
    return (
      <section className="diagnostics-panel">
        <div className="panel-header">
          <h2>Simulation Diagnostics</h2>
          <span className="panel-meta">Validating interpreter...</span>
        </div>
        <div className="diagnostics-loading">
          <p>Running validation against official corpus...</p>
        </div>
      </section>
    )
  }
  
  if (corpusStatus === 'error' || !corpusResult) {
    return (
      <section className="diagnostics-panel">
        <div className="panel-header">
          <h2>Simulation Diagnostics</h2>
          <span className="panel-meta status-error">Validation failed</span>
        </div>
        <div className="diagnostics-error">
          <p>⚠️ Failed to run corpus validation</p>
        </div>
      </section>
    )
  }
  
  const { total, passed, failed, errors } = corpusResult
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0
  
  return (
    <section className="diagnostics-panel">
      <div className="panel-header">
        <h2>Simulation Diagnostics</h2>
        <button
          className="expand-toggle"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? '▼' : '▶'} Details
        </button>
      </div>
      
      <div className="corpus-summary">
        <div className="corpus-stats">
          <div className="stat-item">
            <span className="stat-label">Corpus Tests</span>
            <span className="stat-value">{total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Passed</span>
            <span className="stat-value status-pass">{passed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Failed</span>
            <span className="stat-value status-fail">{failed}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Errors</span>
            <span className="stat-value status-error">{errors}</span>
          </div>
        </div>
        
        <div className="corpus-pass-rate">
          <div className="pass-rate-bar">
            <div 
              className="pass-rate-fill"
              style={{ width: `${passRate}%` }}
            />
          </div>
          <span className="pass-rate-label">{passRate}% pass rate</span>
        </div>
      </div>
      
      {expanded && (
        <div className="corpus-details">
          <table className="corpus-results-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {corpusResult.results.map((result) => (
                <tr key={result.name} className={`result-${result.status}`}>
                  <td className="result-name">{result.name}</td>
                  <td className="result-status">
                    {result.status === 'pass' && '✓ Pass'}
                    {result.status === 'fail' && '✗ Fail'}
                    {result.status === 'error' && '⚠ Error'}
                  </td>
                  <td className="result-duration">
                    {result.duration ? `${result.duration.toFixed(0)}ms` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {corpusResult.results.some(r => r.errors.length > 0) && (
            <div className="corpus-errors">
              <h3>Errors</h3>
              {corpusResult.results
                .filter(r => r.errors.length > 0)
                .map((result) => (
                  <div key={result.name} className="error-detail">
                    <strong>{result.name}:</strong>
                    <ul>
                      {result.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
