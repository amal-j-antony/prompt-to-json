import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { compileBrief } from './compile'
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
    constraints: emptyDoc(),
    files: emptyDoc(),
    questions: emptyDoc(),
    ...overrides,
  }
}

describe('compileBrief', () => {
  it('returns ok with a payload when the goal is filled', () => {
    const result = compileBrief(docs({ goal: docWithText('Ship a theme toggle.') }))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.goal).toBe('Ship a theme toggle.')
    expect(result.payload.schemaVersion).toBe('1.0')
    expect(result.issues).toEqual([])
    expect(result.json).toContain('"goal": "Ship a theme toggle."')
  })

  it('maps an empty goal to the goal field and keeps the candidate json', () => {
    const result = compileBrief(docs())

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues.some((issue) => issue.field === 'goal')).toBe(true)
    expect(result.json).toContain('"goal": ""')
    expect(typeof result.json).toBe('string')
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
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.payload.fileReferences).toEqual(['src/a.ts', 'src/b.ts'])
  })
})
