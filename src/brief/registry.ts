import type { FieldId, WorkKind } from '../../shared/brief-docs'
import type { ToolbarActionId } from '../editor/actions'

export type { FieldId, WorkKind }

export type PayloadKind = 'markdown' | 'items'
export type IconName =
  | 'target'
  | 'note'
  | 'lock'
  | 'file'
  | 'help'
  | 'sun'
  | 'moon'
  | 'monitor'

export interface FieldSpec {
  id: FieldId
  label: string
  hint: string
  placeholder: string
  icon: IconName
  kind: PayloadKind
  required: boolean
  toolbar: readonly ToolbarActionId[]
  badge: string
  bugLabel?: string
  bugHint?: string
  bugPlaceholder?: string
}

export const PAYLOAD_KEY: Record<WorkKind, Record<FieldId, string>> = {
  feature: {
    goal: 'goal',
    details: 'details',
    constraints: 'constraints',
    files: 'fileReferences',
    questions: 'openQuestions',
  },
  bug: {
    goal: 'issue',
    details: 'details',
    constraints: 'constraints',
    files: 'fileReferences',
    questions: 'openQuestions',
  },
}

export const KIND_REGISTRY: readonly { id: WorkKind; label: string }[] = [
  { id: 'feature', label: 'Feature' },
  { id: 'bug', label: 'Bug' },
]

export function fieldView(spec: FieldSpec, kind: WorkKind): FieldSpec {
  if (kind === 'feature') return spec

  return {
    ...spec,
    label: spec.bugLabel ?? spec.label,
    hint: spec.bugHint ?? spec.hint,
    placeholder: spec.bugPlaceholder ?? spec.placeholder,
  }
}

const FULL_TOOLBAR: readonly ToolbarActionId[] = [
  'bold',
  'italic',
  'code',
  'bulletList',
  'orderedList',
  'blockquote',
  'undo',
  'redo',
]

export const FIELD_REGISTRY: readonly FieldSpec[] = [
  {
    id: 'goal',
    label: 'Goal',
    hint: 'The one outcome the agent should deliver.',
    placeholder: 'Ship a dark-mode toggle for the settings page.',
    icon: 'target',
    kind: 'markdown',
    required: true,
    toolbar: FULL_TOOLBAR,
    badge: '01',
    bugLabel: 'Issue',
    bugHint: 'What is broken, and how it shows up.',
    bugPlaceholder: 'Theme resets to light after every reload.',
  },
  {
    id: 'details',
    label: 'Details',
    hint: 'Acceptance criteria, non-goals, and the edge cases that matter.',
    placeholder: 'Dark mode persists across reloads. Signed-out users keep the OS default.',
    icon: 'note',
    kind: 'markdown',
    required: false,
    toolbar: FULL_TOOLBAR,
    badge: '02',
    bugHint: 'Steps to reproduce, expected versus actual, and anything the repo cannot show.',
    bugPlaceholder: 'Steps: set dark, reload. Expected dark. Actual light. Chrome 138.',
  },
  {
    id: 'constraints',
    label: 'Constraints',
    hint: 'Stack, scope, and rules the agent must respect.',
    placeholder: 'Stay client-only. No new dependencies.',
    icon: 'lock',
    kind: 'markdown',
    required: false,
    toolbar: FULL_TOOLBAR,
    badge: '03',
  },
  {
    id: 'files',
    label: 'File references',
    hint: 'One path per line or bullet. Paths are deduplicated.',
    placeholder: 'src/state/useTheme.ts',
    icon: 'file',
    kind: 'items',
    required: false,
    toolbar: FULL_TOOLBAR,
    badge: '04',
  },
  {
    id: 'questions',
    label: 'Open questions',
    hint: 'Anything the agent should ask before it builds.',
    placeholder: 'Should the toggle follow the OS setting by default?',
    icon: 'help',
    kind: 'items',
    required: false,
    toolbar: FULL_TOOLBAR,
    badge: '05',
  },
]
