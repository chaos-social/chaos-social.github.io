import {type Theme} from '@bsky.app/alf'

import {chroma} from '#/platform/chroma-formats'

/** Stable hue across sessions and platforms, with tones adapted to the theme. */
export function verifierColor(did: string, theme: Theme): string {
  let hash = 2166136261
  for (const char of did) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  }
  const hue = (hash >>> 0) % 360
  const dark = theme.scheme === 'dark'
  const accentChroma = chroma(theme.palette.primary_500).oklch()[1]
  return chroma
    .oklch(dark ? 0.75 : 0.5, Math.min(0.16, Math.max(0.08, accentChroma)), hue)
    .hex()
}
