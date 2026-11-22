import { X } from 'lucide-react'
import { useRef } from 'react'
import { Button } from './Button'
import { useDialog } from './useDialog'

const SHORTCUTS = [
  ['Command palette', 'Ctrl/Cmd+K'],
  ['Save brief', 'Ctrl/Cmd+S'],
  ['Copy JSON', 'Ctrl/Cmd+Alt+C'],
  ['Next field', 'Alt+Down'],
  ['Previous field', 'Alt+Up'],
  ['Keyboard shortcuts', '?'],
  ['Close a dialog', 'Esc'],
] as const

interface ShortcutsDialogProps {
  onClose(): void
}

export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { panelRef, onBackdropClick } = useDialog({ onClose, initialFocusRef: closeRef })

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onBackdropClick}>
      <div
        aria-hidden="true"
        className="drawer-backdrop pointer-events-none absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="toast-rise relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-float"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0">
            <h2
              id="shortcuts-title"
              className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-ink"
            >
              Keyboard shortcuts
            </h2>
            <p className="mt-0.5 text-[12px] leading-4 text-muted">
              Work without reaching for the mouse.
            </p>
          </div>
          <Button
            ref={closeRef}
            variant="icon"
            size="icon"
            data-close
            aria-label="Close shortcuts"
            onClick={onClose}
            className="ml-auto shrink-0"
          >
            <X aria-hidden="true" size={15} />
          </Button>
        </header>

        <dl className="mt-4 divide-y divide-line border-t border-line">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[12.5px] leading-5 text-muted">{label}</dt>
              <dd>
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-ink">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
