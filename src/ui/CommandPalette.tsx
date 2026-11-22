import { Search } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { filterCommands, type CommandAction } from '../lib/commands'
import { useDialog } from './useDialog'

interface CommandPaletteProps {
  actions: readonly CommandAction[]
  onClose(): void
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { panelRef, onBackdropClick } = useDialog({ onClose, initialFocusRef: inputRef })

  const filtered = filterCommands(actions, query)
  const activeIndex = filtered.length === 0 ? -1 : Math.min(active, filtered.length - 1)
  const activeAction = activeIndex >= 0 ? filtered[activeIndex] : undefined

  const run = (action: CommandAction) => {
    onClose()
    action.run()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (filtered.length === 0) return

      const next =
        event.key === 'ArrowDown'
          ? (activeIndex + 1) % filtered.length
          : (activeIndex - 1 + filtered.length) % filtered.length
      setActive(next)

      const id = filtered[next]?.id
      if (id) {
        window.requestAnimationFrame(() => {
          document.getElementById(`command-${id}`)?.scrollIntoView({ block: 'nearest' })
        })
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (activeAction) run(activeAction)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        className="toast-rise w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
      >
        <h2 id="command-title" className="sr-only">
          Command palette
        </h2>

        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search aria-hidden="true" size={15} className="shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Run a command..."
            role="combobox"
            aria-label="Search commands"
            aria-expanded="true"
            aria-controls="command-list"
            aria-autocomplete="list"
            aria-activedescendant={activeAction ? `command-${activeAction.id}` : undefined}
            className="w-full bg-transparent py-3 text-[14px] text-ink outline-none placeholder:text-subtle"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-subtle sm:block">
            Esc
          </kbd>
        </div>

        <ul
          id="command-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-[50vh] overflow-y-auto p-1"
        >
          {filtered.map((action, index) => (
            <li
              key={action.id}
              id={`command-${action.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault()
                run(action)
              }}
              className={`action-control flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] ${
                index === activeIndex
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink hover:bg-surface-3'
              }`}
            >
              <span className="min-w-0 truncate">{action.label}</span>
              {action.hint ? (
                <span className="shrink-0 text-[11px] text-subtle">{action.hint}</span>
              ) : null}
            </li>
          ))}

          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[12px] text-subtle">No commands found.</li>
          ) : null}
        </ul>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-subtle">
          <span>Enter to run · Esc to close</span>
          <span>{filtered.length} commands</span>
        </div>
      </div>
    </div>
  )
}
