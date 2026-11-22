import { z } from 'zod'

export const BRIEF_SCHEMA_VERSION = '3.0' as const

const SHARED_FIELDS = {
  details: z.string(),
  acceptanceCriteria: z.array(z.string().min(1)),
  nonGoals: z.array(z.string().min(1)),
  constraints: z.string(),
  fileReferences: z.array(z.string().min(1)),
  verification: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
  directives: z.array(z.string().min(1)),
}

export const FeatureBriefSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    kind: z.literal('feature'),
    goal: z.string().min(1, 'Add a goal before exporting.'),
    ...SHARED_FIELDS,
  })
  .meta({ id: 'FeatureBrief', title: 'Feature brief' })

export const BugBriefSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    kind: z.literal('bug'),
    issue: z.string().min(1, 'Describe the issue before exporting.'),
    ...SHARED_FIELDS,
  })
  .meta({ id: 'BugBrief', title: 'Bug brief' })

export const BriefSchema = z
  .discriminatedUnion('kind', [FeatureBriefSchema, BugBriefSchema])
  .meta({
    id: 'AgentBrief',
    title: 'Agent brief',
    description: 'A structured brief for a coding agent.',
  })

export type Brief = z.infer<typeof BriefSchema>
export type FeatureBrief = z.infer<typeof FeatureBriefSchema>
export type BugBrief = z.infer<typeof BugBriefSchema>

export const briefJsonSchema = z.toJSONSchema(BriefSchema, {
  target: 'draft-2020-12',
  io: 'output',
})
