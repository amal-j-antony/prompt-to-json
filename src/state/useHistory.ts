import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserDto } from '../../shared/api'
import type { BriefSettings } from '../../shared/brief-docs'
import type { FieldDocs } from '../brief/docs'
import {
  addEntry,
  HISTORY_KEY,
  HISTORY_LIMIT,
  parseHistory,
  serializeHistory,
  type HistoryEntry,
} from '../history/entry'
import {
  ApiError,
  clearHistory,
  deleteHistoryEntry,
  listHistory,
  saveHistory,
} from '../lib/api'

export type SaveOutcome = 'saved' | 'duplicate' | 'error'
export type HistorySource = 'browser' | 'account'

export const HISTORY_WRITE_ERROR = 'History is full. Delete an entry and try again.'
export const ACCOUNT_SAVE_ERROR = 'Save failed. Try again.'
const ACCOUNT_LOAD_ERROR = 'Could not load your saved briefs.'
const ACCOUNT_DELETE_ERROR = 'Could not delete that saved brief.'
const ACCOUNT_CLEAR_ERROR = 'Could not clear your saved briefs.'

export interface SaveOptions {
  onRetry?(attempt: number): void
}

export interface HistoryController {
  entries: HistoryEntry[]
  source: HistorySource
  loading: boolean
  saving: boolean
  error: string | null
  save(docs: FieldDocs, settings: BriefSettings, options?: SaveOptions): Promise<SaveOutcome>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

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

export function useHistory(user: UserDto | null, ready: boolean): HistoryController {
  const [entries, setEntries] = useState<HistoryEntry[]>(readHistory)
  const [source, setSource] = useState<HistorySource>('browser')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sourceRef = useRef<HistorySource>('browser')
  const requestRef = useRef(0)

  const applySource = useCallback((next: HistorySource) => {
    sourceRef.current = next
    setSource(next)
  }, [])

  useEffect(() => {
    if (!ready) return

    requestRef.current += 1
    const request = requestRef.current

    if (!user) {
      applySource('browser')
      setEntries(readHistory())
      setLoading(false)
      setError(null)
      return
    }

    applySource('account')
    setEntries([])
    setLoading(true)
    setError(null)

    void listHistory()
      .then((list) => {
        if (request !== requestRef.current) return
        setEntries(list)
        setLoading(false)
      })
      .catch(() => {
        if (request !== requestRef.current) return
        setLoading(false)
        setError(ACCOUNT_LOAD_ERROR)
      })
  }, [applySource, ready, user])

  const save = useCallback(
    async (
      docs: FieldDocs,
      settings: BriefSettings,
      options?: SaveOptions,
    ): Promise<SaveOutcome> => {
      if (user) {
        const request = requestRef.current
        setSaving(true)
        setError(null)

        try {
          const result = await saveHistory(docs, settings, options?.onRetry)
          if (request === requestRef.current && !result.duplicate) {
            setEntries((previous) =>
              [result.entry, ...previous.filter((entry) => entry.id !== result.entry.id)].slice(
                0,
                HISTORY_LIMIT,
              ),
            )
          }
          return result.duplicate ? 'duplicate' : 'saved'
        } catch {
          setError(ACCOUNT_SAVE_ERROR)
          return 'error'
        } finally {
          setSaving(false)
        }
      }

      const next = addEntry(entries, { id: newId(), savedAt: Date.now(), docs, settings })
      if (next === entries) return 'duplicate'

      if (!persistHistory(next)) {
        setError(HISTORY_WRITE_ERROR)
        return 'error'
      }

      setEntries(next)
      setError(null)
      return 'saved'
    },
    [entries, user],
  )

  const remove = useCallback(
    async (id: string) => {
      if (user) {
        const request = requestRef.current
        setError(null)

        try {
          await deleteHistoryEntry(id)
        } catch (cause) {
          const missing = cause instanceof ApiError && cause.status === 404
          if (!missing) {
            setError(ACCOUNT_DELETE_ERROR)
            return
          }
        }

        if (request === requestRef.current) {
          setEntries((previous) => previous.filter((entry) => entry.id !== id))
        }
        return
      }

      const next = entries.filter((entry) => entry.id !== id)
      if (!persistHistory(next)) {
        setError(HISTORY_WRITE_ERROR)
        return
      }

      setEntries(next)
      setError(null)
    },
    [entries, user],
  )

  const clear = useCallback(async () => {
    if (user) {
      const request = requestRef.current
      setError(null)

      try {
        await clearHistory()
      } catch {
        setError(ACCOUNT_CLEAR_ERROR)
        return
      }

      if (request === requestRef.current) setEntries([])
      return
    }

    const next: HistoryEntry[] = []
    if (!persistHistory(next)) {
      setError(HISTORY_WRITE_ERROR)
      return
    }

    setEntries(next)
    setError(null)
  }, [user])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (sourceRef.current !== 'browser') return
      if (event.key !== null && event.key !== HISTORY_KEY) return
      setEntries(readHistory())
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return { entries, source, loading, saving, error, save, remove, clear }
}
