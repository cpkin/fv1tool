import { useEffect, useMemo, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { lineNumbers } from '@codemirror/view'

import { editorExtensions } from './editorExtensions'

interface SpinEditorProps {
  value: string
  onChange: (value: string) => void
}

const SpinEditor = ({ value, onChange }: SpinEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  const updateListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
    [onChange],
  )

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }

    const startState = EditorState.create({
      doc: value,
      extensions: [basicSetup, lineNumbers(), updateListener, ...editorExtensions],
    })

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [updateListener])

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }

    const currentValue = view.state.doc.toString()
    if (currentValue !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
    }
  }, [value])

  return <div className="editor-host" ref={containerRef} />
}

export default SpinEditor
