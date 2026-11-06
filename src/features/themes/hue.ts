import {chroma} from '#/platform/chroma-formats'
import  {type SemanticColors, type ThemeRecord} from './types'
import {isHueTheme} from './types'

const SHIFTED_ROLES: Array<keyof SemanticColors> = [
  'canvas',
  'surface',
  'surfaceRaised',
  'text',
  'textMuted',
  'border',
  'accent',
  'accentSoft',
  'onAccent',
]

function shiftColor(color: string, shift: number) {
  if (!shift) return color
  const value = chroma(color).oklch()
  if (!Number.isFinite(value[2])) return color
  return chroma.oklch(value[0], value[1], (value[2] + shift + 360) % 360).hex()
}

function shiftColors<T extends Partial<SemanticColors>>(
  colors: T,
  shift: number,
) {
  const next = {...colors}
  for (const role of SHIFTED_ROLES) {
    const color = next[role]
    if (color) next[role] = shiftColor(color, shift)
  }
  return next
}

export function resolveHueRecord(record: ThemeRecord, shift: number) {
  if (!isHueTheme(record) || !shift) return record
  return {
    ...record,
    base: {
      ...record.base,
      colors: shiftColors(record.base.colors, shift),
    },
    variants: record.variants?.map(variant => ({
      ...variant,
      colors: variant.colors
        ? shiftColors(variant.colors, shift)
        : variant.colors,
    })),
  }
}
