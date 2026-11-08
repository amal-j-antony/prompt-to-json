import type { JSONContent } from '@tiptap/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { EMPTY_DOCS, readDoc, type FieldDocs } from '../brief/docs'
import { docToItems, docToMarkdown } from '../brief/markdown'
import { FIELD_REGISTRY, type FieldId } from '../brief/registry'

const DRAFT_KEY = 'prompt-studio.draft.v1'
const DRAFT_VERSION = 1
const SAVE_DELAY = 300

const StoredDraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  docs: z
    .object({
      goal: z.unknown(),
      constraints: z.unknown(),
      files: z.unknown(),
      questions: z.unknown(),
    })
    .partial(),
})

function readDraft(): string | null {
  try {
    return window.localStorage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
}

function writeDraft(docs: FieldDocs): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, serializeDraft(docs))
  } catch {
    return
  }
}

function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    return
  }
}

function loadDocs(): FieldDocs {
  try {
    const raw = readDraft()
    if (!raw) return EMPTY_DOCS

    const parsed = StoredDraftSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return EMPTY_DOCS

    return {
      goal: readDoc(parsed.data.docs.goal) ?? EMPTY_DOCS.goal,
      constraints: readDoc(parsed.data.docs.constraints) ?? EMPTY_DOCS.constraints,
      files: readDoc(parsed.data.docs.files) ?? EMPTY_DOCS.files,
      questions: readDoc(parsed.data.docs.questions) ?? EMPTY_DOCS.questions,
    }
  } catch {
    return EMPTY_DOCS
  }
}

function serializeDraft(docs: FieldDocs): string {
  return JSON.stringify({ version: DRAFT_VERSION, docs })
}

export function useBriefDraft(): {
  docs: FieldDocs
  setField(id: FieldId, doc: JSONContent): void
  replace(docs: FieldDocs): void
  reset(): void
  resetToken: number
  started: number
} {
  const [docs, setDocs] = useState<FieldDocs>(loadDocs)
  const [resetToken, setResetToken] = useState(0)
  const docsRef = useRef(docs)

  useEffect(() => {
    docsRef.current = docs
  }, [docs])

  const setField = useCallback((id: FieldId, doc: JSONContent) => {
    setDocs((previous) => (previous[id] === doc ? previous : { ...previous, [id]: doc }))
  }, [])

  const replace = useCallback((next: FieldDocs) => {
    setDocs(next)
    setResetToken((token) => token + 1)
  }, [])

  const reset = useCallback(() => {
    clearDraft()
    setDocs(EMPTY_DOCS)
    setResetToken((token) => token + 1)
  }, [])

  useEffect(() => {
    if (docs === EMPTY_DOCS) return

    const timer = window.setTimeout(() => writeDraft(docs), SAVE_DELAY)
    return () => window.clearTimeout(timer)
  }, [docs])

  useEffect(() => {
    const flush = () => {
      const current = docsRef.current
      if (current === EMPTY_DOCS) return
      writeDraft(current)
    }

    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  const started = useMemo(
    () =>
      FIELD_REGISTRY.reduce((count, spec) => {
        const doc = docs[spec.id]
        const text = spec.kind === 'markdown' ? docToMarkdown(doc) : docToItems(doc).join(' ')
        return text.trim().length > 0 ? count + 1 : count
      }, 0),
    [docs],
  )

  return { docs, setField, replace, reset, resetToken, started }
}
