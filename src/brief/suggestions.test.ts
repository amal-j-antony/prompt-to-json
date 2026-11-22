import { describe, expect, it } from 'vitest'
import { suggestionFor } from './suggestions'

describe('suggestionFor', () => {
  it('returns feature starters for the checked fields', () => {
    expect(suggestionFor('goal', 'feature')).toContain('[outcome]')
    expect(suggestionFor('done', 'feature')).toBe('The change is visible in the UI.')
    expect(suggestionFor('verify', 'feature')).toBe('npm test')
    expect(suggestionFor('nonGoals', 'feature')).toBe('Do not change unrelated files.')
    expect(suggestionFor('details', 'feature')).toContain('Relevant files')
  })

  it('returns bug starters for the checked fields', () => {
    expect(suggestionFor('goal', 'bug')).toContain('[failure]')
    expect(suggestionFor('done', 'bug')).toBe('The failure no longer reproduces.')
    expect(suggestionFor('verify', 'bug')).toBe('Reproduce the bug, then run npm test.')
    expect(suggestionFor('nonGoals', 'bug')).toBe('Do not change the surrounding behavior.')
    expect(suggestionFor('details', 'bug')).toContain('Steps:')
  })

  it('returns null for fields without a starter', () => {
    expect(suggestionFor('files', 'feature')).toBeNull()
    expect(suggestionFor('questions', 'bug')).toBeNull()
    expect(suggestionFor('constraints', 'feature')).toBeNull()
  })
})
