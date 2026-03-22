import { useState, useEffect } from 'react'

const MANIFESTO_MODAL_KEY = 'fv1tool-manifesto-acknowledged'

export default function FidelityModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const acknowledged = localStorage.getItem(MANIFESTO_MODAL_KEY)
    if (!acknowledged) {
      setIsOpen(true)
    }
  }, [])

  const handleAcknowledge = () => {
    localStorage.setItem(MANIFESTO_MODAL_KEY, 'true')
    setIsOpen(false)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={handleAcknowledge}>
      <div className="modal-content fidelity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>FV1Tool Manifesto</h2>
        </div>

        <div className="modal-body">
          <p className="fidelity-intro">
            Our shared human ability to think is a thread of commonality among us. Removing the technical aspect of DSP programming is not a great evil that kills thought, but merely a means of removing barriers to explore new sounds.
          </p>

          <p className="fidelity-intro">
            I encourage anybody using this tool to have fun by making new sounds with AI as opposed to new subscriptions.
          </p>

          <blockquote className="manifesto-quote">
            <p>
              "I BELIEVE THAT THE USE OF NOISE TO MAKE MUSIC WILL CONTINUE AND INCREASE UNTIL WE REACH A MUSIC PRODUCED THROUGH THE AID OF ELECTRICAL INSTRUMENTS WHICH WILL MAKE AVAILABLE FOR MUSICAL PURPOSES ANY AND ALL SOUNDS THAT CAN BE HEARD."
            </p>
            <footer>— John Cage, <a href="https://www.nbaldrich.com/media/pdfs/future_of_music.pdf" target="_blank" rel="noopener noreferrer"><em>The Future of Music: Credo</em></a></footer>
          </blockquote>

          <div className="manifesto-acknowledgements">
            <h3>Acknowledgements</h3>
            <ul>
              <li><a href="https://holy-city-audio.gitbook.io/spincad-designer" target="_blank" rel="noopener noreferrer">Holy City Audio — SpinCAD Designer</a></li>
              <li><a href="https://github.com/mstratman" target="_blank" rel="noopener noreferrer">mstratman of MAS Effects</a></li>
              <li><a href="https://github.com/audiofab/fv1-vscode/" target="_blank" rel="noopener noreferrer">Audiofab — FV-1 VS Code Extension</a></li>
            </ul>
          </div>

          <div className="manifesto-technical">
            <h3>Technical Notes</h3>
            <p>Known deviations from FV-1 hardware:</p>
            <ul>
              <li>Sample rate: 32 kHz (hardware: 32.768 kHz) — slight timing difference in reverb/delay</li>
              <li>Delay RAM: Int32 with limited resolution (hardware: 24-bit fixed-point with similar constraints)</li>
              <li>LOG/EXP: Approximate 4-bit shift convention (may differ in extreme cases)</li>
              <li>Fixed-point math: Emulated in JavaScript (not true 24-bit integer)</li>
            </ul>
          </div>
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
