import { useState, useEffect } from 'react'
import { getFidelityDescription } from '../fv1/warnings'

const FIDELITY_MODAL_KEY = 'spingpt-fidelity-acknowledged'

export default function FidelityModal() {
  const [isOpen, setIsOpen] = useState(false)
  
  useEffect(() => {
    // Check if user has already acknowledged
    const acknowledged = localStorage.getItem(FIDELITY_MODAL_KEY)
    if (!acknowledged) {
      setIsOpen(true)
    }
  }, [])
  
  const handleAcknowledge = () => {
    localStorage.setItem(FIDELITY_MODAL_KEY, 'true')
    setIsOpen(false)
  }
  
  if (!isOpen) {
    return null
  }
  
  return (
    <div className="modal-overlay" onClick={handleAcknowledge}>
      <div className="modal-content fidelity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Simulation Fidelity Notice</h2>
        </div>
        
        <div className="modal-body">
          <p className="fidelity-intro">
            SpinGPT provides <strong>audition-quality</strong> FV-1 simulation for rapid development and bug catching.
          </p>
          
          <div className="fidelity-description">
            <pre>{getFidelityDescription()}</pre>
          </div>
          
          <div className="fidelity-footer">
            <p className="fidelity-disclaimer">
              ⚠️ <strong>Always test on real hardware before deployment.</strong> This simulator is a development tool, not a hardware replacement.
            </p>
          </div>
        </div>
        
        <div className="modal-actions">
          <button
            className="primary-button"
            onClick={handleAcknowledge}
            type="button"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  )
}
