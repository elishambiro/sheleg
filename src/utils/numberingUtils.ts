import type { AnnexEntry, AnnexNumberingStyle } from '@/types'

const HE_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת']
const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ']

export function normalizeNumberingStyle(style: AnnexNumberingStyle): AnnexNumberingStyle {
  return style === 'n-prefix' ? 'numeric' : style
}

export function getAnnexLabel(index: number, style: AnnexNumberingStyle, startAt?: string): string {
  const normalizedStyle = normalizeNumberingStyle(style)
  const offset = parseStartAt(startAt, normalizedStyle)
  const n = index + offset

  switch (normalizedStyle) {
    case 'alpha-he':
      return toAlphabeticLabel(n, HE_LETTERS)
    case 'alpha-en':
      return toAlphabeticLabel(n, EN_LETTERS)
    case 'alpha-ar':
      return toAlphabeticLabel(n, AR_LETTERS)
    case 'manual':
    case 'numeric':
    default:
      return String(n + 1)
  }
}

export function getEffectiveAnnexLabel(
  annex: Pick<AnnexEntry, 'label' | 'manualLabel'>,
  style: AnnexNumberingStyle
): string {
  if (normalizeNumberingStyle(style) !== 'manual') return annex.label
  const manualLabel = annex.manualLabel?.trim()
  return manualLabel || annex.label
}

export function relabelAnnexes(
  annexes: AnnexEntry[],
  style: AnnexNumberingStyle,
  startAt?: string
): AnnexEntry[] {
  let index = 0
  const normalizedStyle = normalizeNumberingStyle(style)
  const relabelStyle = normalizedStyle === 'manual' ? 'numeric' : normalizedStyle

  const visit = (entries: AnnexEntry[]): AnnexEntry[] =>
    entries.map((annex) => {
      const label = getAnnexLabel(index, relabelStyle, startAt)
      index += 1
      return {
        ...annex,
        label,
        subAnnexes: visit(annex.subAnnexes),
      }
    })

  return visit(annexes)
}

function parseStartAt(startAt: string | undefined, style: AnnexNumberingStyle): number {
  if (!startAt) return 0

  switch (normalizeNumberingStyle(style)) {
    case 'alpha-he':
      return parseAlphabeticStart(startAt, HE_LETTERS)
    case 'alpha-en':
      return parseAlphabeticStart(startAt.toUpperCase(), EN_LETTERS)
    case 'alpha-ar':
      return parseAlphabeticStart(startAt, AR_LETTERS)
    case 'manual':
    case 'numeric': {
      const n = parseInt(startAt, 10)
      return Number.isNaN(n) ? 0 : Math.max(0, n - 1)
    }
    default:
      return 0
  }
}

function parseAlphabeticStart(value: string, alphabet: string[]): number {
  const chars = Array.from(value.trim())
  if (chars.length === 0) return 0

  let result = 0
  for (const char of chars) {
    const idx = alphabet.indexOf(char)
    if (idx === -1) return 0
    result = result * alphabet.length + idx + 1
  }

  return Math.max(0, result - 1)
}

function toAlphabeticLabel(index: number, alphabet: string[]): string {
  let n = index + 1
  let result = ''

  while (n > 0) {
    n -= 1
    result = alphabet[n % alphabet.length] + result
    n = Math.floor(n / alphabet.length)
  }

  return result
}

export function generateLabels(count: number, style: AnnexNumberingStyle, startAt?: string): string[] {
  return Array.from({ length: count }, (_, i) => getAnnexLabel(i, style, startAt))
}
