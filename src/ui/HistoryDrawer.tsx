import { Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  fieldCount,
  historyTitle,
  relativeTime,
  type HistoryEntry,
} from '../history/entry'

interface HistoryDrawerProps {
  entries: HistoryEntry[]
  error: string | null
  onClose(): void
  onLoad(entry: HistoryEntry): void
  onDelete(id: string): void
  onClear(): void
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function HistoryDrawer({
  entries,
  error,
  onClose,
  onLoad,
  onDelete,
  onClear,
}: HistoryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()

    const panel = panelRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = focusable.at(0)
      const last = focusable.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const handleLoad = (entry: HistoryEntry) => {
    if (!window.confirm('Replace the current draft with this saved brief?')) return
    onLoad(entry)
  }

  const handleDelete = (entry: HistoryEntry, title: string) => {
    if (!window.confirm(`Delete "${title}" from history?`)) return
    onDelete(entry.id)
  }

  const handleClear = () => {
    if (!window.confirm('Delete all saved briefs? This cannot be undone.')) return
    onClear()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div aria-hidden="true" className="drawer-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(event) => event.stopPropagation()}
        className="drawer-panel absolute inset-y-0 right-0 flex h-full w-full flex-col border-l border-line bg-surface shadow-float sm:max-w-md"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0">
            <h2
              id="history-title"
              className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink"
            >
              History
            </h2>
            <p className="mt-0.5 text-[12px] leading-4 text-muted">
              {entries.length === 0
                ? 'No saved briefs'
                : `${entries.length} saved ${entries.length === 1 ? 'brief' : 'briefs'}`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {entries.length > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-8 items-center rounded-[10px] border border-line bg-surface px-2.5 text-[12px] font-medium text-muted transition-colors duration-[160ms] hover:border-line-strong hover:text-warn"
              >
                Clear all
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              aria-label="Close history"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-muted transition-colors duration-[160ms] hover:border-line-strong hover:text-ink"
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-[12px] leading-5 text-warn"
            >
              {error}
            </p>
          ) : null}

          {entries.length === 0 ? (
            <div className="grid h-full place-items-center px-4 text-center">
              <div>
                <p className="text-[13px] font-medium text-ink">No saved briefs yet.</p>
                <p className="mt-1 text-[12px] leading-5 text-muted">
                  Save a brief to keep a snapshot you can reload.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => {
                const title = historyTitle(entry.docs)
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-line bg-surface-2 px-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium leading-5 text-ink">
                          {title}
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-4 text-subtle">
                          Saved{' '}
                          <time dateTime={new Date(entry.savedAt).toISOString()}>
                            {relativeTime(entry.savedAt)}
                          </time>
                          {' · '}
                          {fieldCount(entry.docs)} of 4 fields
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoad(entry)}
                          className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors duration-[160ms] hover:bg-surface-3"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete "${title}"`}
                          onClick={() => handleDelete(entry, title)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors duration-[160ms] hover:border-line-strong hover:text-warn"
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-line px-5 py-3 text-[11.5px] leading-5 text-subtle">
          Saved in this browser.
        </footer>
      </div>
    </div>
  )
}
