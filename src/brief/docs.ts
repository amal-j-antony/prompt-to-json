import { emptyDoc, type DocNode, type FieldDocs } from '../../shared/brief-docs'

export type { DocNode, FieldDocs }

export { docsKey, emptyDoc, readDoc } from '../../shared/brief-docs'

export const EMPTY_DOCS: FieldDocs = {
  goal: emptyDoc(),
  done: emptyDoc(),
  details: emptyDoc(),
  nonGoals: emptyDoc(),
  constraints: emptyDoc(),
  files: emptyDoc(),
  verify: emptyDoc(),
  questions: emptyDoc(),
}

export function docFromText(text: string): DocNode {
  const lines = text.split('\n')

  return {
    type: 'doc',
    content: lines.map((line) =>
      line.length > 0
        ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
        : { type: 'paragraph' },
    ),
  }
}
