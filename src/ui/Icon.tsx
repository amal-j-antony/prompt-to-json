import {
  CircleCheck,
  CircleHelp,
  CircleSlash,
  FileCode2,
  FlaskConical,
  Lock,
  Monitor,
  Moon,
  NotebookText,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { IconName } from '../brief/registry'

const ICONS: Record<IconName, LucideIcon> = {
  target: Target,
  check: CircleCheck,
  note: NotebookText,
  slash: CircleSlash,
  lock: Lock,
  file: FileCode2,
  flask: FlaskConical,
  help: CircleHelp,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 16, className }: IconProps) {
  const Glyph = ICONS[name]
  return <Glyph aria-hidden="true" size={size} strokeWidth={1.75} className={className} />
}
