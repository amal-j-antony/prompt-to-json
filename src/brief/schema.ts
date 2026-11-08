import { z } from 'zod'

export const BRIEF_SCHEMA_VERSION = '1.0' as const

export const BriefSchema = z
  .object({
    schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
    goal: z.string().min(1, 'Add a goal before exporting.'),
    constraints: z.string(),
    fileReferences: z.array(z.string().min(1)),
    openQuestions: z.array(z.string().min(1)),
  })
  .meta({
    id: 'AgentBrief',
    title: 'Agent brief',
    description: 'A structured brief for a coding agent.',
  })

export type Brief = z.infer<typeof BriefSchema>

export const briefJsonSchema = z.toJSONSchema(BriefSchema, {
  target: 'draft-2020-12',
  io: 'output',
})
