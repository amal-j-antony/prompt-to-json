import type { JSONContent } from '@tiptap/core'

const BLOCK_SEPARATOR = '\n\n'
const HARD_BREAK = '  \n'

function codeSpan(text: string): string {
  const fence = text.includes('`') ? '``' : '`'
  const pad = fence.length === 2 && (text.startsWith('`') || text.endsWith('`')) ? ' ' : ''
  return fence + pad + text + pad + fence
}

function applyMarks(text: string, marks: NonNullable<JSONContent['marks']>): string {
  let out = text
  if (marks.some((mark) => mark.type === 'code')) out = codeSpan(out)
  if (marks.some((mark) => mark.type === 'italic')) out = `_${out}_`
  if (marks.some((mark) => mark.type === 'bold')) out = `**${out}**`
  return out
}

function inlineMarkdown(node: JSONContent): string {
  if (node.type === 'text') return applyMarks(node.text ?? '', node.marks ?? [])
  if (node.type === 'hardBreak') return HARD_BREAK
  return (node.content ?? []).map(inlineMarkdown).join('')
}

function headingPrefix(node: JSONContent): string {
  const raw = node.attrs?.level
  const level = typeof raw === 'number' ? Math.min(Math.max(raw, 1), 3) : 1
  return `${'#'.repeat(level)} `
}

function indentLines(text: string, depth: number): string {
  const pad = '  '.repeat(depth)
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n')
}

function prefixQuote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n')
}

function listMarkdown(list: JSONContent, depth: number, ordered: boolean): string {
  const indent = '  '.repeat(depth)
  const lines: string[] = []

  for (const [index, item] of (list.content ?? []).entries()) {
    const marker = ordered ? `${index + 1}. ` : '- '
    const head: string[] = []
    const tail: string[] = []

    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        const nested = listMarkdown(child, depth + 1, child.type === 'orderedList')
        if (nested) tail.push(nested)
        continue
      }
      const text = blockMarkdown(child, depth + 1)
      if (!text) continue
      if (head.length === 0 && child.type === 'paragraph') head.push(text)
      else tail.push(indentLines(text, depth + 1))
    }

    lines.push([`${indent}${marker}${head.join(' ')}`.trimEnd(), ...tail].join('\n'))
  }

  return lines.join('\n')
}

function blockMarkdown(node: JSONContent, depth = 0): string {
  switch (node.type) {
    case 'paragraph':
      return inlineMarkdown(node)
    case 'heading':
      return headingPrefix(node) + inlineMarkdown(node)
    case 'bulletList':
      return listMarkdown(node, depth, false)
    case 'orderedList':
      return listMarkdown(node, depth, true)
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((child) => blockMarkdown(child, depth))
        .filter((text) => text.length > 0)
        .join(BLOCK_SEPARATOR)
      return prefixQuote(inner)
    }
    default:
      return ''
  }
}

export function docToMarkdown(doc: JSONContent): string {
  return (doc.content ?? [])
    .map((child) => blockMarkdown(child))
    .filter((text) => text.trim().length > 0)
    .join(BLOCK_SEPARATOR)
    .trim()
}

function collectListItems(list: JSONContent, out: string[]): void {
  for (const item of list.content ?? []) {
    const own: string[] = []
    const nested: JSONContent[] = []

    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        nested.push(child)
      } else if (child.type === 'paragraph' || child.type === 'heading') {
        const text = inlineMarkdown(child).trim()
        if (text) own.push(text)
      }
    }

    if (own.length > 0) out.push(own.join(' '))
    for (const child of nested) collectListItems(child, out)
  }
}

export function docToItems(doc: JSONContent): string[] {
  const items: string[] = []

  for (const block of doc.content ?? []) {
    if (block.type === 'paragraph') {
      const text = inlineMarkdown(block).trim()
      if (text) items.push(text)
    } else if (block.type === 'bulletList' || block.type === 'orderedList') {
      collectListItems(block, items)
    }
  }

  return items
}

export function normalizePath(value: string): string {
  let out = value.trim()
  out = out.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '').trim()
  out = out.replace(/[,;]+$/, '').trim()
  out = out.replace(/^[`'"]+/, '').replace(/[`'"]+$/, '').trim()
  out = out.replace(/[,;]+$/, '').trim()
  out = out.replace(/\s+/g, ' ')
  return out
}
