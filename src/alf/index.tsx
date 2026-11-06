import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import {
  createTheme,
  type Theme,
  type ThemeName,
  utils as baseUtils,
} from '@bsky.app/alf'
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
  cyanscheme,
  deerscheme,
  evergardenscheme,
  kittyscheme,
  type Palette,
  reddwarfscheme,
  themes,
  zeppelinscheme,
} from '#/alf/themes'
import {
  contrastRatio,
  darken,
  lighten,
  rgbToHex,
} from '#/alf/util/colorGeneration'
import {IS_WEB} from '#/env'
import {DEFAULT_ACTIVE_THEME} from '#/features/themes/catalog'
import {resolveMaterialYouRecord} from '#/features/themes/materialYou'
import {activeThemeToScheme} from '#/features/themes/semanticTheme'
import {isSupportedTheme} from '#/features/themes/types'
import {type Device} from '#/storage'
import {getMaterial3Colors} from './util/material3Theme'
import {
  MaterialYouPaletteProvider,
  useMaterialYouPalette,
} from './util/materialYou'

export {type TextStyleProp, type Theme, type ViewStyleProp} from '@bsky.app/alf'
export {atoms} from '#/alf/atoms'
export * from '#/alf/breakpoints'
export * from '#/alf/fonts'
export * as tokens from '#/alf/tokens'
export * from '#/alf/util/flatten'
export * from '#/alf/util/platform'
export * from '#/alf/util/themeSelector'
export * from '#/alf/util/useGutters'
export const utils = {
  ...baseUtils,
  rgbToHex,
  lighten,
  darken,
  contrastRatio,
}

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

export function useScheme(): SchemeType {
  const {hue, colorScheme, activeTheme, material3Accent} = useThemePrefs()
  const palette = useMaterialYouPalette()

  return useMemo(() => {
    const supportedTheme =
      activeTheme &&
      isSupportedTheme(activeTheme.light.record) &&
      isSupportedTheme(activeTheme.dark.record)
        ? activeTheme
        : DEFAULT_ACTIVE_THEME
    const recordScheme = activeThemeToScheme({
      light: {
        ...supportedTheme.light,
        record: resolveMaterialYouRecord(
          supportedTheme.light.record,
          palette,
          material3Accent,
          IS_WEB,
        ),
      },
      dark: {
        ...supportedTheme.dark,
        record: resolveMaterialYouRecord(
          supportedTheme.dark.record,
          palette,
          material3Accent,
          IS_WEB,
        ),
      },
    })
    /*
     * A stored theme wins. Without one, only the legacy colorScheme picker
     * keeps its palette; the default is now the Material You theme.
     */
    if (recordScheme && (activeTheme || colorScheme === 'witchsky')) {
      return recordScheme
    }
    let currentScheme = themes
    switch (colorScheme) {
      case 'bluesky':
        currentScheme = blueskyscheme
        break
      case 'blacksky':
        currentScheme = blackskyscheme
        break
      case 'deer':
        currentScheme = deerscheme
        break
      case 'zeppelin':
        currentScheme = zeppelinscheme
        break
      case 'kitty':
        currentScheme = kittyscheme
        break
      case 'reddwarf':
        currentScheme = reddwarfscheme
        break
      case 'catppuccin':
        currentScheme = catppuccinscheme
        break
      case 'evergarden':
        currentScheme = evergardenscheme
        break
      case 'cyan base':
        currentScheme = cyanscheme
        break
      case 'material3':
        currentScheme = getMaterial3Colors(palette).scheme
        break
      default:
        currentScheme = themes
        break
    }

    return hueShifter(currentScheme, hue)
  }, [activeTheme, colorScheme, hue, palette, material3Accent])
}

function ThemeProviderInner({
  children,
  theme: themeName,
  themesOverride,
  syncDocument = false,
}: React.PropsWithChildren<{
  theme: ThemeName
  themesOverride?: Partial<typeof themes>
  syncDocument?: boolean
}>) {
  const currentScheme = useScheme()
  const {colorMode, darkTheme} = useThemePrefs()
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
    // Use currentScheme for Witchsky's custom theming, but allow themesOverride from upstream
    const t = themesOverride ? {...themes, ...themesOverride} : currentScheme
    return {
      themes: t,
      themeName: themeName,
      theme: t[themeName],
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
    themeName,
    fontScale,
    fontScaleMultiplier,
    fontFamily,
    setFontScaleAndPersist,
    setFontFamilyAndPersist,
    themesOverride,
  ])

  useLayoutEffect(() => {
    if (!IS_WEB || !syncDocument) return
    const t = value.theme
    const root = document.documentElement
    root.style.setProperty('--background', t.palette.contrast_0)
    root.style.setProperty('--text', t.palette.contrast_1000)
    root.style.setProperty('--backgroundLight', t.palette.contrast_25)
    root.style.setProperty('--splash-logo', t.palette.primary_500)
    root.style.backgroundColor = t.palette.contrast_0
    root.style.colorScheme = t.scheme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', t.palette.contrast_0)
    try {
      const colors = (theme: Theme) => ({
        background: theme.palette.contrast_0,
        text: theme.palette.contrast_1000,
        surface: theme.palette.contrast_25,
        accent: theme.palette.primary_500,
        scheme: theme.scheme,
      })
      localStorage.setItem(
        'WITCHSKY_SPLASH',
        JSON.stringify({
          mode: colorMode,
          light: colors(value.themes.light),
          dark: colors(value.themes[darkTheme ?? 'dim']),
        }),
      )
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [value.theme, value.themes, colorMode, darkTheme, syncDocument])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function ThemeProvider({
  children,
  theme: themeName,
  syncDocument = false,
}: React.PropsWithChildren<{
  theme: ThemeName
  /** Only the app's root provider should update the web document and splash cache. */
  syncDocument?: boolean
}>) {
  const {material3Accent, material3Style} = useThemePrefs()
  return (
    <MaterialYouPaletteProvider accent={material3Accent} style={material3Style}>
      <ThemeProviderInner theme={themeName} syncDocument={syncDocument}>
        {children}
      </ThemeProviderInner>
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
