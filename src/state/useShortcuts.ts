import { useEffect } from 'react'

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

interface ShortcutOptions {
  enabled: boolean
  onTogglePalette(): void
  onSave(): void
  onCopy(): void
  onMoveField(direction: 1 | -1): void
  onHelp(): void
}

export function useShortcuts({
  enabled,
  onTogglePalette,
  onSave,
  onCopy,
  onMoveField,
  onHelp,
}: ShortcutOptions): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!enabled) return

      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && key === 'k') {
        event.preventDefault()
        onTogglePalette()
        return
      }

      if (mod && !event.shiftKey && key === 's') {
        event.preventDefault()
        onSave()
        return
      }

      if (mod && event.altKey && key === 'c') {
        event.preventDefault()
        onCopy()
        return
      }

      if (event.altKey && (key === 'arrowdown' || key === 'arrowup')) {
        event.preventDefault()
        onMoveField(key === 'arrowdown' ? 1 : -1)
        return
      }

      if (event.key === '?' && !isEditable(event.target)) {
        event.preventDefault()
        onHelp()
      }
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [enabled, onTogglePalette, onSave, onCopy, onMoveField, onHelp])
}
