import {renderHook} from '@testing-library/react-native'
import chroma from 'chroma-js'

import {useTheme} from '#/alf'
import {DEFAULT_ACTIVE_THEME} from '#/features/themes/catalog'
import {
  MATERIAL_YOU_STYLES,
  materialYouRecord,
} from '#/features/themes/materialYou'
import {activeThemeToScheme} from '#/features/themes/semanticTheme'
import {useSupportPalette} from './palette'

jest.mock('#/alf', () => ({useTheme: jest.fn()}))

const scheme = activeThemeToScheme(DEFAULT_ACTIVE_THEME)!

it.each(['#7a7487', '#9e6f01'])(
  'uses readable white labels on the reported support fill %s',
  background => {
    const theme = {
      ...scheme.dark,
      onAccent: '#352000',
      palette: {
        ...scheme.dark.palette,
        positive_400: background,
        positive_300: background,
      },
    }
    jest.mocked(useTheme).mockReturnValue(theme)
    const {result} = renderHook(() => useSupportPalette())
    expect(result.current.fg).toBe('#ffffff')
    expect(chroma.contrast(result.current.bg, result.current.fg)).toBeGreaterThanOrEqual(4.5)
    expect(chroma.contrast(result.current.bgHover, result.current.fg)).toBeGreaterThanOrEqual(4.5)
  },
)

it('preserves existing support fills that already have sufficient contrast', () => {
  jest.mocked(useTheme).mockReturnValue({
    ...scheme.light,
    palette: {
      ...scheme.light.palette,
      positive_600: '#16844a',
      positive_700: '#126b3c',
    },
  })
  const {result} = renderHook(() => useSupportPalette())
  expect(result.current.bg).toBe('#16844a')
  expect(result.current.bgHover).toBe('#126b3c')
})

it.each(MATERIAL_YOU_STYLES)(
  'keeps support text readable in every mode for $label',
  ({label}) => {
    const material = activeThemeToScheme({
      light: {
        ...DEFAULT_ACTIVE_THEME.light,
        record: materialYouRecord('light', '#9e6f01'),
        colorSet: label,
      },
      dark: {
        ...DEFAULT_ACTIVE_THEME.dark,
        record: materialYouRecord('dark', '#9e6f01'),
        colorSet: label,
      },
    })!
    for (const theme of [material.light, material.dark, material.dim]) {
      jest.mocked(useTheme).mockReturnValue(theme)
      const {result, unmount} = renderHook(() => useSupportPalette())
      for (const background of [result.current.bg, result.current.bgHover]) {
        expect(chroma.contrast(background, result.current.fg)).toBeGreaterThanOrEqual(4.5)
      }
      unmount()
    }
  },
)
