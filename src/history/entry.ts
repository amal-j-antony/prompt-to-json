import {
  briefKey,
  DEFAULT_SETTINGS,
  FIELD_SETS,
  parseFieldDocs,
  parseSettings,
  type BriefSettings,
  type FieldDocs,
  type WorkKind,
} from '../../shared/brief-docs'
import { docToMarkdown } from '../brief/markdown'

export const HISTORY_KEY = 'prompt-studio.history.v1'
export const HISTORY_LIMIT = 50

const HISTORY_VERSION = 2
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
  settings: BriefSettings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || value.id.length === 0) return null
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null

  const docs = parseFieldDocs(value.docs)
  if (!docs) return null

  return {
    id: value.id,
    savedAt: value.savedAt,
    docs,
    settings: parseSettings(value.settings) ?? DEFAULT_SETTINGS,
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

  if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return []
  if (parsed.version !== 1 && parsed.version !== HISTORY_VERSION) return []

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

export function isNewestDuplicate(
  entries: HistoryEntry[],
  docs: FieldDocs,
  settings: BriefSettings,
): boolean {
  const newest = entries[0]
  return newest !== undefined && briefKey(newest.docs, newest.settings) === briefKey(docs, settings)
}

export function addEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  limit = HISTORY_LIMIT,
): HistoryEntry[] {
  if (isNewestDuplicate(entries, entry.docs, entry.settings)) return entries
  return [entry, ...entries].slice(0, limit)
}

export function mergeHistory(
  existing: HistoryEntry[],
  incoming: HistoryEntry[],
  limit = HISTORY_LIMIT,
): HistoryEntry[] {
  const byId = new Map<string, HistoryEntry>()
  for (const entry of [...existing, ...incoming]) {
    const current = byId.get(entry.id)
    if (!current || entry.savedAt > current.savedAt) byId.set(entry.id, entry)
  }

  const byContent = new Map<string, HistoryEntry>()
  for (const entry of byId.values()) {
    const key = briefKey(entry.docs, entry.settings)
    const current = byContent.get(key)
    if (!current || entry.savedAt > current.savedAt) byContent.set(key, entry)
  }

  return [...byContent.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, limit)
}

export { historyTitle } from '../../shared/brief-docs'

export function relativeTime(savedAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - savedAt)

  if (elapsed < 45_000) return 'just now'
  if (elapsed < 3_600_000) {
    return `${Math.max(1, Math.floor(elapsed / 60_000))} min ago`
  }
  if (elapsed < 86_400_000) {
    return `${Math.floor(elapsed / 3_600_000)} hr ago`
  }
  if (elapsed < 604_800_000) {
    return `${Math.floor(elapsed / 86_400_000)} days ago`
  }

  const date = new Date(savedAt)
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`
}

export function fieldCount(docs: FieldDocs, kind: WorkKind = 'feature'): number {
  return FIELD_SETS[kind].filter((id) => docToMarkdown(docs[id]).trim().length > 0).length
}
