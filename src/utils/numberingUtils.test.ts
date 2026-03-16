import { describe, it, expect } from 'vitest'
import {
  getAnnexLabel,
  getEffectiveAnnexLabel,
  relabelAnnexes,
  normalizeNumberingStyle,
  generateLabels,
} from './numberingUtils'
import type { AnnexEntry } from '@/types'

// ─── normalizeNumberingStyle ──────────────────────────────────────────────────

describe('normalizeNumberingStyle', () => {
  it('converts n-prefix to numeric', () => {
    expect(normalizeNumberingStyle('n-prefix')).toBe('numeric')
  })

  it('leaves other styles unchanged', () => {
    expect(normalizeNumberingStyle('alpha-he')).toBe('alpha-he')
    expect(normalizeNumberingStyle('alpha-en')).toBe('alpha-en')
    expect(normalizeNumberingStyle('numeric')).toBe('numeric')
    expect(normalizeNumberingStyle('manual')).toBe('manual')
  })
})

// ─── getAnnexLabel ────────────────────────────────────────────────────────────

describe('getAnnexLabel — numeric', () => {
  it('returns 1-based labels', () => {
    expect(getAnnexLabel(0, 'numeric')).toBe('1')
    expect(getAnnexLabel(1, 'numeric')).toBe('2')
    expect(getAnnexLabel(9, 'numeric')).toBe('10')
  })

  it('respects startAt offset', () => {
    expect(getAnnexLabel(0, 'numeric', '5')).toBe('5')
    expect(getAnnexLabel(1, 'numeric', '5')).toBe('6')
  })
})

describe('getAnnexLabel — Hebrew alphabetic', () => {
  it('returns Hebrew letters in order', () => {
    expect(getAnnexLabel(0, 'alpha-he')).toBe('א')
    expect(getAnnexLabel(1, 'alpha-he')).toBe('ב')
    expect(getAnnexLabel(21, 'alpha-he')).toBe('ת')
  })

  it('wraps around after ת', () => {
    expect(getAnnexLabel(22, 'alpha-he')).toBe('אא')
  })
})

describe('getAnnexLabel — English alphabetic', () => {
  it('returns uppercase letters', () => {
    expect(getAnnexLabel(0, 'alpha-en')).toBe('A')
    expect(getAnnexLabel(1, 'alpha-en')).toBe('B')
    expect(getAnnexLabel(25, 'alpha-en')).toBe('Z')
  })

  it('wraps around after Z', () => {
    expect(getAnnexLabel(26, 'alpha-en')).toBe('AA')
  })

  it('respects startAt', () => {
    expect(getAnnexLabel(0, 'alpha-en', 'C')).toBe('C')
    expect(getAnnexLabel(1, 'alpha-en', 'C')).toBe('D')
  })
})

describe('getAnnexLabel — manual', () => {
  it('falls back to numeric', () => {
    expect(getAnnexLabel(0, 'manual')).toBe('1')
    expect(getAnnexLabel(2, 'manual')).toBe('3')
  })
})

// ─── getEffectiveAnnexLabel ───────────────────────────────────────────────────

describe('getEffectiveAnnexLabel', () => {
  const base = { label: '1', manualLabel: undefined }

  it('returns label when style is not manual', () => {
    expect(getEffectiveAnnexLabel(base, 'numeric')).toBe('1')
    expect(getEffectiveAnnexLabel(base, 'alpha-en')).toBe('1')
  })

  it('returns manualLabel when style is manual and manualLabel is set', () => {
    expect(getEffectiveAnnexLabel({ label: '1', manualLabel: 'א-1' }, 'manual')).toBe('א-1')
  })

  it('falls back to label when manualLabel is empty', () => {
    expect(getEffectiveAnnexLabel({ label: '1', manualLabel: '' }, 'manual')).toBe('1')
    expect(getEffectiveAnnexLabel({ label: '1', manualLabel: '   ' }, 'manual')).toBe('1')
  })
})

// ─── relabelAnnexes ───────────────────────────────────────────────────────────

function makeAnnex(id: string, overrides: Partial<AnnexEntry> = {}): AnnexEntry {
  return { id, documentId: id, label: '', description: '', subAnnexes: [], order: 0, ...overrides }
}

describe('relabelAnnexes', () => {
  it('assigns sequential numeric labels', () => {
    const annexes = [makeAnnex('a'), makeAnnex('b'), makeAnnex('c')]
    const result = relabelAnnexes(annexes, 'numeric')
    expect(result.map(a => a.label)).toEqual(['1', '2', '3'])
  })

  it('assigns sequential Hebrew labels', () => {
    const annexes = [makeAnnex('a'), makeAnnex('b')]
    const result = relabelAnnexes(annexes, 'alpha-he')
    expect(result.map(a => a.label)).toEqual(['א', 'ב'])
  })

  it('relabels sub-annexes continuously', () => {
    const annexes = [
      makeAnnex('a', { subAnnexes: [makeAnnex('a1'), makeAnnex('a2')] }),
      makeAnnex('b'),
    ]
    const result = relabelAnnexes(annexes, 'numeric')
    expect(result[0].label).toBe('1')
    expect(result[0].subAnnexes[0].label).toBe('2')
    expect(result[0].subAnnexes[1].label).toBe('3')
    expect(result[1].label).toBe('4')
  })

  it('uses numeric labels for manual style', () => {
    const annexes = [makeAnnex('a'), makeAnnex('b')]
    const result = relabelAnnexes(annexes, 'manual')
    expect(result.map(a => a.label)).toEqual(['1', '2'])
  })
})

// ─── generateLabels ───────────────────────────────────────────────────────────

describe('generateLabels', () => {
  it('generates the correct number of labels', () => {
    expect(generateLabels(5, 'numeric')).toHaveLength(5)
    expect(generateLabels(3, 'alpha-en')).toEqual(['A', 'B', 'C'])
  })

  it('returns empty array for count 0', () => {
    expect(generateLabels(0, 'numeric')).toEqual([])
  })
})
