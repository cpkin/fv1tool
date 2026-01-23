import type { Tree } from '@lezer/common'

import { parser } from '../language/spinasmParser'
import { getLineContext } from './context'
import type { ValidationDiagnostic } from './types'

interface LineColumn {
  line: number
  column: number
}

const getLineColumn = (source: string, position: number): LineColumn => {
  const prefix = source.slice(0, position)
  const lineMatches = prefix.match(/\r?\n/g)
  const line = (lineMatches?.length ?? 0) + 1
  const lastNewlineIndex = Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r'))
  const column = position - lastNewlineIndex

  return { line, column }
}

export const parseDiagnostics = (
  source: string,
  tree: Tree = parser.parse(source)
): ValidationDiagnostic[] => {
  const diagnostics: ValidationDiagnostic[] = []
  const lines = source.split(/\r?\n/)

  const stripComment = (lineText: string): string => {
    const commentIndex = lineText.indexOf(';')
    return commentIndex === -1 ? lineText : lineText.slice(0, commentIndex)
  }

  const looksLikeValidLine = (lineText: string): boolean => {
    const trimmed = stripComment(lineText).trim()
    if (!trimmed || trimmed.startsWith(';')) {
      return true
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(trimmed)) {
      return true
    }

    if (/^(equ|mem)\s+[A-Za-z_][A-Za-z0-9_]*\s+.+$/i.test(trimmed)) {
      return true
    }

    if (/^org\s+.+$/i.test(trimmed)) {
      return true
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*\b(\s+[A-Za-z0-9_#^|.+\-*/\s,]+)?$/.test(trimmed)) {
      return true
    }

    return false
  }

  tree.iterate({
    enter: (node) => {
      if (!node.type.isError) {
        return
      }

      const { line, column } = getLineColumn(source, node.from)

      const lineText = lines[line - 1] ?? ''
      const trimmed = stripComment(lineText).trim()

      if (!trimmed || trimmed.startsWith(';') || looksLikeValidLine(lineText)) {
        return
      }

      diagnostics.push({
        severity: 'error',
        message: 'Syntax error',
        line,
        column,
        context: getLineContext(source, line),
      })
    },
  })

  return diagnostics
}
