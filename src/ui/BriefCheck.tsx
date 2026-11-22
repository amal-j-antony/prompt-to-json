import { Check, Circle } from 'lucide-react'
import type { BriefSettings, FieldId } from '../../shared/brief-docs'
import { briefCheck, type BriefCheckStatus } from '../brief/check'
import type { FieldDocs } from '../brief/docs'

const STATUS: Record<BriefCheckStatus, { label: string; className: string }> = {
  thin: { label: 'Thin brief', className: 'border-warn-line bg-warn-soft text-warn' },
  good: { label: 'Good start', className: 'border-line bg-surface-2 text-muted' },
  strong: { label: 'Strong brief', className: 'border-ok-line bg-ok-soft text-ok' },
}

interface BriefCheckProps {
  docs: FieldDocs
  settings: BriefSettings
  onFocus(field: FieldId): void
  onSuggest(field: FieldId): void
  variant?: 'card' | 'inline'
}

export function BriefCheck({
  docs,
  settings,
  onFocus,
  onSuggest,
  variant = 'card',
}: BriefCheckProps) {
  const result = briefCheck(docs, settings)
  const status = STATUS[result.status]
  const inline = variant === 'inline'

  return (
    <section
      className={inline ? 'border-t border-line pt-3' : 'field-shell px-5 py-4'}
      aria-labelledby="brief-check-label"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="brief-check-label" className="text-[13px] font-medium leading-5 text-ink">
            Brief check
          </h2>
          <p className="text-[12px] leading-5 text-subtle">
            {result.passed} of {result.total} checks pass.
            {inline ? null : ' A strong brief names the outcome, the checks, and the proof.'}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-4 ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <ul
        className={`mt-3 grid gap-1.5 border-t border-line pt-3 ${
          inline ? '' : 'sm:grid-cols-2'
        }`}
      >
        {result.items.map((item) =>
          item.passed ? (
            <li
              key={item.id}
              className="flex items-start gap-2 text-[12px] leading-5 text-muted"
            >
              <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-ok" />
              {item.label}
            </li>
          ) : (
            <li key={item.id} className="flex min-w-0 items-start gap-1.5">
              <button
                type="button"
                onClick={() => onFocus(item.field)}
                className="action-control flex min-w-0 flex-1 items-start gap-2 rounded-md text-left text-[12px] leading-5 text-muted enabled:hover:text-ink"
              >
                <Circle aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-subtle" />
                {item.label}
              </button>
              <button
                type="button"
                onClick={() => onSuggest(item.field)}
                aria-label={`Suggest ${item.label}`}
                title="Add a starter item"
                className="action-control shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-medium text-muted enabled:hover:border-line-strong enabled:hover:bg-surface-3 enabled:hover:text-ink"
              >
                Suggest
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
