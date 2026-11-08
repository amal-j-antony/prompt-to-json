import type { DocNode, FieldDocs } from '../../shared/brief-docs'

export type { DocNode, FieldDocs }
export { docsKey, readDoc } from '../../shared/brief-docs'

export const EMPTY_PARAGRAPH: DocNode = { type: 'paragraph' }

export const EMPTY_DOCS: FieldDocs = {
  goal: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  constraints: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  files: { type: 'doc', content: [EMPTY_PARAGRAPH] },
  questions: { type: 'doc', content: [EMPTY_PARAGRAPH] },
}
