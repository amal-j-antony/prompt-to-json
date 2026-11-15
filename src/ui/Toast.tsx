import { Check } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from './Button'

export interface ToastAction {
  label: string
  onClick(): void
}

export type Notify = (message: string, action?: ToastAction) => void

interface ToastProps {
  message: string
  action?: ToastAction
  onDismiss(): void
}

export function Toast({ message, action, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, action ? 8000 : 2500)
    return () => window.clearTimeout(timer)
  }, [action, message, onDismiss])

  return (
    <div
      role="status"
      className="toast-rise pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-medium text-ink shadow-float"
    >
      <span className="grid h-4 w-4 place-items-center rounded-full bg-ok-soft text-ok">
        <Check aria-hidden="true" size={11} strokeWidth={2.5} />
      </span>
      {message}
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          className="pointer-events-auto -mr-1 h-7 px-2 text-accent enabled:hover:bg-accent-soft"
          onClick={() => {
            action.onClick()
            onDismiss()
          }}
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
