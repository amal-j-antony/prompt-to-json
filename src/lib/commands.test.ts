import { describe, expect, it } from 'vitest'
import { filterCommands, type CommandAction } from './commands'

const actions: CommandAction[] = [
  { id: 'goal', label: 'Go to Goal', hint: 'Field', run: () => {} },
  { id: 'copy', label: 'Copy JSON', hint: 'Output', keywords: 'clipboard', run: () => {} },
  { id: 'preset', label: 'Apply Small bugfix preset', hint: 'Preset', run: () => {} },
]

describe('filterCommands', () => {
  it('returns every command for an empty query', () => {
    expect(filterCommands(actions, '')).toEqual(actions)
    expect(filterCommands(actions, '   ')).toEqual(actions)
  })

  it('filters by label case-insensitively', () => {
    expect(filterCommands(actions, 'copy').map((action) => action.id)).toEqual(['copy'])
    expect(filterCommands(actions, 'GOAL').map((action) => action.id)).toEqual(['goal'])
  })

  it('filters by hint and keywords', () => {
    expect(filterCommands(actions, 'output').map((action) => action.id)).toEqual(['copy'])
    expect(filterCommands(actions, 'clipboard').map((action) => action.id)).toEqual(['copy'])
    expect(filterCommands(actions, 'preset').map((action) => action.id)).toEqual(['preset'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterCommands(actions, 'zzz')).toEqual([])
  })
})
