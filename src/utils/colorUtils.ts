export interface ParsedColor {
  r: number
  g: number
  b: number
  a: number
}

const DEFAULT_ALPHA = 1

export function parseCssColor(
  value: string | null | undefined,
  fallback = '#FFFF00'
): ParsedColor {
  const input = value?.trim() || fallback

  const shortHex = input.match(/^#([0-9a-f]{3})$/i)
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('').map((ch) => parseInt(ch + ch, 16))
    return { r, g, b, a: DEFAULT_ALPHA }
  }

  const hex = input.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16),
      a: DEFAULT_ALPHA,
    }
  }

  const rgba = input.match(
    /^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/i
  )
  if (rgba) {
    return {
      r: clampChannel(Number(rgba[1])),
      g: clampChannel(Number(rgba[2])),
      b: clampChannel(Number(rgba[3])),
      a: clampAlpha(rgba[4] ? Number(rgba[4]) : DEFAULT_ALPHA),
    }
  }

  if (input !== fallback) return parseCssColor(fallback, '#FFFF00')

  return { r: 255, g: 255, b: 0, a: DEFAULT_ALPHA }
}

export function toCanvasRgba(
  value: string | null | undefined,
  alpha = 0.4,
  fallback = '#FFFF00'
): string {
  const { r, g, b, a } = parseCssColor(value, fallback)
  return `rgba(${r}, ${g}, ${b}, ${clampAlpha(a * alpha)})`
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ALPHA
  return Math.max(0, Math.min(1, value))
}
