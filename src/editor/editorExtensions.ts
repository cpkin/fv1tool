import { EditorView, keymap } from '@codemirror/view'
import { linter, lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'

import { analysisPipeline } from '../analysis/analysisPipeline'
import type { ValidationDiagnostic } from '../diagnostics/types'

const getDiagnosticRange = (
  state: EditorView['state'],
  diagnostic: ValidationDiagnostic
): { from: number; to: number } => {
  if (!diagnostic.line) {
    return { from: 0, to: 0 }
  }

  const line = state.doc.line(diagnostic.line)
  const column = Math.min(Math.max(diagnostic.column ?? 1, 1), line.length + 1)
  const from = line.from + column - 1
  const tail = line.text.slice(column - 1)
  const match = tail.match(/^[A-Za-z_][A-Za-z0-9_]*/)
  const length = match ? match[0].length : Math.min(1, line.to - from)
  const to = Math.min(line.to, from + Math.max(length, 1))

  return { from, to }
}

const buildActions = (
  diagnostic: ValidationDiagnostic
): Diagnostic['actions'] | undefined => {
  if (!diagnostic.suggestedFix) {
    return undefined
  }

  const suggestionMatch = diagnostic.suggestedFix.match(/Did you mean "([^"]+)"\?/i)
  if (!suggestionMatch) {
    return undefined
  }

  const replacement = suggestionMatch[1]

  return [
    {
      name: `Replace with ${replacement}`,
      apply(view, from, to) {
        view.dispatch({ changes: { from, to, insert: replacement } })
      },
    },
  ]
}

const mapDiagnostic = (state: EditorView['state'], diagnostic: ValidationDiagnostic): Diagnostic => {
  const range = getDiagnosticRange(state, diagnostic)

  return {
    from: range.from,
    to: range.to,
    severity: diagnostic.severity,
    message: diagnostic.message,
    actions: buildActions(diagnostic),
  }
}

const spinasmLinter = linter(
  (view) => {
    const result = analysisPipeline(view.state.doc.toString())
    return result.diagnostics.map((diagnostic) => mapDiagnostic(view.state, diagnostic))
  },
  { delay: 250, autoPanel: true }
)

export const editorExtensions = [
  EditorView.lineWrapping,
  spinasmLinter,
  keymap.of(lintKeymap),
  lintGutter(),
  EditorView.theme({
    '&': {
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily:
        "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: '0.95rem',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#8c847d',
    },
    '.cm-content': {
      padding: '18px 0',
    },
  }),
]
