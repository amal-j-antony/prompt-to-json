import { describe, expect, it } from 'vitest'
import { DIRECTIVE_IDS } from '../../shared/brief-docs'
import { DIRECTIVE_GROUPS, DIRECTIVE_REGISTRY, MAX_DIRECTIVE_LENGTH } from './directives'

describe('DIRECTIVE_REGISTRY', () => {
  it('lists directives in DIRECTIVE_IDS order', () => {
    expect(DIRECTIVE_REGISTRY.map((directive) => directive.id)).toEqual([...DIRECTIVE_IDS])
  })

  it('keeps ids, labels, and texts unique', () => {
    const ids = new Set(DIRECTIVE_REGISTRY.map((directive) => directive.id))
    const labels = new Set(DIRECTIVE_REGISTRY.map((directive) => directive.label))
    const texts = new Set(DIRECTIVE_REGISTRY.map((directive) => directive.text))
    expect(ids.size).toBe(DIRECTIVE_REGISTRY.length)
    expect(labels.size).toBe(DIRECTIVE_REGISTRY.length)
    expect(texts.size).toBe(DIRECTIVE_REGISTRY.length)
  })

  it('keeps every label and text non-empty', () => {
    for (const directive of DIRECTIVE_REGISTRY) {
      expect(directive.label.trim()).not.toBe('')
      expect(directive.text.trim()).not.toBe('')
    }
  })

  it('groups every directive and keeps both groups populated', () => {
    const groupIds = new Set(DIRECTIVE_GROUPS.map((group) => group.id))
    for (const directive of DIRECTIVE_REGISTRY) {
      expect(groupIds.has(directive.group)).toBe(true)
    }
    for (const group of DIRECTIVE_GROUPS) {
      expect(DIRECTIVE_REGISTRY.some((directive) => directive.group === group.id)).toBe(true)
    }
  })

  it('keeps every directive within the scannable length limit', () => {
    for (const directive of DIRECTIVE_REGISTRY) {
      expect(directive.text.length).toBeLessThanOrEqual(MAX_DIRECTIVE_LENGTH)
    }
  })
})
