import type { BriefSettings, FieldId, WorkKind } from '../../shared/brief-docs'
import { FIELD_IDS } from '../../shared/brief-docs'
import { directiveTexts } from './directives'
import type { DocNode, FieldDocs } from './docs'
import { docToItems, docToMarkdown, normalizePath } from './markdown'
import { PAYLOAD_KEY } from './registry'
import { BRIEF_SCHEMA_VERSION, BriefSchema, type Brief } from './schema'

export interface FieldIssue {
  field: FieldId | null
  message: string
}

export type Compiled =
  | { ok: true; payload: Brief; json: string; issues: [] }
  | { ok: false; candidate: unknown; json: string; issues: FieldIssue[] }

function fieldForSegment(kind: WorkKind, segment: PropertyKey | undefined): FieldId | null {
  if (typeof segment !== 'string') return null
  const keys = PAYLOAD_KEY[kind]
  for (const id of FIELD_IDS) {
    if (keys[id] === segment) return id
  }
  return null
}

function fileReferencesFrom(doc: DocNode): string[] {
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

export function compileBrief(docs: FieldDocs, settings: BriefSettings): Compiled {
  const keys = PAYLOAD_KEY[settings.kind]
  const candidate = {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    kind: settings.kind,
    [keys.goal]: docToMarkdown(docs.goal).trim(),
    details: docToMarkdown(docs.details).trim(),
    acceptanceCriteria: docToItems(docs.done),
    nonGoals: docToItems(docs.nonGoals),
    constraints: docToMarkdown(docs.constraints).trim(),
    fileReferences: fileReferencesFrom(docs.files),
    verification: docToItems(docs.verify),
    openQuestions: docToItems(docs.questions),
    directives: directiveTexts(settings.directives),
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
      field: fieldForSegment(settings.kind, issue.path[0]),
      message: issue.message,
    })),
  }
}
