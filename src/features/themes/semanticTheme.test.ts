import {WITCHSKY_ACTIVE_THEME} from './catalog'
import {activeThemeToScheme} from './semanticTheme'
import {
  getColorSet,
  getColorSets,
  HUE_SPECIAL,
  isSupportedTheme,
  MATERIAL_YOU_SPECIAL,
  themeColorsChanged,
} from './types'

describe('Witchsky theme records', () => {
  it('keeps mode on each record and named variants inside it', () => {
    const light = getColorSet(WITCHSKY_ACTIVE_THEME.light.record, 'Moonmilk')
    const dark = getColorSet(WITCHSKY_ACTIVE_THEME.dark.record, 'Coven')

    expect(WITCHSKY_ACTIVE_THEME.light.record.mode).toBe('light')
    expect(WITCHSKY_ACTIVE_THEME.dark.record.mode).toBe('dark')
    expect(light?.name).toBe('Moonmilk')
    expect(dark?.name).toBe('Coven')
    expect(getColorSets(WITCHSKY_ACTIVE_THEME.dark.record)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({name: 'Coven'}),
        expect.objectContaining({name: 'Midnight'}),
      ]),
    )
    expect(WITCHSKY_ACTIVE_THEME.dark.record.variants?.[0].colors).toEqual({
      canvas: '#150b08',
      surface: '#2a1a15',
      positive: '#09b35e',
      critical: '#e91646',
    })
  })

  it('maps semantic roles into an ALF scheme without changing canvas or accent', () => {
    const scheme = activeThemeToScheme(WITCHSKY_ACTIVE_THEME)

    expect(scheme?.light.atoms.bg.backgroundColor).toBe('#fefbfb')
    expect(scheme?.light.palette.contrast_200).toBe('#d0cbc9')
    expect(scheme?.light.palette.contrast_700).toBe('#755f57')
    expect(scheme?.light.palette.primary_500).toBe('#ed5345')
    expect(scheme?.dark.atoms.bg.backgroundColor).toBe('#281c1c')
    expect(scheme?.dark.palette.contrast_50).toBe('#3e2b21')
    expect(scheme?.dark.palette.contrast_100).toBe('#624c43')
    expect(scheme?.dark.palette.contrast_200).toBe('#624c43')
    expect(scheme?.dark.palette.contrast_400).toBe('#887872')
    expect(scheme?.dark.palette.contrast_700).toBe('#c0bbb9')
    expect(scheme?.dark.palette.primary_500).toBe('#ed5345')
    expect(scheme?.dark.palette.white).toBe('#ffffff')
    expect(scheme?.dark.palette.black).toBe('#000000')
  })

  it('only treats color changes as theme updates', () => {
    const current = WITCHSKY_ACTIVE_THEME.light.record
    expect(
      themeColorsChanged(current, {
        ...current,
        name: 'Renamed theme',
        description: 'New description',
      }),
    ).toBe(false)
    expect(
      themeColorsChanged(current, {
        ...current,
        base: {
          ...current.base,
          colors: {...current.base.colors, accent: '#000000'},
        },
      }),
    ).toBe(true)
  })

  it('allows clients to hide unsupported special themes', () => {
    const current = WITCHSKY_ACTIVE_THEME.light.record
    expect(
      isSupportedTheme({
        ...current,
        special: {$type: 'app.witchsky.theme.colors#futureGenerator'},
      }),
    ).toBe(false)
    expect(
      isSupportedTheme({
        ...current,
        special: {$type: MATERIAL_YOU_SPECIAL, accent: '#6750a4'},
      }),
    ).toBe(true)
    expect(isSupportedTheme({...current, special: {$type: HUE_SPECIAL}})).toBe(
      true,
    )
  })

  it('hue-shifts only the active mode whose record opts in', () => {
    const scheme = activeThemeToScheme({
      ...WITCHSKY_ACTIVE_THEME,
      light: {
        ...WITCHSKY_ACTIVE_THEME.light,
        record: {
          ...WITCHSKY_ACTIVE_THEME.light.record,
          special: {$type: HUE_SPECIAL},
        },
        hue: 90,
      },
    })

    expect(scheme?.light.palette.primary_500).not.toBe('#ed5345')
    expect(scheme?.dark.palette.primary_500).toBe('#ed5345')
  })
})
