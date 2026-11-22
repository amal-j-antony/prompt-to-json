import { describe, expect, it } from 'vitest'
import type { DocNode } from '../../shared/brief-docs'
import { fieldSummary, listDocFromLines, listLinesFromDoc, splitPastedList } from './list'

function paragraph(text: string): DocNode {
  return text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }
}

function doc(...content: DocNode[]): DocNode {
  return { type: 'doc', content }
}

function bulletList(...items: string[]): DocNode {
  return {
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  }
}

describe('listLinesFromDoc', () => {
  it('returns one line for an empty document', () => {
    expect(listLinesFromDoc(doc())).toEqual([''])
    expect(listLinesFromDoc(doc(paragraph('')))).toEqual([''])
  })

  it('preserves paragraph order and empty lines', () => {
    expect(listLinesFromDoc(doc(paragraph('One'), paragraph(''), paragraph('Two')))).toEqual([
      'One',
      '',
      'Two',
    ])
  })

  it('flattens bullet lists and nested items in document order', () => {
    const nested: DocNode = {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            paragraph('Parent'),
            {
              type: 'bulletList',
              content: [{ type: 'listItem', content: [paragraph('Child')] }],
            },
          ],
        },
        { type: 'listItem', content: [paragraph('Sibling')] },
      ],
    }

    expect(listLinesFromDoc(doc(nested))).toEqual(['Parent', 'Child', 'Sibling'])
    expect(listLinesFromDoc(doc(bulletList('First', 'Second')))).toEqual(['First', 'Second'])
  })

  it('strips inline marks and keeps the text', () => {
    const marked: DocNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and code', marks: [{ type: 'code' }] },
          ],
        },
      ],
    }

    expect(listLinesFromDoc(marked)).toEqual(['Bold and code'])
  })
})

describe('listDocFromLines', () => {
  it('round trips lines and preserves empty lines', () => {
    const lines = ['first', '', 'third']
    expect(listLinesFromDoc(listDocFromLines(lines))).toEqual(lines)
  })

  it('turns an empty list into one empty paragraph', () => {
    expect(listDocFromLines([])).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })
})

describe('splitPastedList', () => {
  it('splits newlines, trims, and dedupes', () => {
    expect(splitPastedList(' a \n a \n\n b ', 'done')).toEqual(['a', 'b'])
  })

  it('splits file references on commas and semicolons too', () => {
    expect(splitPastedList('src/a.ts, src/b.ts; src/c.ts\nsrc/a.ts', 'files')).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
    ])
  })

  it('keeps commas inside non-file items', () => {
    expect(splitPastedList('One, two and three', 'done')).toEqual(['One, two and three'])
  })

  it('returns an empty list for blank text', () => {
    expect(splitPastedList('  \n ', 'done')).toEqual([])
  })
})

describe('fieldSummary', () => {
  it('summarizes list items with a remainder count', () => {
    expect(fieldSummary('items', doc(bulletList('First', 'Second', 'Third')))).toBe(
      'First +2 more',
    )
    expect(fieldSummary('items', doc())).toBe('')
  })

  it('uses the first prose line', () => {
    expect(fieldSummary('markdown', doc(paragraph('Ship it.')))).toBe('Ship it.')
    expect(fieldSummary('markdown', doc())).toBe('')
  })
})
