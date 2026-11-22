import { PRESETS, type BriefPreset } from '../brief/presets'
import { Button } from './Button'

interface PresetBarProps {
  onApply(preset: BriefPreset): void
}

export function PresetBar({ onApply }: PresetBarProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="presets-label" className="text-[13px] font-medium leading-5 text-ink">
          Start from
        </p>
        <p className="text-[11.5px] leading-4 text-subtle">Fills empty fields only.</p>
      </div>
      <div
        role="group"
        aria-labelledby="presets-label"
        className="mt-2 flex flex-wrap items-center gap-1.5"
      >
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="secondary"
            size="sm"
            title={preset.description}
            onClick={() => onApply(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
