import type { DocNode, FieldId } from '../../shared/brief-docs'
import { docPlainText } from '../../shared/brief-docs'

function inlineText(node: DocNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  return (node.content ?? []).map(inlineText).join('')
}

function collectListLines(list: DocNode, lines: string[]): void {
  for (const item of list.content ?? []) {
    const own: string[] = []
    const nested: DocNode[] = []

    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        nested.push(child)
      } else if (child.type === 'paragraph' || child.type === 'heading') {
        own.push(inlineText(child))
      }
    }

    if (own.length > 0) lines.push(own.join(' '))
    for (const child of nested) collectListLines(child, lines)
  }
}

export function listLinesFromDoc(doc: DocNode): string[] {
  const lines: string[] = []

  for (const block of doc.content ?? []) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      lines.push(inlineText(block))
    } else if (block.type === 'bulletList' || block.type === 'orderedList') {
      collectListLines(block, lines)
    }
  }

  return lines.length > 0 ? lines : ['']
}

export function listDocFromLines(lines: string[]): DocNode {
  const content = lines.length > 0 ? lines : ['']

  return {
    type: 'doc',
    content: content.map((line) =>
      line.length > 0
        ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
        : { type: 'paragraph' },
    ),
  }
}

export function splitPastedList(text: string, id: FieldId): string[] {
  const parts = id === 'files' ? text.split(/[\n,;]+/) : text.split(/\r?\n/)
  const seen = new Set<string>()
  const items: string[] = []

  for (const part of parts) {
    const item = part.trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    items.push(item)
  }

  return items
}

export function listSummary(doc: DocNode): string {
  const lines = listLinesFromDoc(doc).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return ''

  const first = lines[0]?.trim() ?? ''
  return lines.length > 1 ? `${first} +${lines.length - 1} more` : first
}

export function fieldSummary(kind: 'markdown' | 'items', doc: DocNode): string {
  if (kind === 'items') return listSummary(doc)
  return docPlainText(doc).split('\n')[0]?.trim() ?? ''
}
