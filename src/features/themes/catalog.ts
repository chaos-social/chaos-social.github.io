import {materialYouRecord} from './materialYou'
import {type ActiveTheme, type ThemeRecord, type ThemeView} from './types'

const createdAt = '2026-08-18T00:00:00.000Z'
const themeCollection = 'app.witchsky.theme.colors'
const witchskyDid = 'did:plc:nstiflhvn4dywu5xlwq5wp4v'

export const WITCHSKY_THEME: ThemeRecord = {
  $type: themeCollection,
  name: 'Witchsky',
  description: 'Warm, magical colors designed for Witchsky.',
  mode: 'light',
  recommendedPair: `at://${witchskyDid}/${themeCollection}/3mug7d56zc42i`,
  createdAt,
  base: {
    name: 'Moonmilk',
    colors: {
      canvas: '#fefbfb',
      surface: '#f5f2f1',
      surfaceRaised: '#ffffff',
      text: '#281c1c',
      textMuted: '#755f57',
      border: '#d0cbc9',
      accent: '#ed5345',
      accentSoft: '#f8d8d4',
      onAccent: '#ffffff',
      positive: '#09b35e',
      warning: '#d89200',
      critical: '#e91646',
      favorite: '#dd5e8f',
    },
  },
}

export const WITCHSKY_DARK_THEME: ThemeRecord = {
  $type: themeCollection,
  name: 'Witchsky Dark',
  description: 'Warm, magical colors designed for Witchsky after dark.',
  mode: 'dark',
  recommendedPair: `at://${witchskyDid}/${themeCollection}/3mug7d56zc32i`,
  createdAt,
  base: {
    name: 'Coven',
    colors: {
      canvas: '#281c1c',
      surface: '#2f201f',
      surfaceRaised: '#3e2b21',
      text: '#fefbfb',
      textMuted: '#c0bbb9',
      border: '#624c43',
      accent: '#ed5345',
      accentSoft: '#431d19',
      onAccent: '#fefbfb',
      positive: '#0ac266',
      warning: '#ffc404',
      critical: '#eb2452',
      favorite: '#dd5e8f',
    },
  },
  variants: [
    {
      name: 'Midnight',
      colors: {
        canvas: '#150b08',
        surface: '#2a1a15',
        positive: '#09b35e',
        critical: '#e91646',
      },
    },
  ],
}

function fallback(record: ThemeRecord, rkey: string, cid: string): ThemeView {
  return {
    uri: `at://${witchskyDid}/${themeCollection}/${rkey}`,
    cid,
    author: 'witchsky.app',
    record,
    source: 'builtin',
  }
}

/** Used only when the remotely managed featured collection is unavailable. */
export const FEATURED_THEMES = [
  fallback(
    WITCHSKY_THEME,
    '3mug7d56zc32i',
    'bafyreiecuisoynzapf4u3qxezl3tpnsd6q7mgbsi7tttsfvnv5rb5k66wa',
  ),
  fallback(
    WITCHSKY_DARK_THEME,
    '3mug7d56zc42i',
    'bafyreifxzld23aw5pt3qkyp3af5mvzkleity3ldotxglk5g4uvvsleq7re',
  ),
]

export const WITCHSKY_ACTIVE_THEME: ActiveTheme = {
  light: {...FEATURED_THEMES[0], colorSet: 'Moonmilk'},
  dark: {...FEATURED_THEMES[1], colorSet: 'Coven'},
}

/**
 * Material You default. Colors are regenerated from the accent (web) or the
 * system palette (native) at runtime; the builtin cid keeps update polling
 * from asking users to replace a locally generated record.
 */
export const DEFAULT_ACTIVE_THEME: ActiveTheme = {
  light: {
    ...fallback(
      materialYouRecord('light'),
      '3mug7d56nl22i',
      'builtin-material-you',
    ),
    colorSet: 'Tonal Spot',
  },
  dark: {
    ...fallback(
      materialYouRecord('dark'),
      '3mug7d56zc22i',
      'builtin-material-you',
    ),
    colorSet: 'Tonal Spot',
  },
}
