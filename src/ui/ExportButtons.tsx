import { useState } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useValidationStore } from '../store/validationStore'
import { downloadWAV, downloadText, estimateWAVSize } from '../utils/exportWAV'
import { encodeState, getCurrentState } from '../utils/urlState'

interface ExportButtonsProps {
  wavOnly?: boolean
  shareOnly?: boolean
}

export default function ExportButtons({ wavOnly, shareOnly }: ExportButtonsProps) {
  const outputBuffer = useAudioStore((state) => state.outputBuffer)
  const source = useValidationStore((state) => state.source)
  const pots = useAudioStore((state) => state.pots)
  const selectedDemo = useAudioStore((state) => state.selectedDemo)

  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const hasAudio = outputBuffer !== null
  const hasSource = source.trim().length > 0

  const handleDownloadWAV = () => {
    if (!outputBuffer) return

    const estimatedSize = estimateWAVSize(outputBuffer)
    const channels = outputBuffer.numberOfChannels
    const length = outputBuffer.length
    const bytesPerSample = 2
    const totalSize = 44 + length * channels * bytesPerSample

    if (totalSize > 100 * 1024 * 1024) {
      if (!confirm(`This WAV file will be ${estimatedSize}. Continue with download?`)) return
    }

    downloadWAV(outputBuffer, 'spingpt-render.wav')
  }

  const handleDownloadSpn = () => {
    if (!hasSource) return
    downloadText(source, 'spingpt-program.spn', 'text/plain')
  }

  const handleShare = async () => {
    if (!hasSource) return

    try {
      setShareError(null)
      const state = getCurrentState(source, pots, selectedDemo)
      const hash = encodeState(state)
      const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`
      if (fullUrl.length > 2000) {
        setShareError('Code too large for URL sharing (try shorter program)')
        return
      }

      window.location.hash = hash.slice(1)

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullUrl)
        setShowCopySuccess(true)
        setTimeout(() => setShowCopySuccess(false), 2000)
      } else {
        setShareError('Failed to copy link (clipboard access denied)')
      }
    } catch {
      setShareError('Failed to copy link (clipboard access denied)')
    }
  }

  // WAV-only mode (under oscilloscope)
  if (wavOnly) {
    return (
      <button
        type="button"
        className="toolbar-btn"
        onClick={handleDownloadWAV}
        disabled={!hasAudio}
        title={hasAudio ? `Download WAV (${estimateWAVSize(outputBuffer!)})` : 'No audio'}
      >
        Download .wav
      </button>
    )
  }

  // Share-only mode (in editor header)
  if (shareOnly) {
    return (
      <>
        <button
          type="button"
          className="toolbar-btn"
          onClick={handleShare}
          disabled={!hasSource}
          title="Share via URL"
        >
          Share
        </button>
        {showCopySuccess && <span className="share-success">Copied!</span>}
        {shareError && <span className="share-error">{shareError}</span>}
      </>
    )
  }

  // Full export buttons (footer)
  return (
    <div className="export-buttons">
      <button
        type="button"
        className="secondary-button"
        onClick={handleDownloadWAV}
        disabled={!hasAudio}
        title={hasAudio ? `Download WAV (${estimateWAVSize(outputBuffer!)})` : 'No audio to download'}
      >
        WAV
      </button>

      <button
        type="button"
        className="secondary-button"
        onClick={handleDownloadSpn}
        disabled={!hasSource}
        title="Download .spn source code"
      >
        .spn
      </button>

      <button
        type="button"
        className="secondary-button"
        onClick={handleShare}
        disabled={!hasSource}
        title="Share code and knob settings via URL"
      >
        Share
      </button>

      {showCopySuccess && <span className="share-success">Link copied!</span>}
      {shareError && <span className="share-error">{shareError}</span>}
    </div>
  )
}
