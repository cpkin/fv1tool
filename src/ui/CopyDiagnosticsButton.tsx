import { useMemo, useState } from 'react'

import { formatCopyPayload } from '../diagnostics/formatCopyPayload'
import { useValidationStore } from '../store/validationStore'

const CopyDiagnosticsButton = () => {
  const diagnostics = useValidationStore((state) => state.diagnostics)
  const source = useValidationStore((state) => state.source)
  const resourceUsage = useValidationStore((state) => state.resourceUsage)
  const [copied, setCopied] = useState(false)

  const payload = useMemo(() => {
    return formatCopyPayload({ source, diagnostics, resourceUsage })
  }, [diagnostics, resourceUsage, source])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      console.error('Failed to copy diagnostics payload', error)
    }
  }

  return (
    <button className="primary-button copy-button" type="button" onClick={handleCopy}>
      {copied ? 'Copied diagnostics' : 'Copy diagnostics payload'}
    </button>
  )
}

export default CopyDiagnosticsButton
