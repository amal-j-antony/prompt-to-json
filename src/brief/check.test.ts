import { describe, expect, it } from 'vitest'
import type { BriefSettings } from '../../shared/brief-docs'
import { briefCheck } from './check'
import { EMPTY_DOCS, type FieldDocs } from './docs'

function text(value: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
  }
}

function docs(overrides: Partial<FieldDocs> = {}): FieldDocs {
  return { ...EMPTY_DOCS, ...overrides }
}

function settings(overrides: Partial<BriefSettings> = {}): BriefSettings {
  return { kind: 'feature', directives: [], ...overrides }
}

describe('briefCheck', () => {
  it('reports a thin brief when the goal is missing', () => {
    const result = briefCheck(docs(), settings())
    expect(result.status).toBe('thin')
    expect(result.passed).toBe(0)
    expect(result.total).toBe(5)
    expect(result.items.find((item) => item.id === 'goal')?.passed).toBe(false)
  })

  it('reports a good start when the goal is filled but proof is missing', () => {
    const result = briefCheck(docs({ goal: text('Ship it.') }), settings())
    expect(result.status).toBe('good')
    expect(result.passed).toBe(1)
  })

  it('reports a strong brief when every check passes', () => {
    const result = briefCheck(
      docs({
        goal: text('Ship it.'),
        done: text('Dark survives a reload.'),
        nonGoals: text('Do not add a theme editor.'),
        verify: text('npm test'),
        details: text('Persists across reloads.'),
      }),
      settings(),
    )
    expect(result.status).toBe('strong')
    expect(result.passed).toBe(5)
    expect(result.items.every((item) => item.passed)).toBe(true)
  })

  it('accepts files as context instead of details', () => {
    const result = briefCheck(
      docs({
        goal: text('Ship it.'),
        files: text('src/App.tsx'),
      }),
      settings(),
    )
    const context = result.items.find((item) => item.id === 'context')
    expect(context?.passed).toBe(true)
  })

  it('uses bug-mode labels', () => {
    const labels = briefCheck(docs(), settings({ kind: 'bug' })).items.map((item) => item.label)
    expect(labels).toContain('Issue is filled')
    expect(labels).toContain('Fixed when has at least one check')
    expect(labels).toContain('How to confirm has a command or step')
    expect(labels).toContain('Do not change lists what to leave alone')
  })
})
