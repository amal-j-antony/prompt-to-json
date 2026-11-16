import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import type { BriefSettings } from '../../shared/brief-docs'
import { parseFieldDocs } from '../../shared/brief-docs'
import { compileBrief } from './compile'
import { DIRECTIVE_REGISTRY } from './directives'
import type { FieldDocs } from './docs'

function docWithText(value: string): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] }
}

function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function docs(overrides: Partial<FieldDocs> = {}): FieldDocs {
  return {
    goal: emptyDoc(),
    details: emptyDoc(),
    constraints: emptyDoc(),
    files: emptyDoc(),
    questions: emptyDoc(),
    ...overrides,
  }
}

function settings(overrides: Partial<BriefSettings> = {}): BriefSettings {
  return { kind: 'feature', directives: [], ...overrides }
}

describe('compileBrief', () => {
  it('returns ok with a feature payload when the goal is filled', () => {
    const result = compileBrief(docs({ goal: docWithText('Ship a theme toggle.') }), settings())

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.kind).toBe('feature')
    if (result.payload.kind !== 'feature') return

    expect(result.payload.goal).toBe('Ship a theme toggle.')
    expect(result.payload.schemaVersion).toBe('2.0')
    expect(result.issues).toEqual([])
    expect(result.json).toContain('"goal": "Ship a theme toggle."')
  })

  it('uses the issue key for a bug and drops goal entirely', () => {
    const result = compileBrief(
      docs({ goal: docWithText('Theme resets after reload.') }),
      settings({ kind: 'bug' }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.kind).toBe('bug')
    if (result.payload.kind !== 'bug') return

    expect(result.payload.issue).toBe('Theme resets after reload.')
    expect(result.json).toContain('"issue": "Theme resets after reload."')
    expect(result.json).not.toContain('"goal"')
  })

  it('keeps the payload keys in schema order', () => {
    const result = compileBrief(docs({ goal: docWithText('Ship it.') }), settings())
    expect(result.ok).toBe(true)

    expect(Object.keys(JSON.parse(result.json))).toEqual([
      'schemaVersion',
      'kind',
      'goal',
      'details',
      'constraints',
      'fileReferences',
      'openQuestions',
      'directives',
    ])
  })

  it('maps an empty goal to the goal field and keeps the candidate json', () => {
    const result = compileBrief(docs(), settings())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues.some((issue) => issue.field === 'goal')).toBe(true)
    expect(result.json).toContain('"goal": ""')
    expect(typeof result.json).toBe('string')
  })

  it('maps an empty issue to the goal field id', () => {
    const result = compileBrief(docs(), settings({ kind: 'bug' }))

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues).toEqual([
      { field: 'goal', message: 'Describe the issue before exporting.' },
    ])
    expect(result.json).toContain('"issue": ""')
  })

  it('lands details as markdown', () => {
    const result = compileBrief(
      docs({
        goal: docWithText('Ship it.'),
        details: docWithText('**Persists** across reloads.'),
      }),
      settings(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.details).toBe('**Persists** across reloads.')
  })

  it('maps directives to their sentences in registry order', () => {
    const result = compileBrief(
      docs({ goal: docWithText('Ship it.') }),
      settings({ directives: ['ask-first', 'plan'] }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const plan = DIRECTIVE_REGISTRY.find((directive) => directive.id === 'plan')
    const ask = DIRECTIVE_REGISTRY.find((directive) => directive.id === 'ask-first')
    expect(result.payload.directives).toEqual([plan?.text, ask?.text])
  })

  it('maps every directive to its sentence', () => {
    for (const directive of DIRECTIVE_REGISTRY) {
      const result = compileBrief(
        docs({ goal: docWithText('Ship it.') }),
        settings({ directives: [directive.id] }),
      )

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.payload.directives).toEqual([directive.text])
    }
  })

  it('compiles legacy four-field docs', () => {
    const legacy = parseFieldDocs({
      goal: docWithText('Ship it.'),
      constraints: emptyDoc(),
      files: emptyDoc(),
      questions: emptyDoc(),
    })
    expect(legacy).not.toBeNull()
    if (!legacy) return

    expect(compileBrief(legacy, settings()).ok).toBe(true)
  })

  it('normalizes and deduplicates file references', () => {
    const result = compileBrief(
      docs({
        goal: docWithText('Ship it.'),
        files: {
          type: 'doc',
          content: [
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: '`src/a.ts`' }] },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'src/a.ts' }] },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: '"src/b.ts",' }] },
                  ],
                },
              ],
            },
          ],
        },
      }),
      settings(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.fileReferences).toEqual(['src/a.ts', 'src/b.ts'])
  })
})
