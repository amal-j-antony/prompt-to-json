import type { DirectiveId } from '../../shared/brief-docs'

export interface DirectiveSpec {
  id: DirectiveId
  label: string
  text: string
}

export const DIRECTIVE_REGISTRY: readonly DirectiveSpec[] = [
  {
    id: 'plan',
    label: 'Plan first',
    text: 'Create a plan only. Do not edit the codebase until the user approves the plan.',
  },
  {
    id: 'test-first',
    label: 'Test first',
    text: 'Write a failing test for the current behavior first, then make it pass, then re-run it.',
  },
  {
    id: 'ask-first',
    label: 'Ask first',
    text: 'Ask about anything ambiguous in the open questions before you build.',
  },
  {
    id: 'root-cause',
    label: 'Fix root cause',
    text: 'Investigate the root cause of this issue and implement a robust fix to ensure it does not recur. Address the underlying problem rather than applying a temporary workaround. Review related code paths, identify potential edge cases, and add appropriate safeguards and regression tests. Avoid unnecessary changes to unrelated functionality.',
  },
]

export function directiveTexts(ids: readonly DirectiveId[]): string[] {
  const selected = new Set(ids)
  return DIRECTIVE_REGISTRY.filter((directive) => selected.has(directive.id)).map(
    (directive) => directive.text,
  )
}
