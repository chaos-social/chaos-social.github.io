import {
  createThemes,
  // I REJECT NODE MODULE SOCIETY
  //  DEFAULT_PALETTE,
  //  DEFAULT_SUBDUED_PALETTE,
} from '@bsky.app/alf'

import {
  BLUE_HUE as BLACKSKY_BLUE_HUE,
  BLUE_HUE as ZEPPELIN_BLUE_HUE,
  defaultScale as ZEPPELIN_defaultScale,
  // defaultScale as BLACKSKY_defaultScale,
  dimScale as BLACKSKY_dimScale,
  dimScale as ZEPPELIN_dimScale,
  GREEN_HUE as BLACKSKY_GREEN_HUE,
  GREEN_HUE as ZEPPELIN_GREEN_HUE,
  RED_HUE as BLACKSKY_RED_HUE,
  RED_HUE as ZEPPELIN_RED_HUE,
} from '#/alf/util/blackskyColorGeneration'
import {
  BLUE_HUE as DEER_BLUE_HUE,
  defaultScale as DEER_defaultScale,
  // dimScale as DEER_dimScale,
  GREEN_HUE as DEER_GREEN_HUE,
  RED_HUE as DEER_RED_HUE,
} from '#/alf/util/deerColorGeneration'
import {
  getMaterialYouColor,
  onMaterialYouPaletteChange,
} from './util/materialYou'

export type Palette = {
  white: string
  black: string
  like: string
  pink: string
  yellow: string

  contrast_0: string
  contrast_25: string
  contrast_50: string
  contrast_100: string
  contrast_200: string
  contrast_300: string
  contrast_400: string
  contrast_500: string
  contrast_600: string
  contrast_700: string
  contrast_800: string
  contrast_900: string
  contrast_950: string
  contrast_975: string
  contrast_1000: string

  primary_25: string
  primary_50: string
  primary_100: string
  primary_200: string
  primary_300: string
  primary_400: string
  primary_500: string
  primary_600: string
  primary_700: string
  primary_800: string
  primary_900: string
  primary_950: string
  primary_975: string

  positive_25: string
  positive_50: string
  positive_100: string
  positive_200: string
  positive_300: string
  positive_400: string
  positive_500: string
  positive_600: string
  positive_700: string
  positive_800: string
  positive_900: string
  positive_950: string
  positive_975: string

  negative_25: string
  negative_50: string
  negative_100: string
  negative_200: string
  negative_300: string
  negative_400: string
  negative_500: string
  negative_600: string
  negative_700: string
  negative_800: string
  negative_900: string
  negative_950: string
  negative_975: string
}

const STATIC_VALUES = {
  white: '#FEFBFB',
  black: '#000000',
  pink: '#EC4899',
  yellow: '#FFC404',
}

export const DEFAULT_PALETTE: Palette = {
  white: '#FEFBFB',
  black: '#000000',
  like: '#dd5e8f',
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,

  contrast_0: '#FEFBFB',
  contrast_25: '#ECE9E9',
  contrast_50: '#DBD8D8',
  contrast_100: '#C9C7C7',
  contrast_200: '#B8B6B6',
  contrast_300: '#A8A5A5',
  contrast_400: '#979595',
  contrast_500: '#878585',
  contrast_600: '#787575',
  contrast_700: '#686666',
  contrast_800: '#595757',
  contrast_900: '#4B4848',
  contrast_950: '#3D3A3A',
  contrast_975: '#1b1a1aff',
  contrast_1000: '#000000ff',

  primary_25: `hsl(5, 30%, 97%)`,
  primary_50: `hsl(5, 30%, 95%)`,
  primary_100: `hsl(5, 30%, 90%)`,
  primary_200: `hsl(5, 52%, 80%)`,
  primary_300: `hsl(5, 64%, 70%)`,
  primary_400: `hsl(5, 75%, 58%)`,
  primary_500: `hsl(5, 82%, 60%)`,
  primary_600: `hsl(5, 80%, 54%)`,
  primary_700: `hsl(5, 40%, 32%)`,
  primary_800: `hsl(5, 42%, 25%)`,
  primary_900: `hsl(5, 45%, 18%)`,
  primary_950: `hsl(5, 48%, 10%)`,
  primary_975: `hsl(5, 50%, 7%)`,

  positive_25: '#ECFEF5',
  positive_50: '#D3FDE8',
  positive_100: '#A3FACF',
  positive_200: '#6AF6B0',
  positive_300: '#2CF28F',
  positive_400: '#0DD370',
  positive_500: '#09B35E',
  positive_600: '#04904A',
  positive_700: '#036D38',
  positive_800: '#04522B',
  positive_900: '#033F21',
  positive_950: '#032A17',
  positive_975: '#021D0F',

  negative_25: '#FFF5F7',
  negative_50: '#FEE7EC',
  negative_100: '#FDD3DD',
  negative_200: '#FBBBCA',
  negative_300: '#F891A9',
  negative_400: '#F65A7F',
  negative_500: '#E91646',
  negative_600: '#CA123D',
  negative_700: '#A71134',
  negative_800: '#7F0B26',
  negative_900: '#5F071C',
  negative_950: '#430413',
  negative_975: '#30030D',
}

export const DEFAULT_SUBDUED_PALETTE: Palette = {
  white: '#FEFBFB',
  black: '#383434',
  like: '#dd5e8f',
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,

  contrast_0: '#FEFBFB',
  contrast_25: '#ECE9E9',
  contrast_50: '#DBD8D8',
  contrast_100: '#C9C7C7',
  contrast_200: '#B8B6B6',
  contrast_300: '#A8A5A5',
  contrast_400: '#979595',
  contrast_500: '#878585',
  contrast_600: '#787575',
  contrast_700: '#686666',
  contrast_800: '#595757',
  contrast_900: '#4B4848',
  contrast_950: '#3D3A3A',
  contrast_975: '#2F2D2D',
  contrast_1000: '#222020',

  primary_25: `hsl(5, 30%, 97%)`,
  primary_50: `hsl(5, 30%, 95%)`,
  primary_100: `hsl(5, 30%, 90%)`,
  primary_200: `hsl(5, 52%, 80%)`,
  primary_300: `hsl(5, 64%, 70%)`,
  primary_400: `hsl(5, 84%, 66%)`,
  primary_500: `hsl(5, 82%, 60%)`,
  primary_600: `hsl(5, 80%, 54%)`,
  primary_700: `hsl(5, 58%, 55%)`,
  primary_800: `hsl(5, 42%, 25%)`,
  primary_900: `hsl(5, 45%, 18%)`,
  primary_950: `hsl(5, 48%, 10%)`,
  primary_975: `hsl(5, 50%, 7%)`,

  positive_25: '#ECFEF5',
  positive_50: '#D8FDEB',
  positive_100: '#A8FAD1',
  positive_200: '#6FF6B3',
  positive_300: '#31F291',
  positive_400: '#0EDD75',
  positive_500: '#0AC266',
  positive_600: '#049F52',
  positive_700: '#038142',
  positive_800: '#056636',
  positive_900: '#04522B',
  positive_950: '#053D21',
  positive_975: '#052917',

  negative_25: '#FFF5F7',
  negative_50: '#FEEBEF',
  negative_100: '#FDD8E1',
  negative_200: '#FCC0CE',
  negative_300: '#F99AB0',
  negative_400: '#F76486',
  negative_500: '#EB2452',
  negative_600: '#D81341',
  negative_700: '#BA1239',
  negative_800: '#910D2C',
  negative_900: '#6F0B22',
  negative_950: '#500B1C',
  negative_975: '#3E0915',
}

export function invertPalette(palette: Palette) {
  return {
    white: palette.white,
    black: palette.black,
    like: palette.like,

    contrast_0: palette.contrast_1000,
    contrast_25: palette.contrast_975,
    contrast_50: palette.contrast_950,
    contrast_100: palette.contrast_900,
    contrast_200: palette.contrast_800,
    contrast_300: palette.contrast_700,
    contrast_400: palette.contrast_600,
    contrast_500: palette.contrast_500,
    contrast_600: palette.contrast_400,
    contrast_700: palette.contrast_300,
    contrast_800: palette.contrast_200,
    contrast_900: palette.contrast_100,
    contrast_950: palette.contrast_50,
    contrast_975: palette.contrast_25,
    contrast_1000: palette.contrast_0,

    primary_25: palette.primary_975,
    primary_50: palette.primary_950,
    primary_100: palette.primary_900,
    primary_200: palette.primary_800,
    primary_300: palette.primary_700,
    primary_400: palette.primary_600,
    primary_500: palette.primary_500,
    primary_600: palette.primary_400,
    primary_700: palette.primary_300,
    primary_800: palette.primary_200,
    primary_900: palette.primary_100,
    primary_950: palette.primary_50,
    primary_975: palette.primary_25,

    positive_25: palette.positive_975,
    positive_50: palette.positive_950,
    positive_100: palette.positive_900,
    positive_200: palette.positive_800,
    positive_300: palette.positive_700,
    positive_400: palette.positive_600,
    positive_500: palette.positive_500,
    positive_600: palette.positive_400,
    positive_700: palette.positive_300,
    positive_800: palette.positive_200,
    positive_900: palette.positive_100,
    positive_950: palette.positive_50,
    positive_975: palette.positive_25,

    negative_25: palette.negative_975,
    negative_50: palette.negative_950,
    negative_100: palette.negative_900,
    negative_200: palette.negative_800,
    negative_300: palette.negative_700,
    negative_400: palette.negative_600,
    negative_500: palette.negative_500,
    negative_600: palette.negative_400,
    negative_700: palette.negative_300,
    negative_800: palette.negative_200,
    negative_900: palette.negative_100,
    negative_950: palette.negative_50,
    negative_975: palette.negative_25,
  }
}

const DEFAULT_THEMES = createThemes({
  defaultPalette: DEFAULT_PALETTE,
  subduedPalette: DEFAULT_SUBDUED_PALETTE,
})

export const themes = {
  lightPalette: DEFAULT_THEMES.light.palette,
  darkPalette: DEFAULT_THEMES.dark.palette,
  dimPalette: DEFAULT_THEMES.dim.palette,
  light: DEFAULT_THEMES.light,
  dark: DEFAULT_THEMES.dark,
  dim: DEFAULT_THEMES.dim,
}

export const witchskyscheme = themes

export const BLACKSKY_BRAND = {
  /* Neutrals */
  black: '#070C0C',
  white: '#F8FAF9',
  twilight: '#161E27',
  gray300: '#C8CAC9',
  gray400: '#9C9E9E',
  gray600: '#6A6A6A',

  /* Primary / “Indigo‑violet” */
  primaryLight: '#6060E9',
  primaryLightTint: '#EAEBFC',
  primaryDark: '#8686FF',
  primaryDarkTint: '#464985',

  /* Accent / Lime‑green (“success”) */
  secondary: '#D2FC51',
  secondaryTint: '#F1FECB',

  /* Negative / Brand red */
  negative: '#F40B42',
} as const

const scaleLight = (idx: number) => BLACKSKY_dimScale[idx]

export const BLACKSKY_PALETTE: Palette = {
  white: BLACKSKY_BRAND.white,
  black: BLACKSKY_BRAND.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  // neutrals
  contrast_0: BLACKSKY_BRAND.white,
  contrast_25: BLACKSKY_BRAND.white, // Very Light
  contrast_50: '#F0F2F2',
  contrast_100: '#E6E8E8',
  contrast_200: '#D1D3D3',
  contrast_300: '#B6B8B8',
  contrast_400: '#9C9E9E',
  contrast_500: '#818383',
  contrast_600: '#6A6A6A',
  contrast_700: '#4F5050',
  contrast_800: '#353636',
  contrast_900: '#1F2020',
  contrast_950: '#121313',
  contrast_975: '#0B0C0C',
  contrast_1000: BLACKSKY_BRAND.black,

  // primary (light scheme)
  // Tuned to ensure _975 isn't too saturated so the inverted Dark Mode background is clean.
  primary_25: BLACKSKY_BRAND.primaryLightTint,
  primary_50: '#DCDDFA',
  primary_100: '#C6C8F5',
  primary_200: '#B0B3F0',
  primary_300: '#989CED',
  primary_400: '#8286E7',
  primary_500: BLACKSKY_BRAND.primaryLight,
  primary_600: '#5252C3',
  primary_700: '#4545A8',
  primary_800: '#38388D',
  primary_900: '#2B2B71',
  primary_950: '#151540', // Deepened and desaturated slightly
  primary_975: '#0B0B24', // Almost black-blue, ensures Dark Mode BG isn't "muddy blue"

  // success
  positive_25: BLACKSKY_BRAND.secondaryTint,
  positive_50: '#EAFDD1',
  positive_100: '#DAFCAB',
  positive_200: '#C8FC80',
  positive_300: '#BBFB66',
  positive_400: '#AEFA59',
  positive_500: BLACKSKY_BRAND.secondary,
  positive_600: '#A0EC46',
  positive_700: '#82C838',
  positive_800: '#66942A',
  positive_900: '#4A601C',
  positive_950: '#2E3B0E',
  positive_975: '#181F07',

  // error
  negative_25: '#FFE5EC',
  negative_50: '#FFD9E3',
  negative_100: '#FFC1D1',
  negative_200: '#FF9AB3',
  negative_300: '#FF7396',
  negative_400: '#FF4B78',
  negative_500: BLACKSKY_BRAND.negative,
  negative_600: '#C00A32',
  negative_700: '#920826',
  negative_800: '#630619',
  negative_900: '#35030D',
  negative_950: '#1B0206',
  negative_975: '#0E0103',
} as const

// The Subdued palette must be defined as a LIGHT palette.
// createThemes will then INVERT this to create the Dim (Dark Blue) theme.
// We map _25 to High Lightness and _975 to Low Lightness.
export const BLACKSKY_SUBDUED_PALETTE: Palette = {
  ...BLACKSKY_PALETTE,

  // Override black to a softer twilight for the text in Light mode (optional)
  // or primarily for the background color in the inverted Dim mode.
  black: '#161E27',

  // Neutral / Contrast Scale (Blue-Tinted Grays)
  // We utilize the dimScale in reverse: [14] is lightest, [1] is darkest.
  contrast_0: '#FFFFFF',
  contrast_25: `hsl(${BLACKSKY_BLUE_HUE}, 20%, ${scaleLight(14)}%)`, // Lightest
  contrast_50: `hsl(${BLACKSKY_BLUE_HUE}, 20%, ${scaleLight(13)}%)`,
  contrast_100: `hsl(${BLACKSKY_BLUE_HUE}, 20%, ${scaleLight(12)}%)`,
  contrast_200: `hsl(${BLACKSKY_BLUE_HUE}, 20%, ${scaleLight(11)}%)`,
  contrast_300: `hsl(${BLACKSKY_BLUE_HUE}, 15%, ${scaleLight(10)}%)`,
  contrast_400: `hsl(${BLACKSKY_BLUE_HUE}, 15%, ${scaleLight(9)}%)`,
  contrast_500: `hsl(${BLACKSKY_BLUE_HUE}, 15%, ${scaleLight(8)}%)`,
  contrast_600: `hsl(${BLACKSKY_BLUE_HUE}, 15%, ${scaleLight(7)}%)`,
  contrast_700: `hsl(${BLACKSKY_BLUE_HUE}, 15%, ${scaleLight(5)}%)`,
  contrast_800: `hsl(${BLACKSKY_BLUE_HUE}, 20%, ${scaleLight(4)}%)`,
  contrast_900: `hsl(${BLACKSKY_BLUE_HUE}, 24%, ${scaleLight(3)}%)`,
  contrast_950: `hsl(${BLACKSKY_BLUE_HUE}, 28%, ${scaleLight(2)}%)`,
  contrast_975: `hsl(${BLACKSKY_BLUE_HUE}, 30%, ${scaleLight(1)}%)`, // Darkest
  contrast_1000: `hsl(${BLACKSKY_BLUE_HUE}, 30%, 8%)`, // Absolute Darkest

  // Subdued Primary
  // Less saturation than the main palette to fit the "Subdued" vibe
  primary_25: `hsl(240, 60%, 97%)`,
  primary_50: `hsl(240, 60%, 95%)`,
  primary_100: `hsl(240, 55%, 90%)`,
  primary_200: `hsl(240, 50%, 80%)`,
  primary_300: `hsl(240, 45%, 70%)`,
  primary_400: `hsl(240, 40%, 60%)`,
  primary_500: `hsl(240, 35%, 50%)`, // Midpoint
  primary_600: `hsl(240, 40%, 45%)`,
  primary_700: `hsl(240, 45%, 35%)`,
  primary_800: `hsl(240, 50%, 25%)`,
  primary_900: `hsl(240, 50%, 15%)`,
  primary_950: `hsl(240, 50%, 10%)`,
  primary_975: `hsl(240, 50%, 6%)`,

  // Subdued Success
  positive_25: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 96%)`,
  positive_50: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 93%)`,
  positive_100: `hsl(${BLACKSKY_GREEN_HUE}, 55%, 88%)`,
  positive_200: `hsl(${BLACKSKY_GREEN_HUE}, 50%, 80%)`,
  positive_300: `hsl(${BLACKSKY_GREEN_HUE}, 50%, 70%)`,
  positive_400: `hsl(${BLACKSKY_GREEN_HUE}, 50%, 60%)`,
  positive_500: `hsl(${BLACKSKY_GREEN_HUE}, 50%, 50%)`,
  positive_600: `hsl(${BLACKSKY_GREEN_HUE}, 55%, 40%)`,
  positive_700: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 30%)`,
  positive_800: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 20%)`,
  positive_900: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 15%)`,
  positive_950: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 10%)`,
  positive_975: `hsl(${BLACKSKY_GREEN_HUE}, 60%, 5%)`,

  // Subdued Negative
  negative_25: `hsl(${BLACKSKY_RED_HUE}, 70%, 97%)`,
  negative_50: `hsl(${BLACKSKY_RED_HUE}, 70%, 95%)`,
  negative_100: `hsl(${BLACKSKY_RED_HUE}, 65%, 90%)`,
  negative_200: `hsl(${BLACKSKY_RED_HUE}, 60%, 80%)`,
  negative_300: `hsl(${BLACKSKY_RED_HUE}, 55%, 70%)`,
  negative_400: `hsl(${BLACKSKY_RED_HUE}, 55%, 60%)`,
  negative_500: `hsl(${BLACKSKY_RED_HUE}, 60%, 50%)`,
  negative_600: `hsl(${BLACKSKY_RED_HUE}, 60%, 45%)`,
  negative_700: `hsl(${BLACKSKY_RED_HUE}, 65%, 35%)`,
  negative_800: `hsl(${BLACKSKY_RED_HUE}, 65%, 25%)`,
  negative_900: `hsl(${BLACKSKY_RED_HUE}, 70%, 15%)`,
  negative_950: `hsl(${BLACKSKY_RED_HUE}, 70%, 10%)`,
  negative_975: `hsl(${BLACKSKY_RED_HUE}, 70%, 5%)`,
} as const

const BLACKSKY_THEMES = createThemes({
  defaultPalette: BLACKSKY_PALETTE,
  subduedPalette: BLACKSKY_SUBDUED_PALETTE,
})

export const blackskyscheme = {
  lightPalette: BLACKSKY_THEMES.light.palette,
  darkPalette: BLACKSKY_THEMES.dark.palette,
  dimPalette: BLACKSKY_THEMES.dim.palette,
  light: BLACKSKY_THEMES.light,
  dark: BLACKSKY_THEMES.dark,
  dim: BLACKSKY_THEMES.dim,
}

export const BLUESKY_PALETTE: Palette = {
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: '#FFFFFF',
  contrast_25: '#F9FAFB',
  contrast_50: '#EFF2F6',
  contrast_100: '#DCE2EA',
  contrast_200: '#C0CAD8',
  contrast_300: '#A5B2C5',
  contrast_400: '#8798B0',
  contrast_500: '#667B99',
  contrast_600: '#526580',
  contrast_700: '#405168',
  contrast_800: '#313F54',
  contrast_900: '#232E3E',
  contrast_950: '#19222E',
  contrast_975: '#111822',
  contrast_1000: '#000000',

  primary_25: '#F5F9FF',
  primary_50: '#E5F0FF',
  primary_100: '#CCE1FF',
  primary_200: '#A8CCFF',
  primary_300: '#75AFFF',
  primary_400: '#4291FF',
  primary_500: '#006AFF',
  primary_600: '#0059D6',
  primary_700: '#0048AD',
  primary_800: '#00398A',
  primary_900: '#002861',
  primary_950: '#001E47',
  primary_975: '#001533',

  positive_25: '#ECFEF5',
  positive_50: '#D3FDE8',
  positive_100: '#A3FACF',
  positive_200: '#6AF6B0',
  positive_300: '#2CF28F',
  positive_400: '#0DD370',
  positive_500: '#09B35E',
  positive_600: '#04904A',
  positive_700: '#036D38',
  positive_800: '#04522B',
  positive_900: '#033F21',
  positive_950: '#032A17',
  positive_975: '#021D0F',

  negative_25: '#FFF5F7',
  negative_50: '#FEE7EC',
  negative_100: '#FDD3DD',
  negative_200: '#FBBBCA',
  negative_300: '#F891A9',
  negative_400: '#F65A7F',
  negative_500: '#E91646',
  negative_600: '#CA123D',
  negative_700: '#A71134',
  negative_800: '#7F0B26',
  negative_900: '#5F071C',
  negative_950: '#430413',
  negative_975: '#30030D',
}

export const BLUESKY_SUBDUED_PALETTE: Palette = {
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: '#FFFFFF',
  contrast_25: '#F9FAFB',
  contrast_50: '#F2F4F8',
  contrast_100: '#E2E7EE',
  contrast_200: '#C3CDDA',
  contrast_300: '#ABB8C9',
  contrast_400: '#8D9DB4',
  contrast_500: '#6F839F',
  contrast_600: '#586C89',
  contrast_700: '#485B75',
  contrast_800: '#394960',
  contrast_900: '#2C3A4E',
  contrast_950: '#222E3F',
  contrast_975: '#1C2736',
  contrast_1000: '#151D28',

  primary_25: '#F5F9FF',
  primary_50: '#EBF3FF',
  primary_100: '#D6E7FF',
  primary_200: '#ADCFFF',
  primary_300: '#80B5FF',
  primary_400: '#4D97FF',
  primary_500: '#0F73FF',
  primary_600: '#0661E0',
  primary_700: '#0A52B8',
  primary_800: '#0E4490',
  primary_900: '#123464',
  primary_950: '#122949',
  primary_975: '#122136',

  positive_25: '#ECFEF5',
  positive_50: '#D8FDEB',
  positive_100: '#A8FAD1',
  positive_200: '#6FF6B3',
  positive_300: '#31F291',
  positive_400: '#0EDD75',
  positive_500: '#0AC266',
  positive_600: '#049F52',
  positive_700: '#038142',
  positive_800: '#056636',
  positive_900: '#04522B',
  positive_950: '#053D21',
  positive_975: '#052917',

  negative_25: '#FFF5F7',
  negative_50: '#FEEBEF',
  negative_100: '#FDD8E1',
  negative_200: '#FCC0CE',
  negative_300: '#F99AB0',
  negative_400: '#F76486',
  negative_500: '#EB2452',
  negative_600: '#D81341',
  negative_700: '#BA1239',
  negative_800: '#910D2C',
  negative_900: '#6F0B22',
  negative_950: '#500B1C',
  negative_975: '#3E0915',
}

const BLUESKY_THEMES = createThemes({
  defaultPalette: BLUESKY_PALETTE,
  subduedPalette: BLUESKY_SUBDUED_PALETTE,
})

export const blueskyscheme = {
  lightPalette: BLUESKY_THEMES.light.palette,
  darkPalette: BLUESKY_THEMES.dark.palette,
  dimPalette: BLUESKY_THEMES.dim.palette,
  light: BLUESKY_THEMES.light,
  dark: BLUESKY_THEMES.dark,
  dim: BLUESKY_THEMES.dim,
}

export const DEER_PALETTE: Palette = {
  white: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[14]}%)`,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[14]}%)`,
  contrast_25: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[13]}%)`,
  contrast_50: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[12]}%)`,
  contrast_100: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[11]}%)`,
  contrast_200: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[10]}%)`,
  contrast_300: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[9]}%)`,
  contrast_400: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[8]}%)`,
  contrast_500: `hsl(${DEER_BLUE_HUE}, 20%, ${DEER_defaultScale[7]}%)`,
  contrast_600: `hsl(${DEER_BLUE_HUE}, 24%, ${DEER_defaultScale[6]}%)`,
  contrast_700: `hsl(${DEER_BLUE_HUE}, 24%, ${DEER_defaultScale[5]}%)`,
  contrast_800: `hsl(${DEER_BLUE_HUE}, 28%, ${DEER_defaultScale[4]}%)`,
  contrast_900: `hsl(${DEER_BLUE_HUE}, 28%, ${DEER_defaultScale[3]}%)`,
  contrast_950: `hsl(${DEER_BLUE_HUE}, 28%, ${DEER_defaultScale[2]}%)`,
  contrast_975: `hsl(${DEER_BLUE_HUE}, 28%, ${DEER_defaultScale[1]}%)`,
  contrast_1000: '#000000',

  primary_25: `hsl(145, 30%, 97%)`,
  primary_50: `hsl(145, 30%, 95%)`,
  primary_100: `hsl(145, 30%, 90%)`,
  primary_200: `hsl(145, 32%, 80%)`,
  primary_300: `hsl(145, 34%, 70%)`,
  primary_400: `hsl(145, 35%, 58%)`,
  primary_500: `hsl(145, 35%, 45%)`,
  primary_600: `hsl(145, 38%, 38%)`,
  primary_700: `hsl(145, 40%, 32%)`,
  primary_800: `hsl(145, 42%, 25%)`,
  primary_900: `hsl(145, 45%, 18%)`,
  primary_950: `hsl(145, 48%, 10%)`,
  primary_975: `hsl(145, 50%, 7%)`,

  positive_25: `hsl(${DEER_GREEN_HUE}, 82%, 97%)`,
  positive_50: `hsl(${DEER_GREEN_HUE}, 82%, 95%)`,
  positive_100: `hsl(${DEER_GREEN_HUE}, 82%, 90%)`,
  positive_200: `hsl(${DEER_GREEN_HUE}, 82%, 80%)`,
  positive_300: `hsl(${DEER_GREEN_HUE}, 82%, 70%)`,
  positive_400: `hsl(${DEER_GREEN_HUE}, 82%, 60%)`,
  positive_500: `hsl(${DEER_GREEN_HUE}, 82%, 50%)`,
  positive_600: `hsl(${DEER_GREEN_HUE}, 82%, 42%)`,
  positive_700: `hsl(${DEER_GREEN_HUE}, 82%, 34%)`,
  positive_800: `hsl(${DEER_GREEN_HUE}, 82%, 26%)`,
  positive_900: `hsl(${DEER_GREEN_HUE}, 82%, 18%)`,
  positive_950: `hsl(${DEER_GREEN_HUE}, 82%, 10%)`,
  positive_975: `hsl(${DEER_GREEN_HUE}, 82%, 7%)`,

  negative_25: `hsl(${DEER_RED_HUE}, 91%, 97%)`,
  negative_50: `hsl(${DEER_RED_HUE}, 91%, 95%)`,
  negative_100: `hsl(${DEER_RED_HUE}, 91%, 90%)`,
  negative_200: `hsl(${DEER_RED_HUE}, 91%, 80%)`,
  negative_300: `hsl(${DEER_RED_HUE}, 91%, 70%)`,
  negative_400: `hsl(${DEER_RED_HUE}, 91%, 60%)`,
  negative_500: `hsl(${DEER_RED_HUE}, 91%, 50%)`,
  negative_600: `hsl(${DEER_RED_HUE}, 91%, 42%)`,
  negative_700: `hsl(${DEER_RED_HUE}, 91%, 34%)`,
  negative_800: `hsl(${DEER_RED_HUE}, 91%, 26%)`,
  negative_900: `hsl(${DEER_RED_HUE}, 91%, 18%)`,
  negative_950: `hsl(${DEER_RED_HUE}, 91%, 10%)`,
  negative_975: `hsl(${DEER_RED_HUE}, 91%, 7%)`,
}

export const DEER_SUBDUED_PALETTE: Palette = {
  ...DEER_PALETTE,
  primary_25: `hsl(140, 15%, 97%)`,
  primary_50: `hsl(140, 18%, 95%)`,
  primary_100: `hsl(140, 22%, 90%)`,
  primary_200: `hsl(140, 25%, 80%)`,
  primary_300: `hsl(140, 28%, 70%)`,
  primary_400: `hsl(140, 32%, 58%)`,
  primary_500: `hsl(140, 35%, 45%)`,
  primary_600: `hsl(140, 38%, 38%)`,
  primary_700: `hsl(140, 42%, 32%)`,
  primary_800: `hsl(140, 45%, 25%)`,
  primary_900: `hsl(140, 48%, 18%)`,
  primary_950: `hsl(140, 50%, 10%)`,
  primary_975: `hsl(140, 55%, 7%)`,
  contrast_1000: '#151D28',
}

const DEER_THEMES = createThemes({
  defaultPalette: DEER_PALETTE,
  subduedPalette: DEER_SUBDUED_PALETTE,
})

export const deerscheme = {
  lightPalette: DEER_THEMES.light.palette,
  darkPalette: DEER_THEMES.dark.palette,
  dimPalette: DEER_THEMES.dim.palette,
  light: DEER_THEMES.light,
  dark: DEER_THEMES.dark,
  dim: DEER_THEMES.dim,
}

export const ZEPPELIN_PALETTE: Palette = {
  white: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[14]}%)`,
  black: `hsl(${ZEPPELIN_BLUE_HUE}, 23%, ${ZEPPELIN_defaultScale[0]}%)`,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[14]}%)`,
  contrast_25: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[13]}%)`,
  contrast_50: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[12]}%)`,
  contrast_100: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[11]}%)`,
  contrast_200: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[10]}%)`,
  contrast_300: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[9]}%)`,
  contrast_400: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[8]}%)`,
  contrast_500: `hsl(${ZEPPELIN_BLUE_HUE}, 15%, ${ZEPPELIN_defaultScale[7]}%)`,
  contrast_600: `hsl(${ZEPPELIN_BLUE_HUE}, 19%, ${ZEPPELIN_defaultScale[6]}%)`,
  contrast_700: `hsl(${ZEPPELIN_BLUE_HUE}, 19%, ${ZEPPELIN_defaultScale[5]}%)`,
  contrast_800: `hsl(${ZEPPELIN_BLUE_HUE}, 23%, ${ZEPPELIN_defaultScale[4]}%)`,
  contrast_900: `hsl(${ZEPPELIN_BLUE_HUE}, 23%, ${ZEPPELIN_defaultScale[3]}%)`,
  contrast_950: `hsl(${ZEPPELIN_BLUE_HUE}, 23%, ${ZEPPELIN_defaultScale[2]}%)`,
  contrast_975: `hsl(${ZEPPELIN_BLUE_HUE}, 23%, ${ZEPPELIN_defaultScale[1]}%)`,
  contrast_1000: `hsl(${ZEPPELIN_BLUE_HUE}, 23%, ${ZEPPELIN_defaultScale[0]}%)`,

  primary_25: `hsl(47, 80%, 89%)`,
  primary_50: `hsl(47, 80%, 87%)`,
  primary_100: `hsl(47, 80%, 82%)`,
  primary_200: `hsl(47, 72%, 72%)`,
  primary_300: `hsl(47, 74%, 62%)`,
  primary_400: `hsl(47, 75%, 50%)`,
  primary_500: `hsl(47, 75%, 37%)`,
  primary_600: `hsl(47, 78%, 30%)`,
  primary_700: `hsl(47, 80%, 24%)`,
  primary_800: `hsl(47, 82%, 17%)`,
  primary_900: `hsl(47, 85%, 12%)`,
  primary_950: `hsl(47, 88%, 5%)`,
  primary_975: `hsl(47, 90%, 2%)`,

  positive_25: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 97%)`,
  positive_50: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 95%)`,
  positive_100: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 90%)`,
  positive_200: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 80%)`,
  positive_300: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 70%)`,
  positive_400: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 60%)`,
  positive_500: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 50%)`,
  positive_600: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 42%)`,
  positive_700: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 34%)`,
  positive_800: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 26%)`,
  positive_900: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 18%)`,
  positive_950: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 10%)`,
  positive_975: `hsl(${ZEPPELIN_GREEN_HUE}, 82%, 7%)`,

  negative_25: `hsl(${ZEPPELIN_RED_HUE}, 91%, 97%)`,
  negative_50: `hsl(${ZEPPELIN_RED_HUE}, 91%, 95%)`,
  negative_100: `hsl(${ZEPPELIN_RED_HUE}, 91%, 90%)`,
  negative_200: `hsl(${ZEPPELIN_RED_HUE}, 91%, 80%)`,
  negative_300: `hsl(${ZEPPELIN_RED_HUE}, 91%, 70%)`,
  negative_400: `hsl(${ZEPPELIN_RED_HUE}, 91%, 60%)`,
  negative_500: `hsl(${ZEPPELIN_RED_HUE}, 91%, 50%)`,
  negative_600: `hsl(${ZEPPELIN_RED_HUE}, 91%, 42%)`,
  negative_700: `hsl(${ZEPPELIN_RED_HUE}, 91%, 34%)`,
  negative_800: `hsl(${ZEPPELIN_RED_HUE}, 91%, 26%)`,
  negative_900: `hsl(${ZEPPELIN_RED_HUE}, 91%, 18%)`,
  negative_950: `hsl(${ZEPPELIN_RED_HUE}, 91%, 10%)`,
  negative_975: `hsl(${ZEPPELIN_RED_HUE}, 91%, 7%)`,
}

export const ZEPPELIN_SUBDUED_PALETTE: Palette = {
  ...ZEPPELIN_PALETTE,
  black: `hsl(${ZEPPELIN_BLUE_HUE}, 3%, ${ZEPPELIN_dimScale[0]}%)`,

  contrast_0: `hsl(${ZEPPELIN_BLUE_HUE}, 20%, ${ZEPPELIN_dimScale[14]}%)`,
  contrast_25: `hsl(${ZEPPELIN_BLUE_HUE}, 20%, ${ZEPPELIN_dimScale[13]}%)`,
  contrast_50: `hsl(${ZEPPELIN_BLUE_HUE}, 20%, ${ZEPPELIN_dimScale[12]}%)`,
  contrast_100: `hsl(${ZEPPELIN_BLUE_HUE}, 20%, ${ZEPPELIN_dimScale[11]}%)`,
  contrast_200: `hsl(${ZEPPELIN_BLUE_HUE}, 20%, ${ZEPPELIN_dimScale[10]}%)`,
  contrast_300: `hsl(${ZEPPELIN_BLUE_HUE}, 16%, ${ZEPPELIN_dimScale[9]}%)`,
  contrast_400: `hsl(${ZEPPELIN_BLUE_HUE}, 16%, ${ZEPPELIN_dimScale[8]}%)`,
  contrast_500: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[7]}%)`,
  contrast_600: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[6]}%)`,
  contrast_700: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[5]}%)`,
  contrast_800: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[4]}%)`,
  contrast_900: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[3]}%)`,
  contrast_950: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[2]}%)`,
  contrast_975: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[1]}%)`,
  contrast_1000: `hsl(${ZEPPELIN_BLUE_HUE}, 12%, ${ZEPPELIN_dimScale[0]}%)`,

  primary_25: `hsl(47, 60%, 97%)`,
  primary_50: `hsl(47, 63%, 94%)`,
  primary_100: `hsl(47, 65%, 88%)`,
  primary_200: `hsl(47, 70%, 78%)`,
  primary_300: `hsl(47, 73%, 68%)`,
  primary_400: `hsl(47, 77%, 58%)`,
  primary_500: `hsl(47, 80%, 45%)`,
  primary_600: `hsl(47, 83%, 38%)`,
  primary_700: `hsl(47, 87%, 30%)`,
  primary_800: `hsl(47, 90%, 25%)`,
  primary_900: `hsl(47, 93%, 18%)`,
  primary_950: `hsl(47, 95%, 10%)`,
  primary_975: `hsl(47, 98%, 7%)`,
}

const ZEPPELIN_THEMES = createThemes({
  defaultPalette: ZEPPELIN_PALETTE,
  subduedPalette: ZEPPELIN_SUBDUED_PALETTE,
})

export const zeppelinscheme = {
  lightPalette: ZEPPELIN_THEMES.light.palette,
  darkPalette: ZEPPELIN_THEMES.dark.palette,
  dimPalette: ZEPPELIN_THEMES.dim.palette,
  light: ZEPPELIN_THEMES.light,
  dark: ZEPPELIN_THEMES.dark,
  dim: ZEPPELIN_THEMES.dim,
}

export const KITTY_PALETTE: Palette = {
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: '#FFFFFF',
  contrast_25: '#F9FAFB',
  contrast_50: '#EFF2F6',
  contrast_100: '#DCE2EA',
  contrast_200: '#C0CAD8',
  contrast_300: '#A5B2C5',
  contrast_400: '#8798B0',
  contrast_500: '#667B99',
  contrast_600: '#526580',
  contrast_700: '#405168',
  contrast_800: '#313F54',
  contrast_900: '#232E3E',
  contrast_950: '#19222E',
  contrast_975: '#111822',
  contrast_1000: '#000000',

  primary_25: `hsl(290, 30%, 97%)`,
  primary_50: `hsl(290, 30%, 95%)`,
  primary_100: `hsl(290, 30%, 90%)`,
  primary_200: `hsl(290, 32%, 80%)`,
  primary_300: `hsl(290, 34%, 70%)`,
  primary_400: `hsl(290, 35%, 58%)`,
  primary_500: `hsl(290, 35%, 45%)`,
  primary_600: `hsl(290, 38%, 38%)`,
  primary_700: `hsl(290, 40%, 32%)`,
  primary_800: `hsl(290, 42%, 25%)`,
  primary_900: `hsl(290, 45%, 18%)`,
  primary_950: `hsl(290, 48%, 10%)`,
  primary_975: `hsl(290, 50%, 7%)`,

  positive_25: '#ECFEF5',
  positive_50: '#D3FDE8',
  positive_100: '#A3FACF',
  positive_200: '#6AF6B0',
  positive_300: '#2CF28F',
  positive_400: '#0DD370',
  positive_500: '#09B35E',
  positive_600: '#04904A',
  positive_700: '#036D38',
  positive_800: '#04522B',
  positive_900: '#033F21',
  positive_950: '#032A17',
  positive_975: '#021D0F',

  negative_25: '#FFF5F7',
  negative_50: '#FEE7EC',
  negative_100: '#FDD3DD',
  negative_200: '#FBBBCA',
  negative_300: '#F891A9',
  negative_400: '#F65A7F',
  negative_500: '#E91646',
  negative_600: '#CA123D',
  negative_700: '#A71134',
  negative_800: '#7F0B26',
  negative_900: '#5F071C',
  negative_950: '#430413',
  negative_975: '#30030D',
}

export const KITTY_SUBDUED_PALETTE: Palette = {
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: '#FFFFFF',
  contrast_25: '#F9FAFB',
  contrast_50: '#F2F4F8',
  contrast_100: '#E2E7EE',
  contrast_200: '#C3CDDA',
  contrast_300: '#ABB8C9',
  contrast_400: '#8D9DB4',
  contrast_500: '#6F839F',
  contrast_600: '#586C89',
  contrast_700: '#485B75',
  contrast_800: '#394960',
  contrast_900: '#2C3A4E',
  contrast_950: '#222E3F',
  contrast_975: '#1C2736',
  contrast_1000: '#151D28',

  primary_25: `hsl(290, 30%, 97%)`,
  primary_50: `hsl(290, 30%, 96%)`,
  primary_100: `hsl(290, 30%, 92%)`,
  primary_200: `hsl(290, 32%, 81%)`,
  primary_300: `hsl(290, 34%, 72%)`,
  primary_400: `hsl(290, 35%, 60%)`,
  primary_500: `hsl(290, 35%, 48%)`,
  primary_600: `hsl(290, 38%, 41%)`,
  primary_700: `hsl(290, 40%, 36%)`,
  primary_800: `hsl(290, 42%, 29%)`,
  primary_900: `hsl(290, 45%, 22%)`,
  primary_950: `hsl(290, 48%, 10%)`,
  primary_975: `hsl(290, 50%, 8%)`,

  positive_25: '#ECFEF5',
  positive_50: '#D8FDEB',
  positive_100: '#A8FAD1',
  positive_200: '#6FF6B3',
  positive_300: '#31F291',
  positive_400: '#0EDD75',
  positive_500: '#0AC266',
  positive_600: '#049F52',
  positive_700: '#038142',
  positive_800: '#056636',
  positive_900: '#04522B',
  positive_950: '#053D21',
  positive_975: '#052917',

  negative_25: '#FFF5F7',
  negative_50: '#FEEBEF',
  negative_100: '#FDD8E1',
  negative_200: '#FCC0CE',
  negative_300: '#F99AB0',
  negative_400: '#F76486',
  negative_500: '#EB2452',
  negative_600: '#D81341',
  negative_700: '#BA1239',
  negative_800: '#910D2C',
  negative_900: '#6F0B22',
  negative_950: '#500B1C',
  negative_975: '#3E0915',
}

const KITTY_THEMES = createThemes({
  defaultPalette: KITTY_PALETTE,
  subduedPalette: KITTY_SUBDUED_PALETTE,
})

export const kittyscheme = {
  lightPalette: KITTY_THEMES.light.palette,
  darkPalette: KITTY_THEMES.dark.palette,
  dimPalette: KITTY_THEMES.dim.palette,
  light: KITTY_THEMES.light,
  dark: KITTY_THEMES.dark,
  dim: KITTY_THEMES.dim,
}

const REDDWARF_TAILWIND_ATOMS = {
  color_gray_25: '#fffbf9',
  color_gray_50: '#fff7f5',
  color_gray_100: '#fff0ee',
  color_gray_200: '#f8e2de',
  color_gray_300: '#eaccc7',
  color_gray_400: '#bd948e',
  color_gray_500: '#93655f',
  color_gray_600: '#714842',
  color_gray_700: '#5b342f',
  color_gray_800: '#401d19',
  color_gray_900: '#2c0c09',
  color_gray_950: '#180000',
  color_gray_970: '#0e0000',
}

const REDDWARF_TAILWIND_ATOMS_VIBRANT = {
  ...REDDWARF_TAILWIND_ATOMS,
  color_gray_500: '#c14c42',
}

export const REDDWARF_SUBDUED_PALETTE: Palette = {
  ...DEFAULT_SUBDUED_PALETTE,
  like: '#FF6B6B',
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,

  contrast_0: REDDWARF_TAILWIND_ATOMS.color_gray_50,
  contrast_25: REDDWARF_TAILWIND_ATOMS.color_gray_50,
  contrast_50: REDDWARF_TAILWIND_ATOMS.color_gray_100,
  contrast_100: REDDWARF_TAILWIND_ATOMS.color_gray_200,
  contrast_200: REDDWARF_TAILWIND_ATOMS.color_gray_200,
  contrast_300: REDDWARF_TAILWIND_ATOMS.color_gray_300,
  contrast_400: REDDWARF_TAILWIND_ATOMS.color_gray_400,
  contrast_500: REDDWARF_TAILWIND_ATOMS.color_gray_500,
  contrast_600: REDDWARF_TAILWIND_ATOMS.color_gray_500,
  contrast_700: REDDWARF_TAILWIND_ATOMS.color_gray_600,
  contrast_800: REDDWARF_TAILWIND_ATOMS.color_gray_600,
  contrast_900: REDDWARF_TAILWIND_ATOMS.color_gray_700,
  contrast_950: REDDWARF_TAILWIND_ATOMS.color_gray_800,
  contrast_975: REDDWARF_TAILWIND_ATOMS.color_gray_900,
  contrast_1000: REDDWARF_TAILWIND_ATOMS.color_gray_900,

  primary_25: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_50,
  primary_50: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_100,
  primary_100: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_200,
  primary_200: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_200,
  primary_300: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_300,
  primary_400: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_400,
  primary_500: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_500,
  primary_600: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_600,
  primary_700: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_600,
  primary_800: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_700,
  primary_900: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_700,
  primary_950: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_800,
  primary_975: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_900,
}

export const REDDWARF_PALETTE: Palette = {
  ...REDDWARF_SUBDUED_PALETTE,
  contrast_1000: REDDWARF_TAILWIND_ATOMS.color_gray_950,

  primary_25: REDDWARF_TAILWIND_ATOMS.color_gray_50,
  primary_50: REDDWARF_TAILWIND_ATOMS.color_gray_100,
  primary_100: REDDWARF_TAILWIND_ATOMS.color_gray_200,
  primary_200: REDDWARF_TAILWIND_ATOMS.color_gray_200,
  primary_300: REDDWARF_TAILWIND_ATOMS.color_gray_300,
  primary_400: REDDWARF_TAILWIND_ATOMS.color_gray_400,
  primary_500: REDDWARF_TAILWIND_ATOMS_VIBRANT.color_gray_500,
  primary_600: REDDWARF_TAILWIND_ATOMS.color_gray_600,
  primary_700: REDDWARF_TAILWIND_ATOMS.color_gray_600,
  primary_800: REDDWARF_TAILWIND_ATOMS.color_gray_700,
  primary_900: REDDWARF_TAILWIND_ATOMS.color_gray_700,
  primary_950: REDDWARF_TAILWIND_ATOMS.color_gray_800,
  primary_975: REDDWARF_TAILWIND_ATOMS.color_gray_900,
}

const REDDWARF_THEMES = createThemes({
  defaultPalette: REDDWARF_PALETTE,
  subduedPalette: REDDWARF_SUBDUED_PALETTE,
})

export const reddwarfscheme = {
  lightPalette: REDDWARF_THEMES.light.palette,
  darkPalette: REDDWARF_THEMES.dark.palette,
  dimPalette: REDDWARF_THEMES.dim.palette,
  light: REDDWARF_THEMES.light,
  dark: REDDWARF_THEMES.dark,
  dim: REDDWARF_THEMES.dim,
}

export const CATPPUCIN_PALETTE: Palette = {
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: '#EFF1F5',
  contrast_25: '#D3D7DE',
  contrast_50: '#E6E9EF',
  contrast_100: '#ccd0da',
  contrast_200: '#bcc0cc',
  contrast_300: '#acb0be',
  contrast_400: '#9ca0b0',
  contrast_500: '#8c8fa1',
  contrast_600: '#7c7f93',
  contrast_700: '#585b70',
  contrast_800: '#45475a',
  contrast_900: '#313244',
  contrast_950: '#181825',
  contrast_975: '#11111b',
  contrast_1000: '#1e1e2e',

  primary_25: `hsl(266, 30%, 97%)`,
  primary_50: `hsl(266, 30%, 95%)`,
  primary_100: `hsl(266, 30%, 90%)`,
  primary_200: `hsl(266, 42%, 80%)`,
  primary_300: `hsl(266, 54%, 70%)`,
  primary_400: `hsl(266, 65%, 58%)`,
  primary_500: `hsl(266, 75%, 58%)`,
  primary_600: `hsl(266, 68%, 38%)`,
  primary_700: `hsl(266, 50%, 32%)`,
  primary_800: `hsl(266, 42%, 25%)`,
  primary_900: `hsl(266, 45%, 18%)`,
  primary_950: `hsl(266, 48%, 10%)`,
  primary_975: `hsl(266, 50%, 7%)`,

  positive_25: '#ECFEF5',
  positive_50: '#D3FDE8',
  positive_100: '#A3FACF',
  positive_200: '#6AF6B0',
  positive_300: '#2CF28F',
  positive_400: '#0DD370',
  positive_500: '#09B35E',
  positive_600: '#04904A',
  positive_700: '#036D38',
  positive_800: '#04522B',
  positive_900: '#033F21',
  positive_950: '#032A17',
  positive_975: '#021D0F',

  negative_25: '#FFF5F7',
  negative_50: '#FEE7EC',
  negative_100: '#FDD3DD',
  negative_200: '#FBBBCA',
  negative_300: '#F891A9',
  negative_400: '#F65A7F',
  negative_500: '#E91646',
  negative_600: '#CA123D',
  negative_700: '#A71134',
  negative_800: '#7F0B26',
  negative_900: '#5F071C',
  negative_950: '#430413',
  negative_975: '#30030D',
}

export const CATPPUCIN_SUBDUED_PALETTE: Palette = {
  white: STATIC_VALUES.white,
  black: STATIC_VALUES.black,
  pink: STATIC_VALUES.pink,
  yellow: STATIC_VALUES.yellow,
  like: STATIC_VALUES.pink,

  contrast_0: '#EFF1F5',
  contrast_25: '#D3D7DE',
  contrast_50: '#E6E9EF',
  contrast_100: '#ccd0da',
  contrast_200: '#bcc0cc',
  contrast_300: '#acb0be',
  contrast_400: '#939ab7',
  contrast_500: '#8087a2',
  contrast_600: '#6e738d',
  contrast_700: '#5b6078',
  contrast_800: '#494d64',
  contrast_900: '#363a4f',
  contrast_950: '#1e2030',
  contrast_975: '#181926',
  contrast_1000: '#24273a',

  primary_25: `hsl(267, 30%, 97%)`,
  primary_50: `hsl(267, 40%, 96%)`,
  primary_100: `hsl(267, 50%, 92%)`,
  primary_200: `hsl(267, 62%, 81%)`,
  primary_300: `hsl(267, 83%, 80%)`,
  primary_400: `hsl(267, 75%, 78%)`,
  primary_500: `hsl(267, 74%, 72%)`,
  primary_600: `hsl(267, 38%, 41%)`,
  primary_700: `hsl(267, 40%, 36%)`,
  primary_800: `hsl(267, 42%, 29%)`,
  primary_900: `hsl(267, 45%, 22%)`,
  primary_950: `hsl(267, 48%, 10%)`,
  primary_975: `hsl(267, 50%, 8%)`,

  positive_25: '#ECFEF5',
  positive_50: '#D8FDEB',
  positive_100: '#A8FAD1',
  positive_200: '#6FF6B3',
  positive_300: '#31F291',
  positive_400: '#0EDD75',
  positive_500: '#0AC266',
  positive_600: '#049F52',
  positive_700: '#038142',
  positive_800: '#056636',
  positive_900: '#04522B',
  positive_950: '#053D21',
  positive_975: '#052917',

  negative_25: '#FFF5F7',
  negative_50: '#FEEBEF',
  negative_100: '#FDD8E1',
  negative_200: '#FCC0CE',
  negative_300: '#F99AB0',
  negative_400: '#F76486',
  negative_500: '#EB2452',
  negative_600: '#D81341',
  negative_700: '#BA1239',
  negative_800: '#910D2C',
  negative_900: '#6F0B22',
  negative_950: '#500B1C',
  negative_975: '#3E0915',
}

const CATPPUCIN_THEMES = createThemes({
  defaultPalette: CATPPUCIN_PALETTE,
  subduedPalette: CATPPUCIN_SUBDUED_PALETTE,
})

export const catppuccinscheme = {
  lightPalette: CATPPUCIN_THEMES.light.palette,
  darkPalette: CATPPUCIN_THEMES.dark.palette,
  dimPalette: CATPPUCIN_THEMES.dim.palette,
  light: CATPPUCIN_THEMES.light,
  dark: CATPPUCIN_THEMES.dark,
  dim: CATPPUCIN_THEMES.dim,
}

export const EVERGARDEN_PALETTE: Palette = {
  white: '#F8F9E8',
  black: '#171C1F',
  pink: '#F3C0E5',
  yellow: '#F5D098',
  like: '#F3C0E5',

  contrast_0: '#F8F9E8',
  contrast_25: '#E1EDD6',
  contrast_50: '#D3E7E0',
  contrast_100: '#C3D7D0',
  contrast_200: '#ADC9BC',
  contrast_300: '#96B4AA',
  contrast_400: '#839E9A',
  contrast_500: '#7A9493',
  contrast_600: '#6F8788',
  contrast_700: '#4A585C',
  contrast_800: '#374145',
  contrast_900: '#262F33',
  contrast_950: '#1E2528',
  contrast_975: '#191E21',
  contrast_1000: '#171C1F',

  primary_25: `hsl(64, 30%, 97%)`,
  primary_50: `hsl(64, 30%, 95%)`,
  primary_100: `hsl(64, 30%, 90%)`,
  primary_200: `hsl(72, 42%, 86%)`,
  primary_300: `hsl(74, 54%, 84%)`,
  primary_400: `hsl(83, 46%, 83%)`,
  primary_500: `hsl(150, 24%, 64%)`,
  primary_600: `hsl(149, 44%, 72%)`,
  primary_700: `hsl(167, 35%, 60%)`,
  primary_800: `hsl(187, 42%, 36%)`,
  primary_900: `hsl(194, 32%, 25%)`,
  primary_950: `hsl(198, 18.4%, 14.8%)`,
  primary_975: `hsl(200, 50%, 7%)`,

  positive_25: '#ECFEFA',
  positive_50: '#E2FAF5',
  positive_100: '#D8F6F0',
  positive_200: '#CFF2EA',
  positive_300: '#C5EEE5',
  positive_400: '#BCEAE0',
  positive_500: '#B3E6DB',
  positive_600: '#82C4B6',
  positive_700: '#58A393',
  positive_800: '#378271',
  positive_900: '#1D6052',
  positive_950: '#0C3E34',
  positive_975: '#021D17',

  negative_25: '#FFF5F5',
  negative_50: '#FDE1E1',
  negative_100: '#FCCDCE',
  negative_200: '#FAB9BB',
  negative_300: '#F8A5A7',
  negative_400: '#F79295',
  negative_500: '#F57F82',
  negative_600: '#D45E61',
  negative_700: '#B34245',
  negative_800: '#932B2D',
  negative_900: '#72181B',
  negative_950: '#510B0D',
  negative_975: '#300304',
}

export const EVERGARDEN_SUBDUED_PALETTE: Palette = {
  white: '#F8F9E8',
  black: '#171C1F',
  pink: '#F3C0E5',
  yellow: '#F5D098',
  like: '#F3C0E5',

  contrast_0: '#F8F9E8',
  contrast_25: '#E1EDD6',
  contrast_50: '#D3E7E0',
  contrast_100: '#C3D7D0',
  contrast_200: '#ADC9BC',
  contrast_300: '#96B4AA',
  contrast_400: '#839E9A',
  contrast_500: '#7A9493',
  contrast_600: '#6F8788',
  contrast_700: '#4A585C',
  contrast_800: '#374145',
  contrast_900: '#2B3337',
  contrast_950: '#232A2E',
  contrast_975: '#1C2225',
  contrast_1000: '#171C1F',

  primary_25: `hsl(64, 30%, 97%)`,
  primary_50: `hsl(64, 30%, 95%)`,
  primary_100: `hsl(64, 30%, 90%)`,
  primary_200: `hsl(72, 42%, 86%)`,
  primary_300: `hsl(74, 54%, 84%)`,
  primary_400: `hsl(83, 46%, 83%)`,
  primary_500: `hsl(150, 24%, 64%)`,
  primary_600: `hsl(149, 44%, 72%)`,
  primary_700: `hsl(167, 35%, 60%)`,
  primary_800: `hsl(187, 42%, 36%)`,
  primary_900: `hsl(194, 32%, 25%)`,
  primary_950: `hsl(216, 48%, 10%)`,
  primary_975: `hsl(220, 50%, 7%)`,

  positive_25: '#ECFEFA',
  positive_50: '#E2FAF5',
  positive_100: '#D8F6F0',
  positive_200: '#CFF2EA',
  positive_300: '#C5EEE5',
  positive_400: '#BCEAE0',
  positive_500: '#B3E6DB',
  positive_600: '#82C4B6',
  positive_700: '#58A393',
  positive_800: '#378271',
  positive_900: '#1D6052',
  positive_950: '#0C3E34',
  positive_975: '#021D17',

  negative_25: '#FFF5F5',
  negative_50: '#FDE1E1',
  negative_100: '#FCCDCE',
  negative_200: '#FAB9BB',
  negative_300: '#F8A5A7',
  negative_400: '#F79295',
  negative_500: '#F57F82',
  negative_600: '#D45E61',
  negative_700: '#B34245',
  negative_800: '#932B2D',
  negative_900: '#72181B',
  negative_950: '#510B0D',
  negative_975: '#300304',
}

const EVERGARDEN_THEMES = createThemes({
  defaultPalette: EVERGARDEN_PALETTE,
  subduedPalette: EVERGARDEN_SUBDUED_PALETTE,
})

export const evergardenscheme = {
  lightPalette: EVERGARDEN_THEMES.light.palette,
  darkPalette: EVERGARDEN_THEMES.dark.palette,
  dimPalette: EVERGARDEN_THEMES.dim.palette,
  light: EVERGARDEN_THEMES.light,
  dark: EVERGARDEN_THEMES.dark,
  dim: EVERGARDEN_THEMES.dim,
}

function getMaterial3ColorScheme() {
  const MATERIAL_3_PALETTE: Palette = {
    white: STATIC_VALUES.white,
    black: STATIC_VALUES.black,
    pink: STATIC_VALUES.pink,
    yellow: STATIC_VALUES.yellow,
    like: STATIC_VALUES.pink,

    contrast_0: getMaterialYouColor('system_neutral1', 0),
    contrast_25: getMaterialYouColor('system_neutral1', 10),
    contrast_50: getMaterialYouColor('system_neutral1', 50),
    contrast_100: getMaterialYouColor('system_neutral1', 100),
    contrast_200: getMaterialYouColor('system_neutral1', 200),
    contrast_300: getMaterialYouColor('system_neutral1', 300),
    contrast_400: getMaterialYouColor('system_neutral1', 400),
    contrast_500: getMaterialYouColor('system_neutral1', 500),
    contrast_600: getMaterialYouColor('system_neutral1', 600),
    contrast_700: getMaterialYouColor('system_neutral1', 700),
    contrast_800: getMaterialYouColor('system_neutral1', 800),
    contrast_900: getMaterialYouColor('system_neutral1', 900),
    contrast_950: getMaterialYouColor('system_neutral1', 900),
    contrast_975: getMaterialYouColor('system_neutral1', 900),
    contrast_1000: getMaterialYouColor('system_neutral1', 1000),

    primary_25: getMaterialYouColor('system_accent1', 10),
    primary_50: getMaterialYouColor('system_accent1', 50),
    primary_100: getMaterialYouColor('system_accent1', 100),
    primary_200: getMaterialYouColor('system_accent1', 200),
    primary_300: getMaterialYouColor('system_accent1', 300),
    primary_400: getMaterialYouColor('system_accent1', 400),
    primary_500: getMaterialYouColor('system_accent1', 500),
    primary_600: getMaterialYouColor('system_accent1', 600),
    primary_700: getMaterialYouColor('system_accent1', 700),
    primary_800: getMaterialYouColor('system_accent1', 800),
    primary_900: getMaterialYouColor('system_accent1', 900),
    primary_950: getMaterialYouColor('system_accent1', 900),
    primary_975: getMaterialYouColor('system_accent1', 900),

    positive_25: getMaterialYouColor('system_accent3', 10),
    positive_50: getMaterialYouColor('system_accent3', 50),
    positive_100: getMaterialYouColor('system_accent3', 100),
    positive_200: getMaterialYouColor('system_accent3', 200),
    positive_300: getMaterialYouColor('system_accent3', 300),
    positive_400: getMaterialYouColor('system_accent3', 400),
    positive_500: getMaterialYouColor('system_accent3', 500),
    positive_600: getMaterialYouColor('system_accent3', 600),
    positive_700: getMaterialYouColor('system_accent3', 700),
    positive_800: getMaterialYouColor('system_accent3', 800),
    positive_900: getMaterialYouColor('system_accent3', 900),
    positive_950: getMaterialYouColor('system_accent3', 900),
    positive_975: getMaterialYouColor('system_accent3', 900),

    negative_25: '#FFF5F7',
    negative_50: '#FEE7EC',
    negative_100: '#FDD3DD',
    negative_200: '#FBBBCA',
    negative_300: '#F891A9',
    negative_400: '#F65A7F',
    negative_500: '#E91646',
    negative_600: '#CA123D',
    negative_700: '#A71134',
    negative_800: '#7F0B26',
    negative_900: '#5F071C',
    negative_950: '#430413',
    negative_975: '#30030D',
  }

  const MATERIAL_3_SUBDUED_PALETTE: Palette = {
    white: STATIC_VALUES.white,
    black: STATIC_VALUES.black,
    pink: STATIC_VALUES.pink,
    yellow: STATIC_VALUES.yellow,
    like: STATIC_VALUES.pink,

    contrast_0: getMaterialYouColor('system_neutral2', 0),
    contrast_25: getMaterialYouColor('system_neutral2', 10),
    contrast_50: getMaterialYouColor('system_neutral2', 50),
    contrast_100: getMaterialYouColor('system_neutral2', 100),
    contrast_200: getMaterialYouColor('system_neutral2', 200),
    contrast_300: getMaterialYouColor('system_neutral2', 300),
    contrast_400: getMaterialYouColor('system_neutral2', 400),
    contrast_500: getMaterialYouColor('system_neutral2', 500),
    contrast_600: getMaterialYouColor('system_neutral2', 600),
    contrast_700: getMaterialYouColor('system_neutral2', 700),
    contrast_800: getMaterialYouColor('system_neutral2', 800),
    contrast_900: getMaterialYouColor('system_neutral2', 800),
    contrast_950: getMaterialYouColor('system_neutral2', 800),
    contrast_975: getMaterialYouColor('system_neutral2', 800),
    contrast_1000: getMaterialYouColor('system_neutral2', 900),

    primary_25: getMaterialYouColor('system_accent2', 10),
    primary_50: getMaterialYouColor('system_accent2', 10),
    primary_100: getMaterialYouColor('system_accent2', 50),
    primary_200: getMaterialYouColor('system_accent2', 100),
    primary_300: getMaterialYouColor('system_accent2', 200),
    primary_400: getMaterialYouColor('system_accent2', 300),
    primary_500: getMaterialYouColor('system_accent2', 400),
    primary_600: getMaterialYouColor('system_accent2', 500),
    primary_700: getMaterialYouColor('system_accent2', 600),
    primary_800: getMaterialYouColor('system_accent2', 700),
    primary_900: getMaterialYouColor('system_accent2', 800),
    primary_950: getMaterialYouColor('system_accent2', 900),
    primary_975: getMaterialYouColor('system_accent2', 900),

    positive_25: getMaterialYouColor('system_accent3', 10),
    positive_50: getMaterialYouColor('system_accent3', 50),
    positive_100: getMaterialYouColor('system_accent3', 100),
    positive_200: getMaterialYouColor('system_accent3', 200),
    positive_300: getMaterialYouColor('system_accent3', 300),
    positive_400: getMaterialYouColor('system_accent3', 400),
    positive_500: getMaterialYouColor('system_accent3', 500),
    positive_600: getMaterialYouColor('system_accent3', 600),
    positive_700: getMaterialYouColor('system_accent3', 700),
    positive_800: getMaterialYouColor('system_accent3', 800),
    positive_900: getMaterialYouColor('system_accent3', 900),
    positive_950: getMaterialYouColor('system_accent3', 900),
    positive_975: getMaterialYouColor('system_accent3', 900),

    negative_25: '#FFF5F7',
    negative_50: '#FEEBEF',
    negative_100: '#FDD8E1',
    negative_200: '#FCC0CE',
    negative_300: '#F99AB0',
    negative_400: '#F76486',
    negative_500: '#EB2452',
    negative_600: '#D81341',
    negative_700: '#BA1239',
    negative_800: '#910D2C',
    negative_900: '#6F0B22',
    negative_950: '#500B1C',
    negative_975: '#3E0915',
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

let material3colorSchemeData = getMaterial3ColorScheme()

export let MATERIAL_3_PALETTE: Palette = material3colorSchemeData.regular
export let MATERIAL_3_SUBDUED_PALETTE: Palette =
  material3colorSchemeData.subdued
export let material3scheme = material3colorSchemeData.scheme

onMaterialYouPaletteChange(() => {
  material3colorSchemeData = getMaterial3ColorScheme()

  MATERIAL_3_PALETTE = material3colorSchemeData.regular
  MATERIAL_3_SUBDUED_PALETTE = material3colorSchemeData.subdued
  material3scheme = material3colorSchemeData.scheme
})

/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const lightPalette = DEFAULT_THEMES.light.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const darkPalette = DEFAULT_THEMES.dark.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const dimPalette = DEFAULT_THEMES.dim.palette
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const light = DEFAULT_THEMES.light
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dark = DEFAULT_THEMES.dark
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dim = DEFAULT_THEMES.dim
