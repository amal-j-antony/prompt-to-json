import { describe, expect, it } from 'vitest'
import { BRIEF_SCHEMA_VERSION, BriefSchema, briefJsonSchema } from './schema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const SHARED_BRIEF = {
  schemaVersion: BRIEF_SCHEMA_VERSION,
  details: 'Dark mode persists across reloads.',
  constraints: '',
  fileReferences: ['src/state/useTheme.ts'],
  openQuestions: ['Should it follow the OS?'],
  directives: [],
}

describe('brief schema', () => {
  it('emits a draft 2020-12 schema with an AgentBrief union of both kinds', () => {
    const schema: unknown = JSON.parse(JSON.stringify(briefJsonSchema))
    expect(isRecord(schema)).toBe(true)
    if (!isRecord(schema)) return

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.$ref).toBe('#/$defs/AgentBrief')

    const definitions = schema.$defs
    expect(isRecord(definitions)).toBe(true)
    if (!isRecord(definitions)) return

    const brief = definitions.AgentBrief
    expect(isRecord(brief)).toBe(true)
    if (!isRecord(brief)) return
    expect(brief.oneOf).toEqual([
      { $ref: '#/$defs/FeatureBrief' },
      { $ref: '#/$defs/BugBrief' },
    ])

    const feature = definitions.FeatureBrief
    const bug = definitions.BugBrief
    expect(isRecord(feature)).toBe(true)
    expect(isRecord(bug)).toBe(true)
    if (!isRecord(feature) || !isRecord(bug)) return

    const featureProperties = feature.properties
    const bugProperties = bug.properties
    expect(isRecord(featureProperties)).toBe(true)
    expect(isRecord(bugProperties)).toBe(true)
    if (!isRecord(featureProperties) || !isRecord(bugProperties)) return

    expect(featureProperties.goal).toEqual({ type: 'string', minLength: 1 })
    expect(bugProperties.issue).toEqual({ type: 'string', minLength: 1 })
    expect(featureProperties.details).toEqual({ type: 'string' })
    expect(featureProperties.directives).toEqual({
      type: 'array',
      items: { type: 'string', minLength: 1 },
    })
    expect(feature.required).toContain('details')
    expect(feature.required).not.toContain('issue')
    expect(bug.required).not.toContain('goal')
  })

  it('parses both kinds and rejects an empty goal on the goal path', () => {
    expect(BriefSchema.safeParse({ ...SHARED_BRIEF, kind: 'feature', goal: 'Ship it.' }).success).toBe(
      true,
    )
    expect(
      BriefSchema.safeParse({ ...SHARED_BRIEF, kind: 'bug', issue: 'Theme resets.' }).success,
    ).toBe(true)

    const invalid = BriefSchema.safeParse({ ...SHARED_BRIEF, kind: 'feature', goal: '' })
    expect(invalid.success).toBe(false)
    if (invalid.success) return

    expect(invalid.error.issues[0]?.path).toEqual(['goal'])
    expect(invalid.error.issues[0]?.message).toBe('Add a goal before exporting.')
  })

  it('rejects an empty issue on the issue path with the bug message', () => {
    const invalid = BriefSchema.safeParse({ ...SHARED_BRIEF, kind: 'bug', issue: '' })
    expect(invalid.success).toBe(false)
    if (invalid.success) return

    expect(invalid.error.issues[0]?.path).toEqual(['issue'])
    expect(invalid.error.issues[0]?.message).toBe('Describe the issue before exporting.')
  })
})
