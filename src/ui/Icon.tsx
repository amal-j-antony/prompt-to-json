import {
  CircleHelp,
  FileCode2,
  Lock,
  Monitor,
  Moon,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react'
import type { IconName } from '../brief/registry'

const ICONS: Record<IconName, LucideIcon> = {
  target: Target,
  lock: Lock,
  file: FileCode2,
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
