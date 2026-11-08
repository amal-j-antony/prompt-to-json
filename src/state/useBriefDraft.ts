import type { JSONContent } from '@tiptap/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { FieldDocs } from '../brief/compile'
import { docToItems, docToMarkdown } from '../brief/markdown'
import { FIELD_REGISTRY, type FieldId } from '../brief/registry'

const DRAFT_KEY = 'prompt-studio.draft.v1'
const DRAFT_VERSION = 1
const SAVE_DELAY = 300

const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' }

export const EMPTY_DOCS: FieldDocs = {
  goal: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  constraints: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  files: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  questions: { type: 'doc', content: [EMPTY_PARAGRAPH] },
}

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

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'heading',
  'text',
  'hardBreak',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
])

const ALLOWED_MARK_TYPES = new Set(['bold', 'italic', 'code'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMark(value: unknown): boolean {
  return isRecord(value) && typeof value.type === 'string' && ALLOWED_MARK_TYPES.has(value.type)
}

function isJsonContent(value: unknown): value is JSONContent {
  if (!isRecord(value)) return false
  if (typeof value.type !== 'string' || !ALLOWED_NODE_TYPES.has(value.type)) return false
  if (value.text !== undefined && typeof value.text !== 'string') return false
  if (
    value.content !== undefined &&
    (!Array.isArray(value.content) || !value.content.every(isJsonContent))
  ) {
    return false
  }
  if (value.marks !== undefined && (!Array.isArray(value.marks) || !value.marks.every(isMark))) {
    return false
  }
  return true
}

function readDoc(value: unknown): JSONContent | null {
  if (!isJsonContent(value) || value.type !== 'doc') return null
  return value
}

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

  return { docs, setField, reset, resetToken, started }
}
