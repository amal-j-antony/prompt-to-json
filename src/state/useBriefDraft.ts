import type { JSONContent } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  parseFieldDocs,
  parseSettings,
  type BriefSettings,
  type DirectiveId,
  type WorkKind,
} from '../../shared/brief-docs'
import { EMPTY_DOCS, type FieldDocs } from '../brief/docs'
import { applyPresetToDocs, type BriefPreset } from '../brief/presets'
import type { FieldId } from '../brief/registry'

const DRAFT_KEY = 'prompt-studio.draft.v2'
const LEGACY_DRAFT_KEY = 'prompt-studio.draft.v1'
const DRAFT_VERSION = 2
const SAVE_DELAY = 300

interface Draft {
  docs: FieldDocs
  settings: BriefSettings
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed)) return null
  if (parsed.version !== DRAFT_VERSION && parsed.version !== 1) return null

  const docs = parseFieldDocs(parsed.docs)
  if (!docs) return null

  return { docs, settings: parseSettings(parsed.settings) ?? DEFAULT_SETTINGS }
}

function readDraft(): Draft {
  const empty: Draft = { docs: EMPTY_DOCS, settings: DEFAULT_SETTINGS }

  try {
    const current = parseDraft(window.localStorage.getItem(DRAFT_KEY))
    if (current) return current

    const legacy = parseDraft(window.localStorage.getItem(LEGACY_DRAFT_KEY))
    return legacy ?? empty
  } catch {
    return empty
  }
}

function serializeDraft(draft: Draft): string {
  return JSON.stringify({ version: DRAFT_VERSION, docs: draft.docs, settings: draft.settings })
}

function writeDraft(draft: Draft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, serializeDraft(draft))
    window.localStorage.removeItem(LEGACY_DRAFT_KEY)
  } catch {
    return
  }
}

function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
    window.localStorage.removeItem(LEGACY_DRAFT_KEY)
  } catch {
    return
  }
}

function isDirty(draft: Draft): boolean {
  return (
    draft.docs !== EMPTY_DOCS ||
    draft.settings.kind !== DEFAULT_SETTINGS.kind ||
    draft.settings.directives.length > 0
  )
}

export function useBriefDraft(): {
  docs: FieldDocs
  settings: BriefSettings
  setField(id: FieldId, doc: JSONContent): void
  setKind(kind: WorkKind): void
  toggleDirective(id: DirectiveId): void
  replace(docs: FieldDocs, settings: BriefSettings): void
  applyPreset(preset: BriefPreset): { docs: FieldDocs; settings: BriefSettings }
  reset(): void
  resetToken: number
} {
  const [draft, setDraft] = useState<Draft>(readDraft)
  const [resetToken, setResetToken] = useState(0)
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const setField = useCallback((id: FieldId, doc: JSONContent) => {
    setDraft((previous) =>
      previous.docs[id] === doc
        ? previous
        : { ...previous, docs: { ...previous.docs, [id]: doc } },
    )
  }, [])

  const setKind = useCallback((kind: WorkKind) => {
    setDraft((previous) =>
      previous.settings.kind === kind
        ? previous
        : { ...previous, settings: { ...previous.settings, kind } },
    )
  }, [])

  const toggleDirective = useCallback((id: DirectiveId) => {
    setDraft((previous) => {
      const selected = previous.settings.directives
      const next = selected.includes(id)
        ? selected.filter((directive) => directive !== id)
        : [...selected, id]
      return { ...previous, settings: { ...previous.settings, directives: next } }
    })
  }, [])

  const replace = useCallback((docs: FieldDocs, settings: BriefSettings) => {
    setDraft({ docs, settings })
    setResetToken((token) => token + 1)
  }, [])

  const applyPreset = useCallback((preset: BriefPreset) => {
    const previous = draftRef.current
    const result = applyPresetToDocs(previous.docs, preset)
    setDraft({ docs: result.docs, settings: result.settings })
    setResetToken((token) => token + 1)
    return { docs: previous.docs, settings: previous.settings }
  }, [])

  const reset = useCallback(() => {
    clearDraft()
    setDraft({ docs: EMPTY_DOCS, settings: DEFAULT_SETTINGS })
    setResetToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (!isDirty(draft)) return

    const timer = window.setTimeout(() => writeDraft(draft), SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => {
    const flush = () => {
      const current = draftRef.current
      if (!isDirty(current)) return
      writeDraft(current)
    }

    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  return {
    docs: draft.docs,
    settings: draft.settings,
    setField,
    setKind,
    toggleDirective,
    replace,
    applyPreset,
    reset,
    resetToken,
  }
}
