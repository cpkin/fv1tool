import { EditorView } from '@codemirror/view'

export const editorExtensions = [
  EditorView.lineWrapping,
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
