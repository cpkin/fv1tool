import { useMemo, useState } from 'react'

import { useValidationStore } from '../store/validationStore'

const CopyDiagnosticsButton = () => {
  const diagnostics = useValidationStore((state) => state.diagnostics)
  const source = useValidationStore((state) => state.source)
  const resourceUsage = useValidationStore((state) => state.resourceUsage)
  const [copied, setCopied] = useState(false)

  const payload = useMemo(() => {
    const diagnosticsText = diagnostics
      .map((diagnostic) => {
        const location = diagnostic.line
          ? `Line ${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}`
          : 'Line —'
        const suggestion = diagnostic.suggestedFix
          ? ` Suggested fix: ${diagnostic.suggestedFix}`
          : ''
        return `- [${diagnostic.severity.toUpperCase()}] ${location}: ${diagnostic.message}${suggestion}`
      })
      .join('\n')

    return [
      'SpinGPT Diagnostics',
      '',
      'Resource Usage:',
      `- Instructions: ${resourceUsage.instructions.used}/${resourceUsage.instructions.max}`,
      `- Delay RAM: ${resourceUsage.delayRam.used}/${resourceUsage.delayRam.max} (${resourceUsage.delayRam.ms} ms)`,
      `- Registers: ${resourceUsage.registers.used}/${resourceUsage.registers.max}`,
      '',
      'Diagnostics:',
      diagnosticsText || '- None',
      '',
      'Source:',
      source.trim() ? source : '[No source provided]',
    ].join('\n')
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
