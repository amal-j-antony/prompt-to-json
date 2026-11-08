import { useCallback, useEffect, useState } from 'react'
import type { FieldDocs } from '../brief/docs'
import {
  addEntry,
  HISTORY_KEY,
  parseHistory,
  serializeHistory,
  type HistoryEntry,
} from '../history/entry'

export type SaveOutcome = 'saved' | 'duplicate' | 'error'

export const HISTORY_WRITE_ERROR = 'History is full. Delete an entry and try again.'

function readHistory(): HistoryEntry[] {
  try {
    return parseHistory(window.localStorage.getItem(HISTORY_KEY))
  } catch {
    return []
  }
}

function persistHistory(entries: HistoryEntry[]): boolean {
  try {
    window.localStorage.setItem(HISTORY_KEY, serializeHistory(entries))
    return true
  } catch {
    return false
  }
}

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function useHistory(): {
  entries: HistoryEntry[]
  save(docs: FieldDocs): SaveOutcome
  remove(id: string): void
  clear(): void
  error: string | null
} {
  const [entries, setEntries] = useState<HistoryEntry[]>(readHistory)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(
    (docs: FieldDocs): SaveOutcome => {
      const next = addEntry(entries, { id: newId(), savedAt: Date.now(), docs })
      if (next === entries) return 'duplicate'

      if (!persistHistory(next)) {
        setError(HISTORY_WRITE_ERROR)
        return 'error'
      }

      setEntries(next)
      setError(null)
      return 'saved'
    },
    [entries],
  )

  const remove = useCallback(
    (id: string) => {
      const next = entries.filter((entry) => entry.id !== id)
      if (!persistHistory(next)) {
        setError(HISTORY_WRITE_ERROR)
        return
      }

      setEntries(next)
      setError(null)
    },
    [entries],
  )

  const clear = useCallback(() => {
    const next: HistoryEntry[] = []
    if (!persistHistory(next)) {
      setError(HISTORY_WRITE_ERROR)
      return
    }

    setEntries(next)
    setError(null)
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== HISTORY_KEY) return
      setEntries(readHistory())
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return { entries, save, remove, clear, error }
}
