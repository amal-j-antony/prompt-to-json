import type { Editor, JSONContent } from '@tiptap/core'
import { Eraser } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type { FieldIssue } from '../brief/compile'
import type { FieldDocs } from '../brief/docs'
import { fieldHasContent } from '../brief/markdown'
import { FIELD_REGISTRY, type FieldId, type FieldSpec } from '../brief/registry'
import { FieldEditor } from '../editor/FieldEditor'
import { Button } from './Button'
import { Icon } from './Icon'
import type { Notify } from './Toast'

interface BriefFormProps {
  docs: FieldDocs
  issues: FieldIssue[]
  resetToken: number
  onChange(id: FieldId, doc: JSONContent): void
  onNotify: Notify
}

export function BriefForm({ docs, issues, resetToken, onChange, onNotify }: BriefFormProps) {
  const editorsRef = useRef<Partial<Record<FieldId, Editor>>>({})

  const registerEditor = useCallback((id: FieldId, editor: Editor) => {
    editorsRef.current[id] = editor
  }, [])

  const clearField = (spec: FieldSpec) => {
    const editor = editorsRef.current[spec.id]
    if (!editor) return

    editor.chain().focus().clearContent().run()
    onNotify(`${spec.label} cleared.`, {
      label: 'Undo',
      onClick: () => {
        if (editor.isEmpty) editor.commands.undo()
      },
    })
  }

  return (
    <div className="space-y-4">
      {FIELD_REGISTRY.map((spec) => {
        const error = issues
          .filter((issue) => issue.field === spec.id)
          .map((issue) => issue.message)
          .join(' ')
        const hasContent = fieldHasContent(spec.kind, docs[spec.id])

        return (
          <section key={spec.id} className="field-shell overflow-hidden">
            <header className="flex items-start gap-3 px-5 pb-4 pt-5">
              <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-accent-line bg-accent-soft px-1.5 font-mono text-[11px] font-medium tracking-wide text-accent">
                {spec.badge}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id={`field-${spec.id}-label`}
                    className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink"
                  >
                    {spec.label}
                  </h2>
                  {spec.required ? (
                    <span className="rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-accent">
                      Required
                    </span>
                  ) : null}
                </div>
                <p
                  id={`field-${spec.id}-hint`}
                  className="mt-0.5 text-[12.5px] leading-5 text-muted"
                >
                  {spec.hint}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {hasContent ? (
                  <Button
                    variant="icon-danger"
                    size="icon"
                    aria-label={`Clear ${spec.label}`}
                    title={`Clear ${spec.label}`}
                    onClick={() => clearField(spec)}
                  >
                    <Eraser aria-hidden="true" size={15} />
                  </Button>
                ) : null}
                <span
                  aria-hidden="true"
                  className="hidden h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2 text-muted sm:grid"
                >
                  <Icon name={spec.icon} size={16} />
                </span>
              </div>
            </header>

            <FieldEditor
              spec={spec}
              doc={docs[spec.id]}
              resetToken={resetToken}
              error={error || undefined}
              onEditorReady={(editor) => registerEditor(spec.id, editor)}
              onChange={(doc) => onChange(spec.id, doc)}
            />
          </section>
        )
      })}
    </div>
  )
}
