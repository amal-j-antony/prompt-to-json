import { docsKey, readDoc, type FieldDocs } from '../brief/docs'
import { docToMarkdown } from '../brief/markdown'

export const HISTORY_KEY = 'prompt-studio.history.v1'
export const HISTORY_LIMIT = 50

const HISTORY_VERSION = 1
const TITLE_LIMIT = 72
const ELLIPSIS = '…'
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export interface HistoryEntry {
  id: string
  savedAt: number
  docs: FieldDocs
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null
  if (!isRecord(value.docs)) return null

  const goal = readDoc(value.docs.goal)
  const constraints = readDoc(value.docs.constraints)
  const files = readDoc(value.docs.files)
  const questions = readDoc(value.docs.questions)
  if (!goal || !constraints || !files || !questions) return null

  return {
    id: value.id,
    savedAt: value.savedAt,
    docs: { goal, constraints, files, questions },
  }
}

export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!isRecord(parsed) || parsed.version !== HISTORY_VERSION || !Array.isArray(parsed.entries)) {
    return []
  }

  const entries: HistoryEntry[] = []
  for (const value of parsed.entries) {
    const entry = readEntry(value)
    if (entry) entries.push(entry)
  }

  return entries.sort((a, b) => b.savedAt - a.savedAt).slice(0, HISTORY_LIMIT)
}

export function serializeHistory(entries: HistoryEntry[]): string {
  return JSON.stringify({ version: HISTORY_VERSION, entries })
}

export function isNewestDuplicate(entries: HistoryEntry[], docs: FieldDocs): boolean {
  const newest = entries[0]
  return newest !== undefined && docsKey(newest.docs) === docsKey(docs)
}

export function addEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  limit = HISTORY_LIMIT,
): HistoryEntry[] {
  if (isNewestDuplicate(entries, entry.docs)) return entries
  return [entry, ...entries].slice(0, limit)
}

export function historyTitle(docs: FieldDocs): string {
  const firstLine = docToMarkdown(docs.goal).split('\n')[0]
  const cleaned = firstLine
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/[*_`]/g, '')
    .trim()

  if (!cleaned) return 'Untitled brief'
  if (cleaned.length <= TITLE_LIMIT) return cleaned
  return `${cleaned.slice(0, TITLE_LIMIT).trimEnd()}${ELLIPSIS}`
}

export function relativeTime(savedAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - savedAt)

  if (elapsed < 45_000) return 'just now'
  if (elapsed < 3_600_000) {
    return `${Math.max(1, Math.floor(elapsed / 60_000))} min ago`
  }
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)} days ago`

  const date = new Date(savedAt)
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

export function fieldCount(docs: FieldDocs): number {
  return Object.values(docs).filter((doc) => docToMarkdown(doc).trim().length > 0).length
}
