import { Download, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { FIELD_SETS } from '../../shared/brief-docs'
import {
  fieldCount,
  historyTitle,
  parseHistory,
  relativeTime,
  serializeHistory,
  type HistoryEntry,
} from '../history/entry'
import type { HistorySource } from '../state/useHistory'
import { Button } from './Button'
import { useDialog } from './useDialog'

interface HistoryDrawerProps {
  entries: HistoryEntry[]
  source: HistorySource
  loading: boolean
  error: string | null
  signedIn: boolean
  canSignIn: boolean
  onSignIn(): void
  onClose(): void
  onLoad(entry: HistoryEntry): void
  onDelete(id: string): void
  onClear(): void
  onImport(entries: HistoryEntry[]): { imported: number; skipped: number } | null
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export function HistoryDrawer({
  entries,
  source,
  loading,
  error,
  signedIn,
  canSignIn,
  onSignIn,
  onClose,
  onLoad,
  onDelete,
  onClear,
  onImport,
}: HistoryDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const { panelRef, onBackdropClick } = useDialog({ onClose, initialFocusRef: closeRef })

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

  const handleExport = () => {
    const blob = new Blob([serializeHistory(entries)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'prompt-studio-history.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleImportFile = async (file: File | undefined) => {
    setImportError(null)
    setImportMessage(null)
    if (!file) return

    if (file.size > MAX_IMPORT_BYTES) {
      setImportError('That file is too large.')
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      setImportError('Could not read that file.')
      return
    }

    const incoming = parseHistory(text)
    if (incoming.length === 0) {
      setImportError('That file has no valid saved briefs.')
      return
    }

    let result: { imported: number; skipped: number } | null
    try {
      result = onImport(incoming)
    } catch {
      setImportError('Could not save the imported briefs.')
      return
    }

    if (!result) {
      setImportError('Could not save the imported briefs.')
      return
    }

    setImportMessage(
      result.imported === 0
        ? 'No new briefs to import.'
        : `Imported ${result.imported} brief${result.imported === 1 ? '' : 's'}.`,
    )
  }

  const sourceLabel =
    source === 'account'
      ? 'Saved to your account'
      : canSignIn
        ? 'Saved in this browser'
        : 'Saved on this device'

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onBackdropClick}>
      <div
        aria-hidden="true"
        className="drawer-backdrop pointer-events-none absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="drawer-panel absolute inset-y-0 right-0 flex h-full w-full min-w-0 max-w-full flex-col border-l border-line bg-surface shadow-float sm:max-w-md"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id="history-title"
                className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink"
              >
                History
              </h2>
              {!loading && entries.length > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[10.5px] font-semibold leading-4 text-muted">
                  {entries.length}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[12px] leading-4 text-muted">{sourceLabel}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {entries.length > 0 && !loading ? (
              <Button variant="danger" size="sm" onClick={handleClear}>
                Clear all
              </Button>
            ) : null}
            <Button
              ref={closeRef}
              variant="icon"
              size="icon"
              data-close
              aria-label="Close history"
              onClick={onClose}
              className="shrink-0"
            >
              <X aria-hidden="true" size={15} />
            </Button>
          </div>
        </header>

        {source === 'browser' ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-line px-5 py-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={entries.length === 0}
              onClick={handleExport}
              className="gap-1.5"
            >
              <Download aria-hidden="true" size={13} />
              Export
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              <Upload aria-hidden="true" size={13} />
              Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              aria-label="Import history file"
              className="hidden"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            {importMessage ? (
              <p role="status" className="text-[11.5px] leading-4 text-subtle">
                {importMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
          {!signedIn && canSignIn ? (
            <div className="mb-3 flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <p className="min-w-0 flex-1 break-words text-[12px] leading-5 text-muted">
                Sign in to sync history across devices.
              </p>
              <Button variant="secondary" size="sm" onClick={onSignIn} className="h-7 shrink-0">
                Sign in
              </Button>
            </div>
          ) : null}

          {importError ? (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-[12px] leading-5 text-warn"
            >
              {importError}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-[12px] leading-5 text-warn"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 py-2 text-[12px] leading-5 text-muted" role="status">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent"
              />
              Loading history...
            </div>
          ) : entries.length > 0 ? (
            <ul className="space-y-2">
              {entries.map((entry) => {
                const title = historyTitle(entry.docs)
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-line bg-surface-2 px-3 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
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
                          {fieldCount(entry.docs, entry.settings.kind)} of{' '}
                          {FIELD_SETS[entry.settings.kind].length} fields
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => handleLoad(entry)}>
                          Load
                        </Button>
                        <Button
                          variant="icon-danger"
                          size="icon"
                          aria-label={`Delete "${title}"`}
                          onClick={() => handleDelete(entry, title)}
                        >
                          <Trash2 aria-hidden="true" size={14} />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : error ? null : (
            <div className="grid h-full place-items-center px-4 text-center">
              <div>
                <p className="text-[13px] font-medium text-ink">No saved briefs yet.</p>
                <p className="mt-1 text-[12px] leading-5 text-muted">
                  Save a brief to keep a snapshot you can reload.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-line px-5 py-3 text-[11.5px] leading-5 text-subtle">
          {source === 'account'
            ? 'Saved briefs follow you to any device.'
            : canSignIn
              ? 'Saved briefs stay in this browser. Export them to move devices.'
              : 'Saved on this device. Export the file to move devices.'}
        </footer>
      </div>
    </div>
  )
}
