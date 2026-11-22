import type {
  BriefSettings,
  DirectiveId,
  FieldId,
  WorkKind,
} from '../../shared/brief-docs'
import { FIELD_SETS } from '../../shared/brief-docs'
import { docFromText, type FieldDocs } from './docs'
import { listDocFromLines } from './list'
import { fieldHasContent } from './markdown'
import { fieldSpec } from './registry'

export const PRESET_IDS = [
  'small-bugfix',
  'feature-slice',
  'refactor',
  'spike',
  'review',
] as const

export type PresetId = (typeof PRESET_IDS)[number]

export type PresetValue =
  | { kind: 'markdown'; text: string }
  | { kind: 'items'; items: readonly string[] }

export interface BriefPreset {
  id: PresetId
  label: string
  description: string
  kind: WorkKind
  directives: readonly DirectiveId[]
  fields: Partial<Record<FieldId, PresetValue>>
}

export interface PresetResult {
  docs: FieldDocs
  settings: BriefSettings
  filled: FieldId[]
}

export const PRESETS: readonly BriefPreset[] = [
  {
    id: 'small-bugfix',
    label: 'Small bugfix',
    description: 'Repro steps, root cause, a small fix, and proof.',
    kind: 'bug',
    directives: ['root-cause', 'prove-it', 'smallest-diff'],
    fields: {
      details: { kind: 'markdown', text: 'Steps:\nExpected:\nActual:\nEnvironment:' },
      nonGoals: { kind: 'items', items: ['Do not change unrelated behavior'] },
      verify: { kind: 'items', items: ['Reproduce the bug, then run npm test'] },
    },
  },
  {
    id: 'feature-slice',
    label: 'Feature slice',
    description: 'A focused feature with constraints and proof.',
    kind: 'feature',
    directives: ['prove-it', 'maintainable'],
    fields: {
      details: { kind: 'markdown', text: 'Current behavior:\nEdge cases:' },
      constraints: { kind: 'markdown', text: 'Stay in scope. No new dependencies.' },
      nonGoals: { kind: 'items', items: ['Do not refactor unrelated code'] },
      verify: { kind: 'items', items: ['npm test', 'npm run typecheck'] },
    },
  },
  {
    id: 'refactor',
    label: 'Refactor',
    description: 'Change the structure without changing behavior.',
    kind: 'feature',
    directives: ['smallest-diff', 'maintainable', 'prove-it'],
    fields: {
      details: { kind: 'markdown', text: 'Current structure:\nTarget structure:' },
      nonGoals: { kind: 'items', items: ['No behavior changes', 'No unrelated renames'] },
      verify: { kind: 'items', items: ['npm test', 'npm run typecheck'] },
    },
  },
  {
    id: 'spike',
    label: 'Spike',
    description: 'Answer a question without editing the app.',
    kind: 'feature',
    directives: ['plan', 'read-first'],
    fields: {
      details: { kind: 'markdown', text: 'Questions to answer:' },
      nonGoals: { kind: 'items', items: ['Do not edit application code'] },
      verify: { kind: 'items', items: ['Summarize findings with file references'] },
    },
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Review a change and report findings.',
    kind: 'feature',
    directives: ['read-first', 'smallest-diff'],
    fields: {
      details: { kind: 'markdown', text: 'Review the diff for:' },
      nonGoals: { kind: 'items', items: ['Do not change code unless asked'] },
      verify: { kind: 'items', items: ['List findings with file references'] },
    },
  },
]

export function applyPresetToDocs(docs: FieldDocs, preset: BriefPreset): PresetResult {
  const nextDocs = { ...docs }
  const filled: FieldId[] = []

  for (const id of FIELD_SETS[preset.kind]) {
    const value = preset.fields[id]
    if (!value) continue

    const spec = fieldSpec(id)
    if (fieldHasContent(spec.kind, docs[id])) continue

    nextDocs[id] =
      value.kind === 'items' ? listDocFromLines(value.items) : docFromText(value.text)
    filled.push(id)
  }

  return {
    docs: nextDocs,
    settings: { kind: preset.kind, directives: [...preset.directives] },
    filled,
  }
}
