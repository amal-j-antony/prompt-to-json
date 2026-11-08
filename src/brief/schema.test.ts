import { describe, expect, it } from 'vitest'
import { BRIEF_SCHEMA_VERSION, BriefSchema, briefJsonSchema } from './schema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

describe('brief schema', () => {
  it('emits a draft 2020-12 schema with an AgentBrief definition and a non-empty goal', () => {
    const schema: unknown = JSON.parse(JSON.stringify(briefJsonSchema))
    expect(isRecord(schema)).toBe(true)
    if (!isRecord(schema)) return

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')

    const definitions = schema.$defs
    expect(isRecord(definitions)).toBe(true)
    if (!isRecord(definitions)) return

    const definition = definitions.AgentBrief
    expect(isRecord(definition)).toBe(true)
    if (!isRecord(definition)) return

    const properties = definition.properties
    expect(isRecord(properties)).toBe(true)
    if (!isRecord(properties)) return

    const goal = properties.goal
    expect(isRecord(goal)).toBe(true)
    if (!isRecord(goal)) return

    expect(goal.minLength).toBe(1)
  })

  it('parses a valid brief and rejects an empty goal on the goal path', () => {
    const brief = {
      schemaVersion: BRIEF_SCHEMA_VERSION,
      goal: 'Ship the dark-mode toggle.',
      constraints: '',
      fileReferences: ['src/state/useTheme.ts'],
      openQuestions: ['Should it follow the OS?'],
    }

    expect(BriefSchema.safeParse(brief).success).toBe(true)

    const invalid = BriefSchema.safeParse({ ...brief, goal: '' })
    expect(invalid.success).toBe(false)
    if (invalid.success) return

    expect(invalid.error.issues[0]?.path).toEqual(['goal'])
    expect(invalid.error.issues[0]?.message).toBe('Add a goal before exporting.')
  })
})
