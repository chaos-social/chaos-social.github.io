import {type MaterialYouPalette} from '@assembless/react-native-material-you'

import {
  generatePaletteFromColor,
  type GenerationStyle,
} from '#/alf/util/material3'
import {getMaterial3Colors} from '#/alf/util/material3Theme'
import {getMaterialYouColor} from '#/alf/util/materialYou'
import {
  isMaterialYouTheme,
  MATERIAL_YOU_SPECIAL,
  type SemanticColors,
  type ThemeColorSet,
  type ThemeMode,
  type ThemeRecord,
} from './types'

export const MATERIAL_YOU_STYLES: {
  name: GenerationStyle
  label: string
}[] = [
  {name: 'TONAL_SPOT', label: 'Tonal Spot'},
  {name: 'VIBRANT', label: 'Vibrant'},
  {name: 'EXPRESSIVE', label: 'Expressive'},
  {name: 'SPRITZ', label: 'Spritz'},
  {name: 'RAINBOW', label: 'Rainbow'},
  {name: 'FRUIT_SALAD', label: 'Fruit Salad'},
  {name: 'CONTENT', label: 'Content'},
  {name: 'MONOCHROMATIC', label: 'Mono'},
]

export function materialYouColorSets(source: MaterialYouPalette): {
  light: ThemeColorSet
  dark: ThemeColorSet
} {
  const palette = getMaterial3Colors(source).regular
  /*
   * Neutral endpoints are pure white and black. Use interior surface tones to
   * retain the wallpaper tint, and pair primary tones 40/100 and 80/20 for
   * readable filled controls in light and dark mode respectively.
   */
  return {
    light: {
      name: 'Material You',
      colors: {
        canvas: getMaterialYouColor(source, 'system_neutral1', 50),
        surface: palette.contrast_50,
        surfaceRaised: getMaterialYouColor(source, 'system_neutral1', 10),
        text: palette.contrast_1000,
        textMuted: palette.contrast_600,
        border: palette.contrast_200,
        accent: palette.primary_600,
        accentSoft: palette.primary_100,
        onAccent: palette.contrast_0,
        positive: palette.positive_500,
        warning: palette.yellow,
        critical: palette.negative_500,
        favorite: palette.like,
      },
    },
    dark: {
      name: 'Material You',
      colors: {
        canvas: palette.contrast_950,
        surface: palette.contrast_900,
        surfaceRaised: palette.contrast_800,
        text: palette.contrast_0,
        textMuted: palette.contrast_300,
        border: palette.contrast_800,
        accent: palette.primary_200,
        accentSoft: palette.primary_700,
        onAccent: palette.primary_800,
        positive: palette.positive_400,
        warning: palette.yellow,
        critical: palette.negative_400,
        favorite: palette.like,
      },
    },
  }
}

function overrides(base: SemanticColors, colors: SemanticColors) {
  return Object.fromEntries(
    Object.entries(colors).filter(
      ([key, value]) => base[key as keyof SemanticColors] !== value,
    ),
  ) as Partial<SemanticColors>
}

export function materialYouRecord(
  mode: ThemeMode,
  accent = '#6750a4',
): ThemeRecord {
  const sets = MATERIAL_YOU_STYLES.map(({name, label}) => ({
    name: label,
    colors: materialYouColorSets(generatePaletteFromColor(accent, name))[mode]
      .colors,
  }))
  const [base, ...variants] = sets
  return {
    $type: 'app.witchsky.theme.colors',
    name: 'Material You',
    description:
      'Colors generated from your accent on web or system palette on native.',
    mode,
    recommendedPair: `at://did:plc:witchsky/app.witchsky.theme.colors/material-you-${mode === 'light' ? 'dark' : 'light'}`,
    base,
    variants: variants.map(variant => ({
      name: variant.name,
      colors: overrides(base.colors, variant.colors),
    })),
    special: {$type: MATERIAL_YOU_SPECIAL, accent},
    createdAt: '2026-08-30T00:00:00.000Z',
  }
}

export function materialYouStyleForSet(name: string) {
  return MATERIAL_YOU_STYLES.find(style => style.label === name)?.name
}

export function materialYouSetForStyle(style: GenerationStyle) {
  return MATERIAL_YOU_STYLES.find(item => item.name === style)?.label
}

export function resolveMaterialYouRecord(
  record: ThemeRecord,
  systemPalette: MaterialYouPalette,
  accent: string,
  generated: boolean,
): ThemeRecord {
  if (!isMaterialYouTheme(record)) return record
  if (generated) {
    const live = materialYouRecord(record.mode, accent)
    return {
      ...record,
      base: live.base,
      variants: live.variants,
      special: live.special,
    }
  }
  const system = materialYouColorSets(systemPalette)[record.mode]
  return {
    ...record,
    base: {...system, name: MATERIAL_YOU_STYLES[0].label},
    variants: undefined,
    special: {...record.special, accent: system.colors.accent},
  }
}
