import { describe, expect, it } from 'vitest'
import { FIELD_SETS } from '../../shared/brief-docs'
import { FIELD_REGISTRY, fieldSet, fieldSpec } from './registry'

describe('field registry', () => {
  it('returns the active specs in field-set order', () => {
    for (const kind of ['feature', 'bug'] as const) {
      expect(fieldSet(kind).map((spec) => spec.id)).toEqual([...FIELD_SETS[kind]])
    }
  })

  it('has a spec for every field id', () => {
    for (const spec of FIELD_REGISTRY) {
      expect(fieldSpec(spec.id)).toBe(spec)
    }
  })
})
