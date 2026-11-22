import type { JSONContent } from '@tiptap/core'
import { ChevronDown, Eraser } from 'lucide-react'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import type { BriefSettings, DirectiveId, WorkKind } from '../../shared/brief-docs'
import type { FieldIssue } from '../brief/compile'
import { DIRECTIVE_GROUPS, DIRECTIVE_REGISTRY } from '../brief/directives'
import type { FieldDocs } from '../brief/docs'
import { fieldSummary } from '../brief/list'
import { fieldHasContent } from '../brief/markdown'
import type { BriefPreset } from '../brief/presets'
import {
  fieldSet,
  fieldView,
  KIND_REGISTRY,
  type FieldId,
  type FieldSpec,
} from '../brief/registry'
import { suggestionFor } from '../brief/suggestions'
import type { FieldControl } from '../editor/control'
import { FieldEditor } from '../editor/FieldEditor'
import { ListFieldEditor } from '../editor/ListFieldEditor'
import { Button } from './Button'
import { Icon } from './Icon'
import { PresetBar } from './PresetBar'
import type { Notify } from './Toast'

interface BriefFormProps {
  docs: FieldDocs
  settings: BriefSettings
  issues: FieldIssue[]
  resetToken: number
  onChange(id: FieldId, doc: JSONContent): void
  onKindChange(kind: WorkKind): void
  onToggleDirective(id: DirectiveId): void
  onApplyPreset(preset: BriefPreset): void
  onNotify: Notify
}

export interface BriefFormHandle {
  focusField(id: FieldId): void
  suggestField(id: FieldId): void
  expandAll(): void
  collapseAll(): void
  moveField(direction: 1 | -1): void
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
    <div role="group" aria-labelledby="directives-label" className="space-y-2">
      {DIRECTIVE_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            {group.label}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {DIRECTIVE_REGISTRY.filter((directive) => directive.group === group.id).map(
              (directive) => {
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
              },
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export const BriefForm = forwardRef<BriefFormHandle, BriefFormProps>(function BriefForm(
  {
    docs,
    settings,
    issues,
    resetToken,
    onChange,
    onKindChange,
    onToggleDirective,
    onApplyPreset,
    onNotify,
  },
  ref,
) {
  const controlsRef = useRef<Partial<Record<FieldId, FieldControl>>>({})
  const [expanded, setExpanded] = useState<Partial<Record<FieldId, boolean>>>({ goal: true })
  const fields = fieldSet(settings.kind)
  const allExpanded = fields.every((spec) => expanded[spec.id])

  const registerControl = useCallback((id: FieldId, control: FieldControl) => {
    controlsRef.current[id] = control
  }, [])

  const clearField = (spec: FieldSpec) => {
    const control = controlsRef.current[spec.id]
    if (!control) return

    control.clear()
    onNotify(`${spec.label} cleared.`, {
      label: 'Undo',
      onClick: () => {
        if (control.isEmpty()) control.undo()
      },
    })
  }

  const focusField = (id: FieldId) => {
    setExpanded((previous) => (previous[id] ? previous : { ...previous, [id]: true }))
    window.requestAnimationFrame(() => {
      controlsRef.current[id]?.focus()
    })
  }

  const suggestField = (id: FieldId) => {
    const suggestion = suggestionFor(id, settings.kind)
    const control = controlsRef.current[id]
    if (!suggestion || !control) return

    setExpanded((previous) => (previous[id] ? previous : { ...previous, [id]: true }))
    window.requestAnimationFrame(() => {
      control.insert(suggestion)
      control.focus()
    })
  }

  const expandAll = () => {
    const next: Partial<Record<FieldId, boolean>> = {}
    for (const spec of fields) next[spec.id] = true
    setExpanded(next)
  }

  const collapseAll = () => {
    setExpanded({})
  }

  const moveField = (direction: 1 | -1) => {
    const ids = fields.map((spec) => spec.id)
    if (ids.length === 0) return

    const active = document.activeElement
    const card = active instanceof Element ? active.closest('[data-field-id]') : null
    const raw = card?.getAttribute('data-field-id') ?? null
    const current = raw ? ids.find((id) => id === raw) : undefined
    const index = current ? ids.indexOf(current) : -1
    const nextIndex =
      index === -1
        ? direction === 1
          ? 0
          : ids.length - 1
        : (index + direction + ids.length) % ids.length
    const next = ids[nextIndex]
    if (next) focusField(next)
  }

  useImperativeHandle(ref, () => ({
    focusField,
    suggestField,
    expandAll,
    collapseAll,
    moveField,
  }))

  const toggleField = (id: FieldId) => {
    setExpanded((previous) => ({ ...previous, [id]: !previous[id] }))
  }

  const toggleAll = () => {
    if (allExpanded) {
      collapseAll()
      return
    }

    expandAll()
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="field-shell px-5 py-4">
        <PresetBar onApply={onApplyPreset} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
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

      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[12px] font-medium text-muted">Fields</p>
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>

      {fields.map((spec, index) => {
        const view = fieldView(spec, settings.kind)
        const open = expanded[view.id] === true
        const error = issues
          .filter((issue) => issue.field === view.id)
          .map((issue) => issue.message)
          .join(' ')
        const hasContent = fieldHasContent(view.kind, docs[view.id])
        const summary = fieldSummary(view.kind, docs[view.id])

        return (
          <section key={view.id} data-field-id={view.id} className="field-shell overflow-hidden">
            <header className="flex items-start gap-3 px-5 pb-4 pt-5">
              <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-accent-line bg-accent-soft px-1.5 font-mono text-[11px] font-medium tracking-wide text-accent">
                {String(index + 1).padStart(2, '0')}
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
                  className="mt-0.5 truncate text-[12.5px] leading-5 text-muted"
                >
                  {!open && hasContent && summary ? summary : view.hint}
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
                <Button
                  variant="icon"
                  size="icon"
                  aria-expanded={open}
                  aria-controls={`field-${view.id}-body`}
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${view.label}`}
                  onClick={() => toggleField(view.id)}
                >
                  <ChevronDown
                    aria-hidden="true"
                    size={15}
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>
            </header>

            <div id={`field-${view.id}-body`} hidden={!open}>
              {view.kind === 'items' ? (
                <ListFieldEditor
                  key={`${resetToken}:${view.id}:${view.label}`}
                  spec={view}
                  doc={docs[view.id]}
                  error={error || undefined}
                  onReady={(control) => registerControl(view.id, control)}
                  onChange={(doc) => onChange(view.id, doc)}
                />
              ) : (
                <FieldEditor
                  key={`${resetToken}:${view.id}:${view.label}`}
                  spec={view}
                  doc={docs[view.id]}
                  resetToken={resetToken}
                  error={error || undefined}
                  onReady={(control) => registerControl(view.id, control)}
                  onChange={(doc) => onChange(view.id, doc)}
                />
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
})
