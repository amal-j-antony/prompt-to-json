import { describe, expect, it } from 'vitest'
import { docsKey, historyTitle, parseFieldDocs } from './brief-docs'
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
    constraints: doc(),
    files: doc(),
    questions: doc(),
  }
}

describe('parseFieldDocs', () => {
  it('accepts a complete document set', () => {
    expect(parseFieldDocs(validDocs('Ship the feature'))).not.toBeNull()
  })

  it('rejects a missing field', () => {
    const docs: Record<string, unknown> = validDocs('Ship the feature')
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
