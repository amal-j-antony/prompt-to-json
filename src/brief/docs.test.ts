import { describe, expect, it } from 'vitest'
import { docsKey, EMPTY_DOCS, readDoc, type FieldDocs } from './docs'

function docs(goalText: string): FieldDocs {
  return {
    ...EMPTY_DOCS,
    goal: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: goalText }] }],
    },
  }
}

describe('docsKey', () => {
  it('is stable across equal documents and differs when a document changes', () => {
    expect(docsKey(docs('Ship it'))).toBe(docsKey(docs('Ship it')))
    expect(docsKey(docs('Ship it'))).not.toBe(docsKey(docs('Ship something else')))
  })
})

describe('readDoc', () => {
  it('accepts a doc and rejects other nodes or unknown marks', () => {
    expect(readDoc(EMPTY_DOCS.goal)).toEqual(EMPTY_DOCS.goal)
    expect(readDoc({ type: 'paragraph' })).toBeNull()
    expect(readDoc({ type: 'doc', content: [{ type: 'image' }] })).toBeNull()
    expect(
      readDoc({
        type: 'doc',
        content: [{ type: 'text', text: 'linked', marks: [{ type: 'link' }] }],
      }),
    ).toBeNull()
  })
})
