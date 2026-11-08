import { Check } from 'lucide-react'
import { useEffect } from 'react'

interface ToastProps {
  message: string
  onDismiss(): void
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 2500)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role="status"
      className="toast-rise pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[12.5px] font-medium text-ink shadow-float"
    >
      <span className="grid h-4 w-4 place-items-center rounded-full bg-ok-soft text-ok">
        <Check aria-hidden="true" size={11} strokeWidth={2.5} />
      </span>
      {message}
    </div>
  )
}
