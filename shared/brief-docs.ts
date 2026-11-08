export type FieldId = 'goal' | 'constraints' | 'files' | 'questions'

export type DocMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type DocNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: DocMark[]
}

export type FieldDocs = Record<FieldId, DocNode>

export const FIELD_IDS: readonly FieldId[] = ['goal', 'constraints', 'files', 'questions']

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
const MAX_DEPTH = 40
const TITLE_LIMIT = 72

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isShallowAttrs(value: unknown): boolean {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  if (keys.length > 8) return false
  return keys.every((key) => {
    const item = value[key]
    return (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    )
  })
}

function isMark(value: unknown): value is DocMark {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (!ALLOWED_MARK_TYPES.has(value.type)) return false
  if (value.attrs !== undefined && !isShallowAttrs(value.attrs)) return false
  return true
}

function isDocNode(value: unknown, depth = 0): value is DocNode {
  if (depth > MAX_DEPTH || !isRecord(value)) return false
  if (typeof value.type !== 'string' || !ALLOWED_NODE_TYPES.has(value.type)) return false
  if (value.text !== undefined && typeof value.text !== 'string') return false
  if (value.attrs !== undefined && !isShallowAttrs(value.attrs)) return false
  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) return false
    for (const child of value.content) {
      if (!isDocNode(child, depth + 1)) return false
    }
  }
  if (value.marks !== undefined) {
    if (!Array.isArray(value.marks) || !value.marks.every(isMark)) return false
  }
  return true
}

export function isDoc(value: unknown): value is DocNode {
  return isDocNode(value) && value.type === 'doc'
}

export function readDoc(value: unknown): DocNode | null {
  return isDoc(value) ? value : null
}

export function parseFieldDocs(value: unknown): FieldDocs | null {
  if (!isRecord(value)) return null

  const docs = {} as FieldDocs
  for (const id of FIELD_IDS) {
    const doc = readDoc(value[id])
    if (!doc) return null
    docs[id] = doc
  }
  return docs
}

export function docsKey(docs: FieldDocs): string {
  return JSON.stringify(docs)
}

function nodeText(node: DocNode, depth = 0): string {
  if (depth > MAX_DEPTH) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'

  const inner = (node.content ?? []).map((child) => nodeText(child, depth + 1))

  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return inner.join('')
    case 'listItem':
    case 'bulletList':
    case 'orderedList':
    case 'blockquote':
      return inner.join('\n')
    default:
      return inner.join('')
  }
}

export function docPlainText(doc: DocNode): string {
  return (doc.content ?? [])
    .map((node) => nodeText(node))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function historyTitle(docs: FieldDocs): string {
  const firstLine = docPlainText(docs.goal).split('\n')[0]?.trim() ?? ''
  if (!firstLine) return 'Untitled brief'
  if (firstLine.length <= TITLE_LIMIT) return firstLine
  return `${firstLine.slice(0, TITLE_LIMIT).trimEnd()}…`
}
