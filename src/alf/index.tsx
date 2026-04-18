import {createContext, useCallback, useContext, useMemo, useState} from 'react'
import {createTheme, type Theme, type ThemeName} from '@bsky.app/alf'
import chroma from 'chroma-js'

import {useThemePrefs} from '#/state/shell/color-mode'
import {
  computeFontScaleMultiplier,
  getFontFamily,
  getFontScale,
  setFontFamily as persistFontFamily,
  setFontScale as persistFontScale,
} from '#/alf/fonts'
import {
  blackskyscheme,
  blueskyscheme,
  catppuccinscheme,
  deerscheme,
  evergardenscheme,
  kittyscheme,
  material3scheme,
  type Palette,
  reddwarfscheme,
  themes,
  witchskyscheme,
  zeppelinscheme,
} from '#/alf/themes'
import {IS_ANDROID} from '#/env'
import {type Device} from '#/storage'
import {MaterialYouPaletteProvider} from './util/materialYou'

export {
  type TextStyleProp,
  type Theme,
  utils,
  type ViewStyleProp,
} from '@bsky.app/alf'
export {atoms} from '#/alf/atoms'
export * from '#/alf/breakpoints'
export * from '#/alf/fonts'
export * as tokens from '#/alf/tokens'
export * from '#/alf/util/flatten'
export * from '#/alf/util/platform'
export * from '#/alf/util/themeSelector'
export * from '#/alf/util/useGutters'

export type Alf = {
  themeName: ThemeName
  theme: Theme
  themes: typeof themes
  fonts: {
    scale: Exclude<Device['fontScale'], undefined>
    scaleMultiplier: number
    family: Device['fontFamily']
    setFontScale: (fontScale: Exclude<Device['fontScale'], undefined>) => void
    setFontFamily: (fontFamily: Device['fontFamily']) => void
  }
  /**
   * Feature flags or other gated options
   */
  flags: {}
}

/*
 * Context
 */
export const Context = createContext<Alf>({
  themeName: 'light',
  theme: themes.light,
  themes,
  fonts: {
    scale: getFontScale(),
    scaleMultiplier: computeFontScaleMultiplier(getFontScale()),
    family: getFontFamily(),
    setFontScale: () => {},
    setFontFamily: () => {},
  },
  flags: {},
})
Context.displayName = 'AlfContext'

export type SchemeType = typeof themes

export function changeHue(colorStr: string, hueShift: number) {
  if (!hueShift || hueShift === 0) return colorStr

  const color = chroma(colorStr).oklch()

  const newHue = (color[2] + hueShift + 360) % 360

  return chroma.oklch(color[0], color[1], newHue).hex()
}

export function shiftPalette(palette: Palette, hueShift: number): Palette {
  const newPalette = {...palette}
  const keys = Object.keys(newPalette) as Array<keyof Palette>

  keys.forEach(key => {
    if (
      key.startsWith('positive_') ||
      key.startsWith('negative_') ||
      key === 'like' ||
      key === 'pink' ||
      key === 'yellow'
    ) {
      return
    }
    newPalette[key] = changeHue(newPalette[key], hueShift)
  })

  return newPalette
}

export function hueShifter(scheme: SchemeType, hueShift: number): SchemeType {
  if (!hueShift || hueShift === 0) {
    return scheme
  }

  const lightPalette = shiftPalette(scheme.lightPalette, hueShift)
  const darkPalette = shiftPalette(scheme.darkPalette, hueShift)
  const dimPalette = shiftPalette(scheme.dimPalette, hueShift)

  const light = createTheme({
    scheme: 'light',
    name: 'light',
    palette: lightPalette,
  })

  const dark = createTheme({
    scheme: 'dark',
    name: 'dark',
    palette: darkPalette,
    options: {
      shadowOpacity: 0.4,
    },
  })

  const dim = createTheme({
    scheme: 'dark',
    name: 'dim',
    palette: dimPalette,
    options: {
      shadowOpacity: 0.4,
    },
  })

  return {
    lightPalette,
    darkPalette,
    dimPalette,
    light,
    dark,
    dim,
  }
}

export function selectScheme(colorScheme: string | undefined): SchemeType {
  switch (colorScheme) {
    case 'witchsky':
      return witchskyscheme
    case 'bluesky':
      return blueskyscheme
    case 'blacksky':
      return blackskyscheme
    case 'deer':
      return deerscheme
    case 'zeppelin':
      return zeppelinscheme
    case 'kitty':
      return kittyscheme
    case 'reddwarf':
      return reddwarfscheme
    case 'catppuccin':
      return catppuccinscheme
    case 'evergarden':
      return evergardenscheme
    case 'material3':
      if (IS_ANDROID) {
        return material3scheme
      }
      return witchskyscheme
    default:
      return themes
  }
}

export function ThemeProvider({
  children,
  theme: themeName,
}: React.PropsWithChildren<{theme: ThemeName}>) {
  const {colorScheme, hue} = useThemePrefs()
  const currentScheme = selectScheme(colorScheme)
  const [fontScale, setFontScale] = useState<Alf['fonts']['scale']>(() =>
    getFontScale(),
  )
  const [fontScaleMultiplier, setFontScaleMultiplier] = useState(() =>
    computeFontScaleMultiplier(fontScale),
  )
  const setFontScaleAndPersist = useCallback<Alf['fonts']['setFontScale']>(
    fs => {
      setFontScale(fs)
      persistFontScale(fs)
      setFontScaleMultiplier(computeFontScaleMultiplier(fs))
    },
    [setFontScale],
  )
  const [fontFamily, setFontFamily] = useState<Alf['fonts']['family']>(() =>
    getFontFamily(),
  )
  const setFontFamilyAndPersist = useCallback<Alf['fonts']['setFontFamily']>(
    ff => {
      setFontFamily(ff)
      persistFontFamily(ff)
    },
    [setFontFamily],
  )

  const value = useMemo<Alf>(() => {
    const shiftedThemes = hueShifter(currentScheme, hue)

    return {
      themes: shiftedThemes,
      themeName: themeName,
      theme: shiftedThemes[themeName],
      fonts: {
        scale: fontScale,
        scaleMultiplier: fontScaleMultiplier,
        family: fontFamily,
        setFontScale: setFontScaleAndPersist,
        setFontFamily: setFontFamilyAndPersist,
      },
      flags: {},
    }
  }, [
    currentScheme,
    hue,
    themeName,
    fontScale,
    fontScaleMultiplier,
    fontFamily,
    setFontScaleAndPersist,
    setFontFamilyAndPersist,
  ])

  return (
    <MaterialYouPaletteProvider>
      <Context.Provider value={value}>{children}</Context.Provider>
    </MaterialYouPaletteProvider>
  )
}

export function useAlf() {
  return useContext(Context)
}

export function useTheme(theme?: ThemeName) {
  const alf = useAlf()
  return useMemo(() => {
    return theme ? alf.themes[theme] : alf.theme
  }, [theme, alf])
}
