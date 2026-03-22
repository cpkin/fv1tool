import type { ResourceUsage, ValidationDiagnostic } from './types'
import { formatDiagnostics } from './formatDiagnostics'

interface CopyPayloadInput {
  source: string
  diagnostics: ValidationDiagnostic[]
  resourceUsage: ResourceUsage
}

export const formatCopyPayload = ({
  source,
  diagnostics,
  resourceUsage,
}: CopyPayloadInput): string => {
  const trimmedSource = source.trim()
  const sourceBlock = trimmedSource ? trimmedSource : '[No source provided]'

  return [
    'FV1Tool Diagnostics',
    '',
    'Source:',
    '```spinasm',
    sourceBlock,
    '```',
    '',
    'Diagnostics:',
    formatDiagnostics(diagnostics, source),
    '',
    'Resource Usage:',
    `- Instructions: ${resourceUsage.instructions.used}/${resourceUsage.instructions.max}`,
    `- Delay RAM: ${resourceUsage.delayRam.used}/${resourceUsage.delayRam.max} samples (${resourceUsage.delayRam.ms} ms)`,
    `- Registers: ${resourceUsage.registers.used}/${resourceUsage.registers.max}`,
  ].join('\n')
}
