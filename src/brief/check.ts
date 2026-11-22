import type { BriefSettings, FieldId, WorkKind } from '../../shared/brief-docs'
import type { FieldDocs } from './docs'
import { fieldHasContent } from './markdown'
import { fieldSpec, fieldView } from './registry'

export type BriefCheckId = 'goal' | 'done' | 'verify' | 'scope' | 'context'
export type BriefCheckStatus = 'thin' | 'good' | 'strong'

export interface BriefCheckItem {
  id: BriefCheckId
  label: string
  passed: boolean
  field: FieldId
}

export interface BriefCheckResult {
  status: BriefCheckStatus
  passed: number
  total: number
  items: BriefCheckItem[]
}

function labelFor(kind: WorkKind, id: FieldId): string {
  return fieldView(fieldSpec(id), kind).label
}

export function briefCheck(docs: FieldDocs, settings: BriefSettings): BriefCheckResult {
  const kind = settings.kind
  const items: BriefCheckItem[] = [
    {
      id: 'goal',
      label: `${labelFor(kind, 'goal')} is filled`,
      passed: fieldHasContent('markdown', docs.goal),
      field: 'goal',
    },
    {
      id: 'done',
      label: `${labelFor(kind, 'done')} has at least one check`,
      passed: fieldHasContent('items', docs.done),
      field: 'done',
    },
    {
      id: 'verify',
      label: `${labelFor(kind, 'verify')} has a command or step`,
      passed: fieldHasContent('items', docs.verify),
      field: 'verify',
    },
    {
      id: 'scope',
      label: `${labelFor(kind, 'nonGoals')} lists what to leave alone`,
      passed: fieldHasContent('items', docs.nonGoals),
      field: 'nonGoals',
    },
    {
      id: 'context',
      label: 'Details or files give the agent context',
      passed:
        fieldHasContent('markdown', docs.details) || fieldHasContent('items', docs.files),
      field: 'details',
    },
  ]

  const passed = items.filter((item) => item.passed).length
  const goalPassed = items[0]?.passed === true
  const status: BriefCheckStatus = !goalPassed
    ? 'thin'
    : passed === items.length
      ? 'strong'
      : 'good'

  return { status, passed, total: items.length, items }
}
