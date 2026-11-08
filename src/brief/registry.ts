import type { ToolbarActionId } from '../editor/actions'

export type FieldId = 'goal' | 'constraints' | 'files' | 'questions'
export type PayloadKind = 'markdown' | 'items'
export type IconName =
  | 'target'
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
}

export const PAYLOAD_KEY = {
  goal: 'goal',
  constraints: 'constraints',
  files: 'fileReferences',
  questions: 'openQuestions',
} as const

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
    badge: '02',
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
    badge: '03',
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
    badge: '04',
  },
]
