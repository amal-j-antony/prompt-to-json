import type { JSONContent } from '@tiptap/core'
import type { FieldIssue } from '../brief/compile'
import type { FieldDocs } from '../brief/docs'
import { FIELD_REGISTRY, type FieldId } from '../brief/registry'
import { FieldEditor } from '../editor/FieldEditor'
import { Icon } from './Icon'

interface BriefFormProps {
  docs: FieldDocs
  issues: FieldIssue[]
  resetToken: number
  onChange(id: FieldId, doc: JSONContent): void
}

export function BriefForm({ docs, issues, resetToken, onChange }: BriefFormProps) {
  return (
    <div className="space-y-4">
      {FIELD_REGISTRY.map((spec) => {
        const error = issues
          .filter((issue) => issue.field === spec.id)
          .map((issue) => issue.message)
          .join(' ')

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
              <span className="ml-auto hidden h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-muted sm:grid">
                <Icon name={spec.icon} size={16} />
              </span>
            </header>

            <FieldEditor
              spec={spec}
              doc={docs[spec.id]}
              resetToken={resetToken}
              error={error || undefined}
              onChange={(doc) => onChange(spec.id, doc)}
            />
          </section>
        )
      })}
    </div>
  )
}
