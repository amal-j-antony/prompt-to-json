import type { JSONContent } from '@tiptap/core'
import type { FieldDocs } from './docs'
import { docToItems, docToMarkdown, normalizePath } from './markdown'
import { PAYLOAD_KEY, type FieldId } from './registry'
import { BRIEF_SCHEMA_VERSION, BriefSchema, type Brief } from './schema'

export interface FieldIssue {
  field: FieldId | null
  message: string
}

export type Compiled =
  | { ok: true; payload: Brief; json: string; issues: [] }
  | { ok: false; candidate: unknown; json: string; issues: FieldIssue[] }

const FIELD_IDS = Object.keys(PAYLOAD_KEY) as FieldId[]

function fieldForSegment(segment: PropertyKey | undefined): FieldId | null {
  if (typeof segment !== 'string') return null
  for (const id of FIELD_IDS) {
    if (PAYLOAD_KEY[id] === segment) return id
  }
  return null
}

function fileReferencesFrom(doc: JSONContent): string[] {
  const seen = new Set<string>()
  const paths: string[] = []

  for (const item of docToItems(doc)) {
    const path = normalizePath(item)
    if (!path || seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }

  return paths
}

export function compileBrief(docs: FieldDocs): Compiled {
  const candidate = {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    goal: docToMarkdown(docs.goal).trim(),
    constraints: docToMarkdown(docs.constraints).trim(),
    fileReferences: fileReferencesFrom(docs.files),
    openQuestions: docToItems(docs.questions),
  }

  const result = BriefSchema.safeParse(candidate)

  if (result.success) {
    return {
      ok: true,
      payload: result.data,
      json: JSON.stringify(result.data, null, 2),
      issues: [],
    }
  }

  return {
    ok: false,
    candidate,
    json: JSON.stringify(candidate, null, 2),
    issues: result.error.issues.map((issue) => ({
      field: fieldForSegment(issue.path[0]),
      message: issue.message,
    })),
  }
}
