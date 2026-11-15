import type { ServerStatus } from '../state/useServerStatus'

const LABELS: Record<ServerStatus, string> = {
  checking: 'Checking server',
  online: 'Server online',
  degraded: 'Database offline',
  waking: 'Waking server',
  offline: 'Server offline',
}

const TONES: Record<ServerStatus, { button: string; dot: string }> = {
  checking: { button: 'border-line bg-surface text-muted', dot: 'bg-subtle animate-pulse' },
  online: { button: 'border-ok-line bg-ok-soft text-ok', dot: 'bg-ok' },
  degraded: { button: 'border-warn-line bg-warn-soft text-warn', dot: 'bg-warn' },
  waking: { button: 'border-warn-line bg-warn-soft text-warn', dot: 'bg-warn animate-pulse' },
  offline: { button: 'border-warn bg-warn-soft text-warn', dot: 'bg-warn' },
}

interface ServerStatusPillProps {
  status: ServerStatus
  onCheck(): void
}

export function ServerStatusPill({ status, onCheck }: ServerStatusPillProps) {
  const label = LABELS[status]
  const tone = TONES[status]

  return (
    <button
      type="button"
      onClick={onCheck}
      aria-label={label}
      title={label}
      className={`action-control inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[12px] font-medium active:scale-[0.98] enabled:hover:border-line-strong ${tone.button}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </button>
  )
}
