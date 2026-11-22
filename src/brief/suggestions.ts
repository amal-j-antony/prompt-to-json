import type { FieldId, WorkKind } from '../../shared/brief-docs'

export function suggestionFor(id: FieldId, kind: WorkKind): string | null {
  switch (id) {
    case 'goal':
      return kind === 'bug'
        ? 'When [action], [failure] happens; it should [expected].'
        : 'Ship [outcome] so [user] can [benefit].'
    case 'done':
      return kind === 'bug'
        ? 'The failure no longer reproduces.'
        : 'The change is visible in the UI.'
    case 'verify':
      return kind === 'bug'
        ? 'Reproduce the bug, then run npm test.'
        : 'npm test'
    case 'nonGoals':
      return kind === 'bug'
        ? 'Do not change the surrounding behavior.'
        : 'Do not change unrelated files.'
    case 'details':
      return kind === 'bug'
        ? 'Steps:\nExpected:\nActual:\nEnvironment:'
        : 'Relevant files, current behavior, and edge cases:'
    default:
      return null
  }
}
