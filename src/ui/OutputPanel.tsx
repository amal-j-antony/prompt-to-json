import type { KeyboardEvent } from 'react'
import { useRef, useState } from 'react'
import { Bookmark, Check, CircleAlert, Copy, Download, Info } from 'lucide-react'
import type { BriefSettings, FieldId } from '../../shared/brief-docs'
import type { Compiled } from '../brief/compile'
import type { FieldDocs } from '../brief/docs'
import { briefJsonSchema } from '../brief/schema'
import { copyText } from '../lib/clipboard'
import { BriefCheck } from './BriefCheck'
import { Button } from './Button'

type OutputTab = 'brief' | 'schema'

const TAB_ORDER: readonly OutputTab[] = ['brief', 'schema']
const TAB_LABELS: Record<OutputTab, string> = {
  brief: 'Brief JSON',
  schema: 'JSON Schema',
}
const SCHEMA_JSON = JSON.stringify(briefJsonSchema, null, 2)

interface OutputPanelProps {
  compiled: Compiled
  docs: FieldDocs
  settings: BriefSettings
  primaryLabel: string
  saving: boolean
  onNotify(message: string): void
  onSave(): void
  onFocusField(field: FieldId): void
  onSuggestField(field: FieldId): void
}

export function OutputPanel({
  compiled,
  docs,
  settings,
  primaryLabel,
  saving,
  onNotify,
  onSave,
  onFocusField,
  onSuggestField,
}: OutputPanelProps) {
  const [tab, setTab] = useState<OutputTab>('brief')
  const tabRefs = useRef<Partial<Record<OutputTab, HTMLButtonElement | null>>>({})

  const primaryEmpty = !compiled.ok && compiled.issues.some((issue) => issue.field === 'goal')
  const actionsDisabled = !compiled.ok
  const saveDisabled = actionsDisabled || saving
  const disabledReason = `Fill the ${primaryLabel.toLowerCase()} to save, copy, or download.`

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TAB_ORDER.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = TAB_ORDER.length - 1

    if (nextIndex === null) return
    event.preventDefault()
    const next = TAB_ORDER[nextIndex]
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const handleCopy = async () => {
    if (!compiled.ok) return

    const copied = await copyText(compiled.json)
    onNotify(copied ? 'Brief copied to the clipboard.' : 'Copy failed. Select the JSON and copy it.')
  }

  const handleDownload = () => {
    if (!compiled.ok) return

    const blob = new Blob([compiled.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'brief.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    onNotify('Downloaded brief.json.')
  }

  return (
    <section className="field-shell flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink">
            Agent brief
          </h2>
          <p className="text-[12px] leading-4 text-subtle">Validated as you type.</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-4 ${
            compiled.ok
              ? 'border-ok-line bg-ok-soft text-ok'
              : 'border-warn-line bg-warn-soft text-warn'
          }`}
        >
          {compiled.ok ? (
            <Check aria-hidden="true" size={12} strokeWidth={2.25} />
          ) : (
            <CircleAlert aria-hidden="true" size={12} strokeWidth={2.25} />
          )}
          {compiled.ok ? 'Valid' : 'Incomplete'}
        </span>
      </header>

      <div role="tablist" aria-label="Output format" className="mx-5 flex gap-4 border-b border-line">
        {TAB_ORDER.map((value, index) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            ref={(node) => {
              tabRefs.current[value] = node
            }}
            onClick={() => setTab(value)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`action-control -mb-px border-b-2 pb-2 pt-1 text-[12.5px] font-medium ${
              tab === value
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5 pt-3">
        {primaryEmpty && tab === 'brief' ? (
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] leading-5 text-muted">
            <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-subtle" />
            {primaryLabel === 'Issue'
              ? 'Describe the issue to export this brief.'
              : 'Add a goal to export this brief.'}
          </p>
        ) : null}

        <div
          role="tabpanel"
          id="panel-brief"
          aria-labelledby="tab-brief"
          hidden={tab !== 'brief'}
          className="min-h-0"
        >
          <pre className="code-scroll min-h-[220px] max-h-[40vh] overflow-auto rounded-xl border border-line bg-code p-3.5 font-mono text-[12.5px] leading-relaxed text-code-ink">
            {compiled.json}
          </pre>
        </div>

        <div
          role="tabpanel"
          id="panel-schema"
          aria-labelledby="tab-schema"
          hidden={tab !== 'schema'}
          className="min-h-0"
        >
          <pre className="code-scroll min-h-[220px] max-h-[40vh] overflow-auto rounded-xl border border-line bg-code p-3.5 font-mono text-[12.5px] leading-relaxed text-code-ink">
            {SCHEMA_JSON}
          </pre>
        </div>

        <BriefCheck
          docs={docs}
          settings={settings}
          onFocus={onFocusField}
          onSuggest={onSuggestField}
          variant="inline"
        />

        <Button
          variant="soft"
          size="md"
          disabled={saveDisabled}
          aria-busy={saving}
          title={saveDisabled ? disabledReason : undefined}
          onClick={onSave}
          className="w-full"
        >
          <Bookmark aria-hidden="true" size={15} />
          {saving ? 'Saving...' : 'Save brief'}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="md"
            disabled={actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
            onClick={() => {
              void handleCopy()
            }}
            className="flex-1"
          >
            <Copy aria-hidden="true" size={15} />
            Copy JSON
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled={actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
            onClick={handleDownload}
            className="flex-1"
          >
            <Download aria-hidden="true" size={15} />
            Download brief.json
          </Button>
        </div>

        {actionsDisabled ? (
          <p className="text-[11.5px] leading-5 text-subtle">{disabledReason}</p>
        ) : null}
      </div>
    </section>
  )
}
