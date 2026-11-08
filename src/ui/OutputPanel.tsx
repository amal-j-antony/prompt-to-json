import type { KeyboardEvent } from 'react'
import { useRef, useState } from 'react'
import { Bookmark, Check, CircleAlert, Copy, Download, Info } from 'lucide-react'
import type { Compiled } from '../brief/compile'
import { briefJsonSchema } from '../brief/schema'

type OutputTab = 'brief' | 'schema'

const TAB_ORDER: readonly OutputTab[] = ['brief', 'schema']
const TAB_LABELS: Record<OutputTab, string> = {
  brief: 'Brief JSON',
  schema: 'JSON Schema',
}
const SCHEMA_JSON = JSON.stringify(briefJsonSchema, null, 2)

function copyWithTextarea(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(area)
  return copied
}

interface OutputPanelProps {
  compiled: Compiled
  onNotify(message: string): void
  onSave(): void
}

export function OutputPanel({ compiled, onNotify, onSave }: OutputPanelProps) {
  const [tab, setTab] = useState<OutputTab>('brief')
  const tabRefs = useRef<Partial<Record<OutputTab, HTMLButtonElement | null>>>({})

  const goalEmpty = !compiled.ok && compiled.issues.some((issue) => issue.field === 'goal')
  const actionsDisabled = !compiled.ok
  const disabledReason = 'Fill the goal to save, copy, or download.'

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

    let copied = false
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(compiled.json)
        copied = true
      } catch {
        copied = false
      }
    }
    if (!copied) {
      try {
        copied = copyWithTextarea(compiled.json)
      } catch {
        copied = false
      }
    }
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
            className={`-mb-px border-b-2 pb-2 pt-1 text-[12.5px] font-medium transition-colors duration-[160ms] ${
              tab === value
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5 pt-3">
        {goalEmpty && tab === 'brief' ? (
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] leading-5 text-muted">
            <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-subtle" />
            Add a goal to export this brief.
          </p>
        ) : null}

        <div
          role="tabpanel"
          id="panel-brief"
          aria-labelledby="tab-brief"
          hidden={tab !== 'brief'}
          className="min-h-0"
        >
          <pre className="code-scroll min-h-[220px] max-h-[52vh] overflow-auto rounded-xl border border-line bg-code p-3.5 font-mono text-[12.5px] leading-relaxed text-code-ink">
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
          <pre className="code-scroll min-h-[220px] max-h-[52vh] overflow-auto rounded-xl border border-line bg-code p-3.5 font-mono text-[12.5px] leading-relaxed text-code-ink">
            {SCHEMA_JSON}
          </pre>
        </div>

        <button
          type="button"
          disabled={actionsDisabled}
          title={actionsDisabled ? disabledReason : undefined}
          onClick={onSave}
          className="inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-accent-line bg-accent-soft px-3 text-[13px] font-medium text-accent transition-colors duration-[160ms] hover:border-accent hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-45"
        >
          <Bookmark aria-hidden="true" size={15} />
          Save brief
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
            onClick={() => {
              void handleCopy()
            }}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-accent px-3 text-[13px] font-medium text-on-accent transition-colors duration-[160ms] hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-45"
          >
            <Copy aria-hidden="true" size={15} />
            Copy JSON
          </button>
          <button
            type="button"
            disabled={actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
            onClick={handleDownload}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-[160ms] hover:bg-surface-3 disabled:pointer-events-none disabled:opacity-45"
          >
            <Download aria-hidden="true" size={15} />
            Download brief.json
          </button>
        </div>

        {actionsDisabled ? (
          <p className="text-[11.5px] leading-5 text-subtle">{disabledReason}</p>
        ) : null}
      </div>
    </section>
  )
}
