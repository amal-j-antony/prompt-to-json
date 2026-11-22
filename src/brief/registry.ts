import type { FieldId, WorkKind } from '../../shared/brief-docs'
import { FIELD_SETS } from '../../shared/brief-docs'
import type { ToolbarActionId } from '../editor/actions'

export type { FieldId, WorkKind }

export type PayloadKind = 'markdown' | 'items'
export type IconName =
  | 'target'
  | 'check'
  | 'note'
  | 'slash'
  | 'lock'
  | 'file'
  | 'flask'
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
  bugLabel?: string
  bugHint?: string
  bugPlaceholder?: string
}

export const PAYLOAD_KEY: Record<WorkKind, Record<FieldId, string>> = {
  feature: {
    goal: 'goal',
    done: 'acceptanceCriteria',
    details: 'details',
    nonGoals: 'nonGoals',
    constraints: 'constraints',
    files: 'fileReferences',
    verify: 'verification',
    questions: 'openQuestions',
  },
  bug: {
    goal: 'issue',
    done: 'acceptanceCriteria',
    details: 'details',
    nonGoals: 'nonGoals',
    constraints: 'constraints',
    files: 'fileReferences',
    verify: 'verification',
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
    bugLabel: 'Issue',
    bugHint: 'What is broken, and how it shows up.',
    bugPlaceholder: 'Theme resets to light after every reload.',
  },
  {
    id: 'done',
    label: 'Done when',
    hint: 'Testable checks that prove the work is complete.',
    placeholder: 'Choosing dark survives a reload.',
    icon: 'check',
    kind: 'items',
    required: false,
    toolbar: FULL_TOOLBAR,
    bugLabel: 'Fixed when',
    bugHint: 'The observable behavior that proves the bug is fixed.',
    bugPlaceholder: 'Dark mode survives a reload after the fix.',
  },
  {
    id: 'details',
    label: 'Details',
    hint: 'Context, acceptance notes, and the edge cases that matter.',
    placeholder: 'Dark mode persists across reloads. Signed-out users keep the OS default.',
    icon: 'note',
    kind: 'markdown',
    required: false,
    toolbar: FULL_TOOLBAR,
    bugLabel: 'Repro and context',
    bugHint: 'Repro steps, expected versus actual, environment, and logs.',
    bugPlaceholder: 'Steps: set dark, reload. Expected dark. Actual light. Chrome 138.',
  },
  {
    id: 'nonGoals',
    label: 'Out of scope',
    hint: 'What the agent must not build, change, or refactor.',
    placeholder: 'Do not add a theme editor.',
    icon: 'slash',
    kind: 'items',
    required: false,
    toolbar: FULL_TOOLBAR,
    bugLabel: 'Do not change',
    bugHint: 'Behavior, files, or formats the fix must leave alone.',
    bugPlaceholder: 'Do not change the auth flow.',
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
    bugLabel: 'Suspect files',
    bugHint: 'Files to inspect first. One path per line or bullet.',
  },
  {
    id: 'verify',
    label: 'How to verify',
    hint: 'Commands or manual checks that prove it works.',
    placeholder: 'npm test',
    icon: 'flask',
    kind: 'items',
    required: false,
    toolbar: FULL_TOOLBAR,
    bugLabel: 'How to confirm',
    bugHint: 'Commands or steps that reproduce the bug and prove the fix.',
    bugPlaceholder: 'npm run verify:ui',
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
  },
]

const FIELD_BY_ID = new Map<FieldId, FieldSpec>(
  FIELD_REGISTRY.map((spec) => [spec.id, spec] as const),
)

export function fieldSpec(id: FieldId): FieldSpec {
  const spec = FIELD_BY_ID.get(id)
  if (!spec) throw new Error(`Unknown field: ${id}`)
  return spec
}

export function fieldSet(kind: WorkKind): readonly FieldSpec[] {
  return FIELD_SETS[kind].map((id) => fieldSpec(id))
}
