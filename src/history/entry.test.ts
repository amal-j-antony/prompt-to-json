import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type BriefSettings } from '../../shared/brief-docs'
import { EMPTY_DOCS, type FieldDocs } from '../brief/docs'
import {
  addEntry,
  fieldCount,
  HISTORY_LIMIT,
  historyTitle,
  parseHistory,
  relativeTime,
  serializeHistory,
  type HistoryEntry,
} from './entry'

function text(value: string): JSONContent {
  return { type: 'text', text: value }
}

function paragraphDoc(value: string): JSONContent {
  return value
    ? { type: 'doc', content: [{ type: 'paragraph', content: [text(value)] }] }
    : { type: 'doc', content: [{ type: 'paragraph' }] }
}

function docs(overrides: Partial<FieldDocs> = {}): FieldDocs {
  return { ...EMPTY_DOCS, ...overrides }
}

function entry(
  id: string,
  savedAt: number,
  fieldDocs: FieldDocs = docs(),
  settings: BriefSettings = DEFAULT_SETTINGS,
): HistoryEntry {
  return { id, savedAt, docs: fieldDocs, settings }
}

function raw(entries: unknown[], version = 2): string {
  return JSON.stringify({ version, entries })
}

describe('historyTitle', () => {
  it('strips heading, list, and inline markers and truncates past 72 characters', () => {
    const heading: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [text('Plan the work')],
        },
      ],
    }
    expect(historyTitle(docs({ goal: heading }))).toBe('Plan the work')

    const list: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [text('First item')] }],
            },
          ],
        },
      ],
    }
    expect(historyTitle(docs({ goal: list }))).toBe('First item')

    const marked: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            text(' and '),
            { type: 'text', text: 'code', marks: [{ type: 'code' }] },
          ],
        },
      ],
    }
    expect(historyTitle(docs({ goal: marked }))).toBe('Bold and code')

    const long = historyTitle(docs({ goal: paragraphDoc('a'.repeat(80)) }))
    expect(long).toBe(`${'a'.repeat(72)}…`)
  })
})

describe('historyTitle empty goal', () => {
  it('returns Untitled brief', () => {
    expect(historyTitle(docs())).toBe('Untitled brief')
    expect(historyTitle(docs({ goal: paragraphDoc('   ') }))).toBe('Untitled brief')
  })
})

describe('relativeTime', () => {
  it('covers just now, minutes, hours, days, and the short date', () => {
    const now = new Date(2026, 2, 20, 12, 0, 0).getTime()

    expect(relativeTime(now - 10_000, now)).toBe('just now')
    expect(relativeTime(now - 44_999, now)).toBe('just now')
    expect(relativeTime(now - 45_000, now)).toBe('1 min ago')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 hr ago')
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2 days ago')
    expect(relativeTime(new Date(2026, 2, 4, 12, 0, 0).getTime(), now)).toBe('Mar 4')
  })
})

describe('parseHistory', () => {
  it('handles null and bad JSON, drops invalid entries, sorts newest first, and caps at 50', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory('{')).toEqual([])
    expect(parseHistory('{"version":3,"entries":[]}')).toEqual([])

    const older = entry('older', 1_000, docs({ goal: paragraphDoc('Older') }))
    const newer = entry('newer', 3_000, docs({ goal: paragraphDoc('Newer') }))
    const badSavedAt = { id: 'bad-time', savedAt: 'yesterday', docs: older.docs }
    const badDocs = {
      id: 'bad-docs',
      savedAt: 2_000,
      docs: { goal: paragraphDoc('Incomplete') },
    }

    const parsed = parseHistory(raw([older, badSavedAt, badDocs, newer]))
    expect(parsed.map((item) => item.id)).toEqual(['newer', 'older'])

    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, index) => entry(`e${index}`, index))
    const capped = parseHistory(raw(many))
    expect(capped).toHaveLength(HISTORY_LIMIT)
    expect(capped[0]?.id).toBe(`e${HISTORY_LIMIT + 4}`)
    expect(capped.at(-1)?.id).toBe('e5')
  })

  it('loads a version 1 entry with default settings', () => {
    const legacyEntry = {
      id: 'legacy',
      savedAt: 1_000,
      docs: {
        goal: paragraphDoc('Old brief'),
        constraints: paragraphDoc(''),
        files: paragraphDoc(''),
        questions: paragraphDoc(''),
      },
    }

    const parsed = parseHistory(raw([legacyEntry], 1))
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('defaults settings when an entry carries invalid settings', () => {
    const parsed = parseHistory(
      raw([{ id: 'odd', savedAt: 1_000, docs: docs(), settings: { kind: 'task', directives: [] } }]),
    )
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('round trips settings through serialize and parse', () => {
    const saved = entry('one', 1_000, docs({ goal: paragraphDoc('Ship it') }), {
      kind: 'bug',
      directives: ['plan', 'ask-first'],
    })

    expect(serializeHistory([saved])).toBe(JSON.stringify({ version: 2, entries: [saved] }))
    expect(parseHistory(serializeHistory([saved]))).toEqual([saved])
  })
})

describe('addEntry', () => {
  it('prepends, caps, and returns the same reference on a newest duplicate', () => {
    const first = entry('first', 1_000, docs({ goal: paragraphDoc('First') }))
    const second = entry('second', 2_000, docs({ goal: paragraphDoc('Second') }))

    expect(addEntry([first], second).map((item) => item.id)).toEqual(['second', 'first'])
    expect(addEntry([first], second, 1).map((item) => item.id)).toEqual(['second'])

    const entries = [first]
    const duplicate = entry('third', 3_000, first.docs)
    expect(addEntry(entries, duplicate)).toBe(entries)
  })

  it('treats a settings change as a new entry', () => {
    const first = entry('first', 1_000, docs({ goal: paragraphDoc('First') }))
    const changed = entry('second', 2_000, first.docs, { kind: 'bug', directives: ['plan'] })

    expect(addEntry([first], changed).map((item) => item.id)).toEqual(['second', 'first'])
  })
})

describe('fieldCount', () => {
  it('counts non-empty fields from zero to five', () => {
    expect(fieldCount(docs())).toBe(0)
    expect(fieldCount(docs({ goal: paragraphDoc('Ship it') }))).toBe(1)
    expect(
      fieldCount(
        docs({
          goal: paragraphDoc('Ship it'),
          details: paragraphDoc('Persists across reloads'),
          constraints: paragraphDoc('No dependencies'),
          files: paragraphDoc('src/App.tsx'),
          questions: paragraphDoc('Which icon set?'),
        }),
      ),
    ).toBe(5)
  })
})
