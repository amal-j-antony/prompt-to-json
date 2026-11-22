import type { DirectiveId } from '../../shared/brief-docs'

export type DirectiveGroup = 'process' | 'guardrails'

export interface DirectiveSpec {
  id: DirectiveId
  group: DirectiveGroup
  label: string
  text: string
}

export const DIRECTIVE_GROUPS: readonly { id: DirectiveGroup; label: string }[] = [
  { id: 'process', label: 'Process' },
  { id: 'guardrails', label: 'Guardrails' },
]

export const MAX_DIRECTIVE_LENGTH = 160

export const DIRECTIVE_REGISTRY: readonly DirectiveSpec[] = [
  {
    id: 'plan',
    group: 'process',
    label: 'Plan first',
    text: 'Create a plan only. Do not edit the codebase until the user approves the plan.',
  },
  {
    id: 'read-first',
    group: 'process',
    label: 'Read first',
    text: 'Read the files and patterns this change touches before editing. Match the conventions you find.',
  },
  {
    id: 'ask-first',
    group: 'process',
    label: 'Ask first',
    text: 'Ask about anything ambiguous in the open questions before you build.',
  },
  {
    id: 'test-first',
    group: 'process',
    label: 'Test first',
    text: 'Write a failing test for the current behavior first, then make it pass, then re-run it.',
  },
  {
    id: 'prove-it',
    group: 'process',
    label: 'Prove it',
    text: 'Run the build, tests, and verification steps. Report the exact commands and results, and say what you could not verify.',
  },
  {
    id: 'smallest-diff',
    group: 'guardrails',
    label: 'Smallest diff',
    text: 'Make the smallest change that satisfies the brief. Do not refactor, rename, or reformat unrelated code.',
  },
  {
    id: 'no-new-deps',
    group: 'guardrails',
    label: 'No new deps',
    text: 'Do not add dependencies, tools, or services unless the brief asks for them.',
  },
  {
    id: 'root-cause',
    group: 'guardrails',
    label: 'Fix root cause',
    text: 'Find and fix the root cause, not the symptom. Add a regression test and check related paths.',
  },
  {
    id: 'maintainable',
    group: 'guardrails',
    label: 'Keep it maintainable',
    text: 'Match existing patterns and stay in scope. Prefer simple code, reuse helpers, and avoid new abstractions or dependencies.',
  },
]

export function directiveTexts(ids: readonly DirectiveId[]): string[] {
  const selected = new Set(ids)
  return DIRECTIVE_REGISTRY.filter((directive) => selected.has(directive.id)).map(
    (directive) => directive.text,
  )
}
