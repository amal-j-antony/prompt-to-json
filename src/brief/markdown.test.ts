import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { docToItems, docToMarkdown, normalizePath } from './markdown'

function text(value: string, type: 'bold' | 'italic' | 'code' | null = null): JSONContent {
  return type ? { type: 'text', text: value, marks: [{ type }] } : { type: 'text', text: value }
}

function paragraph(...content: JSONContent[]): JSONContent {
  return { type: 'paragraph', content }
}

function item(markdown: string, ...nested: JSONContent[]): JSONContent {
  return {
    type: 'listItem',
    content: [paragraph(text(markdown)), ...nested],
  }
}

function bulletList(...items: JSONContent[]): JSONContent {
  return { type: 'bulletList', content: items }
}

function orderedList(...items: JSONContent[]): JSONContent {
  return { type: 'orderedList', content: items }
}

describe('docToMarkdown', () => {
  it('serializes marks, headings, lists, quotes, and hard breaks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Plan')] },
        paragraph(
          text('Make '),
          text('bold', 'bold'),
          text(' and '),
          text('italic', 'italic'),
          text(' with '),
          text('code', 'code'),
          { type: 'hardBreak' },
          text('second line'),
        ),
        bulletList(item('one', bulletList(item('nested'))), item('two')),
        orderedList(item('first'), item('second')),
        { type: 'blockquote', content: [paragraph(text('quoted'))] },
      ],
    }

    const expected = [
      '## Plan',
      'Make **bold** and _italic_ with `code`  \nsecond line',
      '- one\n  - nested\n- two',
      '1. first\n2. second',
      '> quoted',
    ].join('\n\n')

    expect(docToMarkdown(doc)).toBe(expected)
  })

  it('uses a double backtick fence for code that contains a backtick', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [paragraph(text('a`b', 'code'))],
    }

    expect(docToMarkdown(doc)).toBe('``a`b``')
  })
})

describe('docToItems', () => {
  it('flattens nested list items in order and drops empty paragraphs', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        paragraph(text('Intro')),
        paragraph(text('   ')),
        bulletList(
          item('one', bulletList(item('nested', bulletList(item('deep'))))),
          item('two'),
        ),
        orderedList(item('three')),
      ],
    }

    expect(docToItems(doc)).toEqual(['Intro', 'one', 'nested', 'deep', 'two', 'three'])
  })
})

describe('normalizePath', () => {
  it('strips list markers, backticks, quotes, and trailing punctuation', () => {
    expect(normalizePath('  `src/a.ts` , ')).toBe('src/a.ts')
    expect(normalizePath('"src/b.ts";')).toBe('src/b.ts')
    expect(normalizePath("- src/c.ts,")).toBe('src/c.ts')
    expect(normalizePath('1. src/d.ts')).toBe('src/d.ts')
    expect(normalizePath(" 'src/e.ts' ")).toBe('src/e.ts')
    expect(normalizePath('src   /  f.ts')).toBe('src / f.ts')
    expect(normalizePath(' , ')).toBe('')
  })
})
