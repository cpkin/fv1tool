import { getLineContext } from './context'
import type { ValidationDiagnostic } from './types'

const formatContext = (
  source: string,
  diagnostic: ValidationDiagnostic
): string | null => {
  if (!diagnostic.line) {
    return null
  }

  const context = diagnostic.context ?? getLineContext(source, diagnostic.line)

  return context.lines
    .map((contextLine) => {
      const indicator = contextLine.lineNumber === diagnostic.line ? '>' : ' '
      const lineNumber = String(contextLine.lineNumber).padStart(3, ' ')
      return `${indicator} ${lineNumber} | ${contextLine.text}`
    })
    .join('\n')
}

export const formatDiagnostics = (
  diagnostics: ValidationDiagnostic[],
  source: string
): string => {
  if (diagnostics.length === 0) {
    return '- None'
  }

  const sorted = [...diagnostics].sort((a, b) => {
    const lineA = a.line ?? Number.POSITIVE_INFINITY
    const lineB = b.line ?? Number.POSITIVE_INFINITY
    if (lineA !== lineB) {
      return lineA - lineB
    }
    return (a.column ?? 0) - (b.column ?? 0)
  })

  return sorted
    .map((diagnostic, index) => {
      const location = diagnostic.line
        ? `Line ${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}`
        : 'Line -'
      const contextSnippet = formatContext(source, diagnostic)
      const parts = [
        `${index + 1}. [${diagnostic.severity.toUpperCase()}] ${location}`,
        diagnostic.message,
      ]

      if (diagnostic.suggestedFix) {
        parts.push(`Suggested fix: ${diagnostic.suggestedFix}`)
      }

      if (contextSnippet) {
        parts.push('Context:')
        parts.push(contextSnippet)
      }

      return parts.join('\n')
    })
    .join('\n\n')
}
