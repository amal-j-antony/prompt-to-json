import type { ChangeEvent, ClipboardEvent } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import type { DocNode } from '../../shared/brief-docs'
import { listDocFromLines, listLinesFromDoc, splitPastedList } from '../brief/list'
import type { FieldSpec } from '../brief/registry'
import type { FieldControl } from './control'

export interface ListFieldEditorProps {
  spec: FieldSpec
  doc: DocNode
  onChange: (doc: DocNode) => void
  error?: string
  onReady?: (control: FieldControl) => void
}

export function ListFieldEditor({ spec, doc, onChange, error, onReady }: ListFieldEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousRef = useRef<string | null>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const hintId = `field-${spec.id}-hint`
  const errorId = `field-${spec.id}-error`

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  const control = useMemo<FieldControl>(
    () => ({
      focus: () => {
        textareaRef.current?.focus()
      },
      clear: () => {
        previousRef.current = textareaRef.current?.value ?? ''
        onChangeRef.current(listDocFromLines([]))
      },
      undo: () => {
        const previous = previousRef.current
        if (previous === null) return
        previousRef.current = null
        onChangeRef.current(listDocFromLines(previous.split('\n')))
      },
      isEmpty: () => (textareaRef.current?.value ?? '').trim().length === 0,
      insert: (text) => {
        const current = textareaRef.current?.value ?? ''
        const lines = current
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)

        for (const item of text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)) {
          if (!lines.includes(item)) lines.push(item)
        }

        onChangeRef.current(listDocFromLines(lines))
      },
    }),
    [],
  )

  useEffect(() => {
    onReadyRef.current?.(control)
  }, [control])

  const value = useMemo(() => listLinesFromDoc(doc).join('\n'), [doc])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(listDocFromLines(event.target.value.split('\n')))
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text')
    const multiline = text.includes('\n') || (spec.id === 'files' && /[,;]/.test(text))
    if (!multiline) return

    const items = splitPastedList(text, spec.id)
    if (items.length === 0) return

    event.preventDefault()
    const existing = listLinesFromDoc(doc)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const merged = [...existing]
    for (const item of items) {
      if (!merged.includes(item)) merged.push(item)
    }
    onChange(listDocFromLines(merged.length > 0 ? merged : ['']))
  }

  return (
    <div>
      <div className="editor-surface px-5 py-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          rows={4}
          placeholder={spec.placeholder}
          aria-labelledby={`field-${spec.id}-label`}
          aria-describedby={`${hintId} ${errorId}`}
          aria-required={spec.required ? 'true' : 'false'}
          spellCheck={spec.id !== 'files' && spec.id !== 'verify'}
          className="block min-h-[5.5rem] w-full resize-y bg-transparent text-[0.9375rem] leading-[1.7] text-ink outline-none placeholder:text-subtle focus-visible:outline-none [overflow-wrap:anywhere]"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-5 py-2.5">
        <p className="text-[12px] leading-4 text-subtle">
          One item per line. Paste a list to add several.
        </p>
        <p id={errorId} aria-live="polite" className="text-[12px] font-medium leading-4 text-warn">
          {error}
        </p>
      </div>
    </div>
  )
}
