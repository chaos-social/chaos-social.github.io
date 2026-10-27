import chroma from 'chroma-js'

import {generatePaletteFromColor} from '#/alf/util/material3'
import {getMaterialYouColor} from '#/alf/util/materialYou'
import {accentForeground} from './accentForeground'
import {DEFAULT_ACTIVE_THEME} from './catalog'
import {
  MATERIAL_YOU_STYLES,
  materialYouColorSets,
  materialYouRecord,
  resolveMaterialYouRecord,
} from './materialYou'
import {activeThemeToScheme} from './semanticTheme'
import {getColorSets} from './types'

describe.each(MATERIAL_YOU_STYLES)('Material You $label', ({name}) => {
  it.each(['#6750a4', '#ff0000', '#00ff00', '#0000ff', '#808080'])(
    'keeps tinted surfaces and readable accent text for %s',
    accent => {
      const source = generatePaletteFromColor(accent, name)
      const sets = materialYouColorSets(source)

      expect(sets.light.colors.canvas).toBe(
        getMaterialYouColor(source, 'system_neutral1', 50),
      )
      expect(sets.dark.colors.canvas).toBe(
        getMaterialYouColor(source, 'system_neutral1', 900),
      )
      for (const mode of ['light', 'dark'] as const) {
        const c = sets[mode].colors
        expect(c.canvas.toLowerCase()).not.toBe('#ffffff')
        expect(c.canvas.toLowerCase()).not.toBe('#000000')
        expect(new Set([c.canvas, c.surface, c.surfaceRaised]).size).toBe(3)
        for (const background of [c.canvas, c.surface, c.surfaceRaised]) {
          expect(chroma.contrast(c.text, background)).toBeGreaterThanOrEqual(4.5)
          expect(chroma.contrast(c.textMuted, background)).toBeGreaterThanOrEqual(
            4.5,
          )
        }
        expect(chroma.contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5)
      }
    },
  )
})

it.each([false, true])(
  'keeps readable filled buttons through runtime resolution (generated: %s)',
  generated => {
    const source = generatePaletteFromColor('#336699')
    const lightRecord = resolveMaterialYouRecord(
      materialYouRecord('light'),
      source,
      '#336699',
      generated,
    )
    const darkRecord = resolveMaterialYouRecord(
      materialYouRecord('dark'),
      source,
      '#336699',
      generated,
    )
    for (const {name: colorSet} of getColorSets(lightRecord)) {
      const scheme = activeThemeToScheme({
        light: {...DEFAULT_ACTIVE_THEME.light, record: lightRecord, colorSet},
        dark: {...DEFAULT_ACTIVE_THEME.dark, record: darkRecord, colorSet},
      })!
      for (const theme of [scheme.light, scheme.dark, scheme.dim]) {
        for (const background of [
          theme.palette.primary_500,
          theme.palette.primary_600,
        ]) {
          expect(
            chroma.contrast(accentForeground(theme, background), background),
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  },
)
