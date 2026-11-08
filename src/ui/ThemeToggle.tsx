import type { IconName } from '../brief/registry'
import type { ThemePreference } from '../state/useTheme'
import { Icon } from './Icon'

const OPTIONS: readonly { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
]

interface ThemeToggleProps {
  preference: ThemePreference
  onChange(preference: ThemePreference): void
}

export function ThemeToggle({ preference, onChange }: ThemeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface-3 p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === preference
        return (
          <button
            key={option.value}
            type="button"
            title={`${option.label} theme`}
            aria-label={`${option.label} theme`}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition-colors duration-[160ms] ${
              selected ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon name={option.icon} size={14} />
            <span className="hidden xl:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
