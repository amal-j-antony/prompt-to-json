import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { FieldSpec } from '../brief/registry'
import { Toolbar } from './Toolbar'

export interface FieldEditorProps {
  spec: FieldSpec
  doc: JSONContent
  onChange: (doc: JSONContent) => void
  resetToken: number
  error?: string
}

const SHORTCUT_HINT = 'Markdown: # heading · - list · 1. list · > quote'

function FieldEditorInstance({ spec, doc, onChange, error }: FieldEditorProps) {
  const hintId = `field-${spec.id}-hint`
  const errorId = `field-${spec.id}-error`

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: spec.placeholder }),
    ],
    content: doc,
    editorProps: {
      attributes: {
        'aria-label': spec.label,
        'aria-labelledby': `field-${spec.id}-label`,
        'aria-describedby': `${hintId} ${errorId}`,
        'aria-multiline': 'true',
        'aria-required': spec.required ? 'true' : 'false',
        role: 'textbox',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getJSON())
    },
  })

  return (
    <div>
      {editor ? (
        <Toolbar editor={editor} actions={spec.toolbar} />
      ) : (
        <div aria-hidden="true" className="h-[39px] border-y border-line bg-surface-2" />
      )}
      <div
        className={`editor-surface px-5 py-4 ${
          spec.kind === 'items' ? '[--editor-min:5.5rem]' : '[--editor-min:7.25rem]'
        }`}
      >
        <EditorContent editor={editor} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-5 py-2.5">
        <p className="text-[12px] leading-4 text-subtle">{SHORTCUT_HINT}</p>
        <p
          id={errorId}
          aria-live="polite"
          className="text-[12px] font-medium leading-4 text-warn"
        >
          {error}
        </p>
      </div>
    </div>
  )
}

export function FieldEditor(props: FieldEditorProps) {
  return <FieldEditorInstance key={props.resetToken} {...props} />
}
