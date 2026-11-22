import { describe, expect, it } from 'vitest'
import {
  briefKey,
  DEFAULT_SETTINGS,
  DIRECTIVE_IDS,
  docsKey,
  FIELD_IDS,
  FIELD_SETS,
  historyTitle,
  parseFieldDocs,
  parseSettings,
} from './brief-docs'
import type { DocNode, FieldDocs } from './brief-docs'

function paragraph(text: string): DocNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function doc(...content: DocNode[]): DocNode {
  return { type: 'doc', content }
}

function validDocs(goalText: string): FieldDocs {
  return {
    goal: doc(paragraph(goalText)),
    done: doc(paragraph('Choosing dark survives a reload.')),
    details: doc(paragraph('Dark mode persists across reloads.')),
    nonGoals: doc(paragraph('Do not add a theme editor.')),
    constraints: doc(),
    files: doc(),
    verify: doc(paragraph('npm test')),
    questions: doc(),
  }
}

function v2Docs(goalText: string): Record<string, unknown> {
  return {
    goal: doc(paragraph(goalText)),
    details: doc(paragraph('Acceptance criteria.')),
    constraints: doc(),
    files: doc(),
    questions: doc(),
  }
}

function legacyDocs(goalText: string): Record<string, unknown> {
  return {
    goal: doc(paragraph(goalText)),
    constraints: doc(),
    files: doc(),
    questions: doc(),
  }
}

describe('FIELD_SETS', () => {
  it('uses every field in feature mode and a unique subset in bug mode', () => {
    expect([...FIELD_SETS.feature]).toEqual([...FIELD_IDS])

    const known = new Set(FIELD_IDS)
    expect(new Set(FIELD_SETS.bug).size).toBe(FIELD_SETS.bug.length)
    for (const id of FIELD_SETS.bug) {
      expect(known.has(id)).toBe(true)
    }
  })
})

describe('parseFieldDocs', () => {
  it('accepts a complete document set', () => {
    expect(parseFieldDocs(validDocs('Ship the feature'))).not.toBeNull()
  })

  it('fills every optional document when a legacy set omits them', () => {
    const parsed = parseFieldDocs(legacyDocs('Ship the feature'))
    expect(parsed).not.toBeNull()
    for (const id of ['details', 'done', 'nonGoals', 'verify'] as const) {
      expect(parsed?.[id]).toEqual(doc({ type: 'paragraph' }))
    }
  })

  it('keeps details and fills the v3 documents when a v2 set omits them', () => {
    const parsed = parseFieldDocs(v2Docs('Ship the feature'))
    expect(parsed).not.toBeNull()
    expect(parsed?.details).toEqual(doc(paragraph('Acceptance criteria.')))
    for (const id of ['done', 'nonGoals', 'verify'] as const) {
      expect(parsed?.[id]).toEqual(doc({ type: 'paragraph' }))
    }
  })

  it('returns fresh optional docs on each parse', () => {
    const first = parseFieldDocs(legacyDocs('Ship the feature'))
    const second = parseFieldDocs(legacyDocs('Ship the feature'))
    for (const id of ['details', 'done', 'nonGoals', 'verify'] as const) {
      expect(first?.[id]).not.toBe(second?.[id])
    }
  })

  it('rejects a missing legacy field', () => {
    const docs = legacyDocs('Ship the feature')
    delete docs.questions
    expect(parseFieldDocs(docs)).toBeNull()
  })

  it('rejects a root that is not a doc', () => {
    const docs = validDocs('Ship the feature')
    docs.goal = paragraph('not a doc')
    expect(parseFieldDocs(docs)).toBeNull()
  })

  it('rejects unknown node types', () => {
    const docs = validDocs('Ship the feature')
    docs.goal = doc({ type: 'script', text: 'alert(1)' })
    expect(parseFieldDocs(docs)).toBeNull()
  })

  it('rejects unknown mark types', () => {
    const docs = validDocs('Ship the feature')
    docs.goal = doc({
      type: 'paragraph',
      content: [{ type: 'text', text: 'link', marks: [{ type: 'link' }] }],
    })
    expect(parseFieldDocs(docs)).toBeNull()
  })

  it('rejects nested attributes and keeps shallow ones', () => {
    const docs = validDocs('Ship the feature')
    docs.goal = doc({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Plan' }],
    })
    expect(parseFieldDocs(docs)).not.toBeNull()

    docs.goal = doc({
      type: 'heading',
      attrs: { level: 2, nested: { deep: true } },
      content: [{ type: 'text', text: 'Plan' }],
    })
    expect(parseFieldDocs(docs)).toBeNull()
  })

  it('rejects non object input', () => {
    expect(parseFieldDocs(null)).toBeNull()
    expect(parseFieldDocs('docs')).toBeNull()
    expect(parseFieldDocs([])).toBeNull()
  })
})

describe('parseSettings', () => {
  it('accepts both kinds and defaults', () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual({ kind: 'feature', directives: [] })
    expect(parseSettings({ kind: 'bug', directives: ['plan', 'test-first'] })).toEqual({
      kind: 'bug',
      directives: ['plan', 'test-first'],
    })
  })

  it('dedupes directives in order', () => {
    expect(parseSettings({ kind: 'bug', directives: ['ask-first', 'plan', 'ask-first'] })).toEqual({
      kind: 'bug',
      directives: ['ask-first', 'plan'],
    })
  })

  it('round-trips every directive id', () => {
    for (const id of DIRECTIVE_IDS) {
      expect(parseSettings({ kind: 'bug', directives: [id] })).toEqual({
        kind: 'bug',
        directives: [id],
      })
    }
  })

  it('rejects an unknown kind, missing directives, and unknown directive ids', () => {
    expect(parseSettings({ kind: 'task', directives: [] })).toBeNull()
    expect(parseSettings({ kind: 'bug' })).toBeNull()
    expect(parseSettings({ kind: 'bug', directives: ['review'] })).toBeNull()
    expect(parseSettings({ kind: 'bug', directives: [7] })).toBeNull()
    expect(parseSettings(null)).toBeNull()
    expect(parseSettings('settings')).toBeNull()
  })
})

describe('historyTitle', () => {
  it('uses the first line of the goal', () => {
    expect(historyTitle(validDocs('Ship the feature'))).toBe('Ship the feature')
  })

  it('truncates long titles', () => {
    const title = historyTitle(validDocs('a'.repeat(200)))
    expect(title.length).toBe(73)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back when the goal is empty', () => {
    expect(historyTitle(validDocs(''))).toBe('Untitled brief')
    expect(historyTitle(validDocs('   '))).toBe('Untitled brief')
  })
})

describe('docsKey', () => {
  it('is stable for equal documents', () => {
    expect(docsKey(validDocs('Ship the feature'))).toBe(docsKey(validDocs('Ship the feature')))
  })

  it('differs for different documents', () => {
    expect(docsKey(validDocs('Ship the feature'))).not.toBe(docsKey(validDocs('Ship it later')))
  })
})

describe('briefKey', () => {
  it('is stable for equal docs and settings', () => {
    expect(briefKey(validDocs('Ship the feature'), DEFAULT_SETTINGS)).toBe(
      briefKey(validDocs('Ship the feature'), DEFAULT_SETTINGS),
    )
  })

  it('differs when only the settings differ', () => {
    const docs = validDocs('Ship the feature')
    expect(briefKey(docs, DEFAULT_SETTINGS)).not.toBe(briefKey(docs, { kind: 'bug', directives: [] }))
    expect(briefKey(docs, DEFAULT_SETTINGS)).not.toBe(
      briefKey(docs, { kind: 'feature', directives: ['plan'] }),
    )
  })
})
