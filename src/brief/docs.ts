import type { JSONContent } from '@tiptap/core'
import type { FieldId } from './registry'

export type FieldDocs = Record<FieldId, JSONContent>

export const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' }

export const EMPTY_DOCS: FieldDocs = {
  goal: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  constraints: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  files: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  questions: { type: 'doc', content: [EMPTY_PARAGRAPH] },
}

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

export function readDoc(value: unknown): JSONContent | null {
  if (!isJsonContent(value) || value.type !== 'doc') return null
  return value
}

export function docsKey(docs: FieldDocs): string {
  return JSON.stringify(docs)
}
