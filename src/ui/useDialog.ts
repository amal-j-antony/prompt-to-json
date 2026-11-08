import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent, RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogOptions<T extends HTMLElement> {
  onClose(): void
  initialFocusRef?: RefObject<T | null>
}

export function useDialog<T extends HTMLElement>({
  onClose,
  initialFocusRef,
}: DialogOptions<T>): {
  panelRef: RefObject<HTMLDivElement | null>
  onBackdropClick(event: MouseEvent<HTMLDivElement>): void
} {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement
    returnFocusRef.current = previous instanceof HTMLElement ? previous : null

    const panel = panelRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const target = initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()

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

      if (!first || !last) {
        event.preventDefault()
        return
      }

      const active = document.activeElement
      if (!panel.contains(active)) {
        event.preventDefault()
        first.focus()
        return
      }

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [initialFocusRef, onClose])

  const onBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose()
    },
    [onClose],
  )

  return { panelRef, onBackdropClick }
}
