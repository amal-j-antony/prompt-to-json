import { describe, expect, it } from 'vitest'
import type { FieldId } from '../../shared/brief-docs'
import { DIRECTIVE_IDS, FIELD_SETS } from '../../shared/brief-docs'
import { docFromText, EMPTY_DOCS, type FieldDocs } from './docs'
import { docToItems, docToMarkdown } from './markdown'
import {
  applyPresetToDocs,
  PRESET_IDS,
  PRESETS,
  type BriefPreset,
  type PresetId,
} from './presets'

function preset(id: PresetId): BriefPreset {
  const found = PRESETS.find((item) => item.id === id)
  if (!found) throw new Error(`Missing preset: ${id}`)
  return found
}

function docs(overrides: Partial<FieldDocs> = {}): FieldDocs {
  return { ...EMPTY_DOCS, ...overrides }
}

describe('PRESETS', () => {
  it('lists presets in PRESET_IDS order with unique labels', () => {
    expect(PRESETS.map((item) => item.id)).toEqual([...PRESET_IDS])
    expect(new Set(PRESETS.map((item) => item.label)).size).toBe(PRESETS.length)
  })

  it('keeps descriptions and labels non-empty', () => {
    for (const item of PRESETS) {
      expect(item.label.trim()).not.toBe('')
      expect(item.description.trim()).not.toBe('')
    }
  })

  it('uses known directives and fields in the active set', () => {
    const directives = new Set(DIRECTIVE_IDS)
    for (const item of PRESETS) {
      for (const directive of item.directives) {
        expect(directives.has(directive)).toBe(true)
      }
      const active = new Set(FIELD_SETS[item.kind])
      for (const id of Object.keys(item.fields) as FieldId[]) {
        expect(active.has(id)).toBe(true)
      }
    }
  })
})

describe('applyPresetToDocs', () => {
  it('fills empty fields and sets the kind and directives', () => {
    const result = applyPresetToDocs(docs(), preset('small-bugfix'))

    expect(result.settings.kind).toBe('bug')
    expect(result.settings.directives).toEqual(['root-cause', 'prove-it', 'smallest-diff'])
    expect(docToMarkdown(result.docs.details)).toContain('Steps:')
    expect(docToItems(result.docs.verify)).toEqual(['Reproduce the bug, then run npm test'])
    expect(result.filled).toEqual(['details', 'nonGoals', 'verify'])
    expect(result.docs.goal).toEqual(EMPTY_DOCS.goal)
  })

  it('never overwrites a field that already has content', () => {
    const result = applyPresetToDocs(
      docs({ details: docFromText('Keep this detail') }),
      preset('feature-slice'),
    )

    expect(docToMarkdown(result.docs.details)).toBe('Keep this detail')
    expect(result.filled).not.toContain('details')
    expect(result.filled).toContain('constraints')
  })

  it('ignores fields outside the preset kind field set', () => {
    const base = preset('small-bugfix')
    const withHiddenField: BriefPreset = {
      ...base,
      fields: {
        ...base.fields,
        constraints: { kind: 'markdown', text: 'Hidden in bug mode' },
      },
    }

    const result = applyPresetToDocs(docs(), withHiddenField)

    expect(docToMarkdown(result.docs.constraints)).toBe('')
    expect(result.filled).not.toContain('constraints')
  })
})
