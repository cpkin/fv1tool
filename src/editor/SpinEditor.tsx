import { useCallback, useEffect, useMemo, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { lineNumbers } from '@codemirror/view'

import { editorExtensions } from './editorExtensions'
import { spinasm } from '../language'
import { analysisPipeline } from '../analysis/analysisPipeline'
import { useValidationStore } from '../store/validationStore'

interface SpinEditorProps {
  value: string
  onChange: (value: string) => void
}

const SpinEditor = ({ value, onChange }: SpinEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const debounceRef = useRef<number | null>(null)
  const initialValueRef = useRef(value)
  const setDiagnostics = useValidationStore((state) => state.setDiagnostics)
  const setResourceUsage = useValidationStore((state) => state.setResourceUsage)

  const runAnalysis = useCallback(
    (sourceText: string) => {
      const result = analysisPipeline(sourceText)
      setDiagnostics(result.diagnostics)
      setResourceUsage(result.resources.usage)
    },
    [setDiagnostics, setResourceUsage]
  )

  const updateListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return
        }

        const nextSource = update.state.doc.toString()
        onChange(nextSource)

        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current)
        }

        debounceRef.current = window.setTimeout(() => {
          runAnalysis(nextSource)
        }, 320)
      }),
    [onChange, runAnalysis]
  )

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }

    const startState = EditorState.create({
      doc: value,
      extensions: [basicSetup, lineNumbers(), spinasm, updateListener, ...editorExtensions],
    })

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    })

    viewRef.current = view
    runAnalysis(initialValueRef.current)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
      view.destroy()
      viewRef.current = null
    }
  }, [runAnalysis, updateListener])

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

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const view = viewRef.current
    if (!view) return
    // If click is on the container but not inside the CM content, focus the editor
    const cmContent = view.contentDOM
    if (!cmContent.contains(e.target as Node)) {
      view.focus()
    }
  }, [])

  return <div className="editor-host" ref={containerRef} onClick={handleContainerClick} />
}

export default SpinEditor
