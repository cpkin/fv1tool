import { useState, useEffect } from 'react'

const ABOUT_MODAL_KEY = 'fv1tool-about-acknowledged'

export default function FidelityModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const acknowledged = localStorage.getItem(ABOUT_MODAL_KEY)
    if (!acknowledged) {
      setIsOpen(true)
    }
  }, [])

  const handleAcknowledge = () => {
    localStorage.setItem(ABOUT_MODAL_KEY, 'true')
    setIsOpen(false)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={handleAcknowledge}>
      <div className="modal-content fidelity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>About FV1Tool</h2>
        </div>

        <div className="modal-body">
          <p className="fidelity-intro">
            <strong>FV1Tool</strong> is a free, browser-based IDE for the Spin Semiconductor FV-1 DSP chip. Write SpinASM code, simulate the effect, and hear the result.
          </p>

          <p className="fidelity-intro">
            FV1Tool also has a LLM development guide that enables the use of any LLM (Claude, etc.) to generate FV-1 programs for guitar pedal effects. Copy the ready-made prompt into your choice of LLM to dramatically improve the quality of the LLM's output.
          </p>

          <p className="fidelity-intro">
            My goal in creating this tool is to remove the technical barriers to explore Spin Semi FV-1's capabilities. Have fun!
          </p>

          <blockquote className="manifesto-quote">
            <p>
              "I BELIEVE THAT THE USE OF NOISE TO MAKE MUSIC WILL CONTINUE AND INCREASE UNTIL WE REACH A MUSIC PRODUCED THROUGH THE AID OF ELECTRICAL INSTRUMENTS WHICH WILL MAKE AVAILABLE FOR MUSICAL PURPOSES ANY AND ALL SOUNDS THAT CAN BE HEARD."
            </p>
            <footer>— John Cage, <a href="https://www.nbaldrich.com/media/pdfs/future_of_music.pdf" target="_blank" rel="noopener noreferrer"><em>The Future of Music: Credo</em></a></footer>
          </blockquote>
        </div>

        <div className="modal-actions">
          <button
            className="primary-button"
            onClick={handleAcknowledge}
            type="button"
          >
            Make Noise
          </button>
        </div>
      </div>
    </div>
  )
}
