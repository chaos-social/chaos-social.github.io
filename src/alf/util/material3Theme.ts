import {type MaterialYouPalette} from '@assembless/react-native-material-you'
import {createThemes} from '@bsky.app/alf'

import {chroma} from '#/platform/chroma-formats'
import {type Palette, STATIC_VALUES} from '../themes'
import {getMaterialYouColor} from './materialYou'

export function getMaterial3Colors(palette: MaterialYouPalette) {
  const lightSurface = getMaterialYouColor(palette, 'system_neutral1', 0)
  const darkSurface = getMaterialYouColor(palette, 'system_neutral1', 1000)
  const mixNeutral = (
    lightShade: Parameters<typeof getMaterialYouColor>[2],
    darkShade: Parameters<typeof getMaterialYouColor>[2],
    amount: number,
  ) =>
    chroma
      .mix(
        getMaterialYouColor(palette, 'system_neutral1', lightShade),
        getMaterialYouColor(palette, 'system_neutral1', darkShade),
        amount,
        'lab',
      )
      .hex()

  const MATERIAL_3_PALETTE: Palette = {
    white: getMaterialYouColor(palette, 'system_neutral1', 0),
    black: getMaterialYouColor(palette, 'system_neutral1', 1000),
    pink: getMaterialYouColor(palette, 'system_accent3', 500),
    yellow: getMaterialYouColor(
      palette,
      'system_error',
      200,
      STATIC_VALUES.yellow,
    ),
    like: getMaterialYouColor(palette, 'system_accent3', 500),

    contrast_0: lightSurface,
    contrast_25: chroma.mix(lightSurface, darkSurface, 0.06, 'rgb').hex(),
    contrast_50: getMaterialYouColor(palette, 'system_neutral1', 100),
    contrast_100: mixNeutral(100, 200, 0.5),
    contrast_200: getMaterialYouColor(palette, 'system_neutral1', 200),
    contrast_300: getMaterialYouColor(palette, 'system_neutral1', 300),
    contrast_400: getMaterialYouColor(palette, 'system_neutral1', 400),
    contrast_500: getMaterialYouColor(palette, 'system_neutral1', 500),
    contrast_600: getMaterialYouColor(palette, 'system_neutral1', 600),
    contrast_700: getMaterialYouColor(palette, 'system_neutral1', 700),
    contrast_800: getMaterialYouColor(palette, 'system_neutral1', 800),
    contrast_900: mixNeutral(800, 900, 0.5),
    contrast_950: getMaterialYouColor(palette, 'system_neutral1', 900),
    contrast_975: mixNeutral(900, 1000, 0.5),
    contrast_1000: darkSurface,

    primary_25: getMaterialYouColor(palette, 'system_accent1', 10),
    primary_50: getMaterialYouColor(palette, 'system_accent1', 50),
    primary_100: getMaterialYouColor(palette, 'system_accent1', 100),
    primary_200: getMaterialYouColor(palette, 'system_accent1', 200),
    primary_300: getMaterialYouColor(palette, 'system_accent1', 300),
    primary_400: getMaterialYouColor(palette, 'system_accent1', 400),
    primary_500: getMaterialYouColor(palette, 'system_accent1', 500),
    primary_600: getMaterialYouColor(palette, 'system_accent1', 600),
    primary_700: getMaterialYouColor(palette, 'system_accent1', 700),
    primary_800: getMaterialYouColor(palette, 'system_accent1', 800),
    primary_900: getMaterialYouColor(palette, 'system_accent1', 900),
    primary_950: getMaterialYouColor(palette, 'system_accent1', 900),
    primary_975: getMaterialYouColor(palette, 'system_accent1', 1000),

    positive_25: getMaterialYouColor(palette, 'system_accent2', 10),
    positive_50: getMaterialYouColor(palette, 'system_accent2', 50),
    positive_100: getMaterialYouColor(palette, 'system_accent2', 100),
    positive_200: getMaterialYouColor(palette, 'system_accent2', 200),
    positive_300: getMaterialYouColor(palette, 'system_accent2', 300),
    positive_400: getMaterialYouColor(palette, 'system_accent2', 400),
    positive_500: getMaterialYouColor(palette, 'system_accent2', 500),
    positive_600: getMaterialYouColor(palette, 'system_accent2', 600),
    positive_700: getMaterialYouColor(palette, 'system_accent2', 700),
    positive_800: getMaterialYouColor(palette, 'system_accent2', 800),
    positive_900: getMaterialYouColor(palette, 'system_accent2', 900),
    positive_950: getMaterialYouColor(palette, 'system_accent2', 900),
    positive_975: getMaterialYouColor(palette, 'system_accent2', 1000),

    negative_25: getMaterialYouColor(palette, 'system_error', 10, '#FFF5F7'),
    negative_50: getMaterialYouColor(palette, 'system_error', 50, '#FEEBEF'),
    negative_100: getMaterialYouColor(palette, 'system_error', 100, '#FDD8E1'),
    negative_200: getMaterialYouColor(palette, 'system_error', 200, '#FCC0CE'),
    negative_300: getMaterialYouColor(palette, 'system_error', 300, '#F99AB0'),
    negative_400: getMaterialYouColor(palette, 'system_error', 400, '#F76486'),
    negative_500: getMaterialYouColor(palette, 'system_error', 500, '#EB2452'),
    negative_600: getMaterialYouColor(palette, 'system_error', 600, '#D81341'),
    negative_700: getMaterialYouColor(palette, 'system_error', 700, '#BA1239'),
    negative_800: getMaterialYouColor(palette, 'system_error', 800, '#910D2C'),
    negative_900: getMaterialYouColor(palette, 'system_error', 900, '#6F0B22'),
    negative_950: getMaterialYouColor(palette, 'system_error', 900, '#500B1C'),
    negative_975: getMaterialYouColor(palette, 'system_error', 1000, '#3E0915'),
  }

  const MATERIAL_3_SUBDUED_PALETTE: Palette = {
    white: getMaterialYouColor(palette, 'system_neutral1', 50),
    black: getMaterialYouColor(palette, 'system_neutral1', 900),
    pink: getMaterialYouColor(palette, 'system_accent3', 500),
    yellow: getMaterialYouColor(
      palette,
      'system_error',
      200,
      STATIC_VALUES.yellow,
    ),
    like: getMaterialYouColor(palette, 'system_accent3', 500),

    contrast_0: getMaterialYouColor(palette, 'system_neutral1', 50),
    contrast_25: mixNeutral(50, 100, 0.4),
    contrast_50: mixNeutral(50, 100, 0.8),
    contrast_100: getMaterialYouColor(palette, 'system_neutral1', 100),
    contrast_200: mixNeutral(100, 200, 0.5),
    contrast_300: getMaterialYouColor(palette, 'system_neutral1', 200),
    contrast_400: getMaterialYouColor(palette, 'system_neutral1', 300),
    contrast_500: getMaterialYouColor(palette, 'system_neutral1', 400),
    contrast_600: mixNeutral(400, 500, 0.5),
    contrast_700: getMaterialYouColor(palette, 'system_neutral1', 500),
    contrast_800: getMaterialYouColor(palette, 'system_neutral1', 600),
    contrast_900: getMaterialYouColor(palette, 'system_neutral1', 700),
    contrast_950: mixNeutral(700, 800, 0.6),
    contrast_975: getMaterialYouColor(palette, 'system_neutral2', 800),
    contrast_1000: getMaterialYouColor(palette, 'system_neutral1', 900),

    primary_25: getMaterialYouColor(palette, 'system_accent1', 10),
    primary_50: getMaterialYouColor(palette, 'system_accent1', 50),
    primary_100: getMaterialYouColor(palette, 'system_accent1', 100),
    primary_200: getMaterialYouColor(palette, 'system_accent1', 200),
    primary_300: getMaterialYouColor(palette, 'system_accent1', 300),
    primary_400: getMaterialYouColor(palette, 'system_accent1', 400),
    primary_500: getMaterialYouColor(palette, 'system_accent1', 400),
    primary_600: getMaterialYouColor(palette, 'system_accent1', 500),
    primary_700: getMaterialYouColor(palette, 'system_accent1', 600),
    primary_800: getMaterialYouColor(palette, 'system_accent1', 700),
    primary_900: getMaterialYouColor(palette, 'system_accent1', 800),
    primary_950: getMaterialYouColor(palette, 'system_accent1', 800),
    primary_975: getMaterialYouColor(palette, 'system_accent1', 900),

    positive_25: getMaterialYouColor(palette, 'system_accent2', 10),
    positive_50: getMaterialYouColor(palette, 'system_accent2', 50),
    positive_100: getMaterialYouColor(palette, 'system_accent2', 100),
    positive_200: getMaterialYouColor(palette, 'system_accent2', 200),
    positive_300: getMaterialYouColor(palette, 'system_accent2', 300),
    positive_400: getMaterialYouColor(palette, 'system_accent2', 400),
    positive_500: getMaterialYouColor(palette, 'system_accent2', 400),
    positive_600: getMaterialYouColor(palette, 'system_accent2', 500),
    positive_700: getMaterialYouColor(palette, 'system_accent2', 600),
    positive_800: getMaterialYouColor(palette, 'system_accent2', 700),
    positive_900: getMaterialYouColor(palette, 'system_accent2', 800),
    positive_950: getMaterialYouColor(palette, 'system_accent2', 900),
    positive_975: getMaterialYouColor(palette, 'system_accent2', 900),

    negative_25: getMaterialYouColor(palette, 'system_error', 10, '#FFF5F7'),
    negative_50: getMaterialYouColor(palette, 'system_error', 50, '#FEEBEF'),
    negative_100: getMaterialYouColor(palette, 'system_error', 100, '#FDD8E1'),
    negative_200: getMaterialYouColor(palette, 'system_error', 200, '#FCC0CE'),
    negative_300: getMaterialYouColor(palette, 'system_error', 300, '#F99AB0'),
    negative_400: getMaterialYouColor(palette, 'system_error', 400, '#F76486'),
    negative_500: getMaterialYouColor(palette, 'system_error', 400, '#EB2452'),
    negative_600: getMaterialYouColor(palette, 'system_error', 500, '#D81341'),
    negative_700: getMaterialYouColor(palette, 'system_error', 600, '#BA1239'),
    negative_800: getMaterialYouColor(palette, 'system_error', 700, '#910D2C'),
    negative_900: getMaterialYouColor(palette, 'system_error', 800, '#6F0B22'),
    negative_950: getMaterialYouColor(palette, 'system_error', 800, '#500B1C'),
    negative_975: getMaterialYouColor(palette, 'system_error', 900, '#3E0915'),
  }

  const MATERIAL_3_THEMES = createThemes({
    defaultPalette: MATERIAL_3_PALETTE,
    subduedPalette: MATERIAL_3_SUBDUED_PALETTE,
  })

  // special case for disabled (primary) button text. we have a hack for primary_subtle in Button.tsx
  MATERIAL_3_THEMES.dark.atoms.text_inverted.color =
    MATERIAL_3_THEMES.dark.palette.primary_400
  MATERIAL_3_THEMES.dim.atoms.text_inverted.color =
    MATERIAL_3_THEMES.dim.palette.primary_400

  const material3scheme = {
    lightPalette: MATERIAL_3_THEMES.light.palette,
    darkPalette: MATERIAL_3_THEMES.dark.palette,
    dimPalette: MATERIAL_3_THEMES.dim.palette,
    light: MATERIAL_3_THEMES.light,
    dark: MATERIAL_3_THEMES.dark,
    dim: MATERIAL_3_THEMES.dim,
  }

  return {
    regular: MATERIAL_3_PALETTE,
    subdued: MATERIAL_3_SUBDUED_PALETTE,
    scheme: material3scheme,
  }
}
