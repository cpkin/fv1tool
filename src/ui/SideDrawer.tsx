import { useState } from 'react'

interface SideDrawerProps {
  isOpen: boolean
  onClose: () => void
}

const GUIDE_URL = 'https://raw.githubusercontent.com/cpkin/fv1tool/main/docs/fv1-development-guide.md'

export default function SideDrawer({ isOpen, onClose }: SideDrawerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyManifest = async () => {
    try {
      const prompt = `Please read and internalize the FV-1 SpinASM development guide at:\n${GUIDE_URL}\n\nThis guide covers the FV-1 DSP architecture, SpinASM instruction set, delay RAM, LFOs, and programming patterns. Use it as reference when helping me write FV-1 programs.`
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      try {
        await navigator.clipboard.writeText(GUIDE_URL)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch {
        // ignore
      }
    }
  }

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`side-drawer ${isOpen ? 'side-drawer-open' : ''}`}>
        <div className="drawer-header">
          <h2>FV1Tool</h2>
          <button type="button" className="drawer-close" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          {/* LLM Manifest */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">LLM Guide Prompt</h3>
            <p className="drawer-text">Copy this prompt into any LLM to teach it the FV-1 instruction set:</p>
            <div className="llm-guide-prompt-line">
              <code className="llm-guide-prompt-text">Please read and internalize the FV-1 SpinASM development guide at: {GUIDE_URL}{'\n\n'}This guide covers the FV-1 DSP architecture, SpinASM instruction set, delay RAM, LFOs, and programming patterns. Use it as reference when helping me write FV-1 programs.</code>
              <button
                type="button"
                className={`llm-guide-copy-btn ${copied ? 'llm-guide-copy-btn-active' : ''}`}
                onClick={handleCopyManifest}
                title="Copy prompt to clipboard"
              >
                {copied ? '✓' : '⧉'}
              </button>
            </div>
          </section>

          {/* Roadmap */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">Roadmap</h3>
            <ul className="roadmap-list">
              <li className="roadmap-item">
                <span className="roadmap-status roadmap-planned">Planned</span>
                <span>More guitar recording samples across various styles and pickup types</span>
              </li>
              <li className="roadmap-item">
                <span className="roadmap-status roadmap-planned">Planned</span>
                <span>Signal path diagram visualization</span>
              </li>
              <li className="roadmap-item">
                <span className="roadmap-status roadmap-planned">Planned</span>
                <span>Shareable URLs — link directly to a program to share effects with others</span>
              </li>
            </ul>
          </section>

          {/* About / Contact */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">About / Contact</h3>
            <p className="drawer-text">
              Built by <a href="https://github.com/cpkin" target="_blank" rel="noopener noreferrer">@cpkin</a>
            </p>
          </section>

          {/* License */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">License</h3>
            <p className="drawer-text">MIT License © 2026</p>
          </section>

          {/* Acknowledgements */}
          <section className="drawer-section">
            <h3 className="drawer-section-title">Acknowledgements</h3>
            <ul className="drawer-links">
              <li><a href="http://www.spinsemi.com" target="_blank" rel="noopener noreferrer">Spin Semiconductor</a> — creators of the FV-1 chip</li>
              <li><a href="https://github.com/audiofab/fv1-vscode" target="_blank" rel="noopener noreferrer">Audiofab</a> — FV-1 VS Code extension</li>
              <li><a href="https://github.com/mstratman/fv1-programs" target="_blank" rel="noopener noreferrer">mstratman / MAS Effects</a> — community FV-1 program collection</li>
              <li><a href="https://holy-city-audio.gitbook.io/spincad-designer" target="_blank" rel="noopener noreferrer">Holy City Audio</a> — SpinCAD Designer</li>
              <li><a href="https://github.com/ndf-zz/asfv1" target="_blank" rel="noopener noreferrer">asfv1</a> — cross-platform Python assembler</li>
            </ul>
          </section>
        </div>
      </aside>
    </>
  )
}
