/**
 * Shared color-name → hex map. Used wherever we want to render a swatch
 * for a free-text color string (Insights palette section, item cards,
 * placeholder seeds, etc.). Names match the detection palette in lib/detection.
 *
 * Unknown colors fall back to a deterministic muted hex so each unique
 * label still gets a stable, distinct swatch.
 */

const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: '#0a0a0a',
  white: '#f5f5f4',
  gray: '#808080',
  grey: '#808080',
  charcoal: '#37373c',
  red: '#c81e1e',
  maroon: '#6e1e1e',
  orange: '#f0821e',
  yellow: '#f0dc32',
  mustard: '#c8aa28',
  green: '#28a050',
  emerald: '#1f6845',
  olive: '#78824a',
  teal: '#288c8c',
  blue: '#3264c8',
  navy: '#141e5a',
  indigo: '#1a2e4a',
  sky: '#78b4e6',
  purple: '#783cb4',
  pink: '#f082b4',
  brown: '#78461e',
  tan: '#c8aa82',
  beige: '#dcc8aa',
  cream: '#f0e6c8',
  khaki: '#b4aa82',
  ivory: '#e8dec5',
  earth: '#7a5430',
  silver: '#c0c0c0',
  gold: '#d4af37',
}

function hashHex(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  // Bias toward muted, non-neon hues so placeholders look like clothing.
  const r = 60 + (Math.abs(h) % 140)
  const g = 60 + (Math.abs(h >> 8) % 140)
  const b = 60 + (Math.abs(h >> 16) % 140)
  return (
    '#' +
    [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  )
}

export function colorNameToHex(name?: string): string {
  if (!name) return '#26262a'
  const key = name.trim().toLowerCase()
  return COLOR_NAME_TO_HEX[key] ?? hashHex(key)
}
