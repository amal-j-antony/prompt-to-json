import type { Editor, JSONContent } from '@tiptap/core'
import { Eraser } from 'lucide-react'
import { useCallback, useRef } from 'react'
import type { BriefSettings, DirectiveId, WorkKind } from '../../shared/brief-docs'
import type { FieldIssue } from '../brief/compile'
import { DIRECTIVE_REGISTRY } from '../brief/directives'
import type { FieldDocs } from '../brief/docs'
import { fieldHasContent } from '../brief/markdown'
import {
  FIELD_REGISTRY,
  fieldView,
  KIND_REGISTRY,
  type FieldId,
  type FieldSpec,
} from '../brief/registry'
import { FieldEditor } from '../editor/FieldEditor'
import { Button } from './Button'
import { Icon } from './Icon'
import type { Notify } from './Toast'

interface BriefFormProps {
  docs: FieldDocs
  settings: BriefSettings
  issues: FieldIssue[]
  resetToken: number
  onChange(id: FieldId, doc: JSONContent): void
  onKindChange(kind: WorkKind): void
  onToggleDirective(id: DirectiveId): void
  onNotify: Notify
}

function KindToggle({ kind, onChange }: { kind: WorkKind; onChange(kind: WorkKind): void }) {
  return (
    <div
      role="group"
      aria-labelledby="work-type-label"
      className="inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface-3 p-0.5"
    >
      {KIND_REGISTRY.map((option) => {
        const selected = option.id === kind
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={`action-control inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-medium active:scale-95 ${
              selected ? 'bg-surface text-ink shadow-sm' : 'text-muted enabled:hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function DirectiveChips({
  selected,
  onToggle,
}: {
  selected: readonly DirectiveId[]
  onToggle(id: DirectiveId): void
}) {
  return (
    <div role="group" aria-labelledby="directives-label" className="flex flex-wrap items-center gap-2">
      {DIRECTIVE_REGISTRY.map((directive) => {
        const active = selected.includes(directive.id)
        return (
          <Button
            key={directive.id}
            variant={active ? 'soft' : 'secondary'}
            size="sm"
            aria-pressed={active}
            title={directive.text}
            onClick={() => onToggle(directive.id)}
          >
            {directive.label}
          </Button>
        )
      })}
    </div>
  )
}

export function BriefForm({
  docs,
  settings,
  issues,
  resetToken,
  onChange,
  onKindChange,
  onToggleDirective,
  onNotify,
}: BriefFormProps) {
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
      <section className="field-shell px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id="work-type-label" className="text-[13px] font-medium leading-5 text-ink">
            Work type
          </p>
          <KindToggle kind={settings.kind} onChange={onKindChange} />
        </div>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p id="directives-label" className="text-[13px] font-medium leading-5 text-ink">
            Directives
          </p>
          <DirectiveChips selected={settings.directives} onToggle={onToggleDirective} />
          <p className="text-[12px] leading-5 text-subtle">
            Directives ride along inside the JSON so the agent sees them.
          </p>
        </div>
      </section>

      {FIELD_REGISTRY.map((spec) => {
        const view = fieldView(spec, settings.kind)
        const error = issues
          .filter((issue) => issue.field === view.id)
          .map((issue) => issue.message)
          .join(' ')
        const hasContent = fieldHasContent(view.kind, docs[view.id])

        return (
          <section key={view.id} className="field-shell overflow-hidden">
            <header className="flex items-start gap-3 px-5 pb-4 pt-5">
              <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-accent-line bg-accent-soft px-1.5 font-mono text-[11px] font-medium tracking-wide text-accent">
                {view.badge}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id={`field-${view.id}-label`}
                    className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink"
                  >
                    {view.label}
                  </h2>
                  {view.required ? (
                    <span className="rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-accent">
                      Required
                    </span>
                  ) : null}
                </div>
                <p
                  id={`field-${view.id}-hint`}
                  className="mt-0.5 text-[12.5px] leading-5 text-muted"
                >
                  {view.hint}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {hasContent ? (
                  <Button
                    variant="icon-danger"
                    size="icon"
                    aria-label={`Clear ${view.label}`}
                    title={`Clear ${view.label}`}
                    onClick={() => clearField(view)}
                  >
                    <Eraser aria-hidden="true" size={15} />
                  </Button>
                ) : null}
                <span
                  aria-hidden="true"
                  className="hidden h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2 text-muted sm:grid"
                >
                  <Icon name={view.icon} size={16} />
                </span>
              </div>
            </header>

            <FieldEditor
              key={`${resetToken}:${view.id}:${view.label}`}
              spec={view}
              doc={docs[view.id]}
              resetToken={resetToken}
              error={error || undefined}
              onEditorReady={(editor) => registerEditor(view.id, editor)}
              onChange={(doc) => onChange(view.id, doc)}
            />
          </section>
        )
      })}
    </div>
  )
}
