import {accentForeground, contrastForeground} from './accentForeground'
import {DEFAULT_ACTIVE_THEME} from './catalog'
import {activeThemeToScheme} from './semanticTheme'

const theme = activeThemeToScheme(DEFAULT_ACTIVE_THEME)!.light

it('carries the authored on-accent role into the runtime theme', () => {
  expect(theme.onAccent).toBe(
    DEFAULT_ACTIVE_THEME.light.record.base.colors.onAccent,
  )
  expect(theme.palette.white).toBe('#ffffff')
})

it('preserves a readable authored foreground', () => {
  expect(accentForeground({...theme, onAccent: '#172400'}, '#c4ff00')).toBe(
    '#172400',
  )
})

it('honors explicit white even on a bright accent', () => {
  expect(accentForeground({...theme, onAccent: '#ffffff'}, '#c4ff00')).toBe(
    '#ffffff',
  )
})

it('preserves the authored foreground across interaction backgrounds', () => {
  const authored = {...theme, onAccent: '#111111'}
  expect(accentForeground(authored, '#f5f500')).toBe('#111111')
  expect(accentForeground(authored, '#202000')).toBe('#111111')
})

it('supports legacy themes without an authored foreground', () => {
  expect(accentForeground({...theme, onAccent: undefined}, '#ffff00')).toBe(
    '#000000',
  )
})

it('preserves the light Witchsky Dark foreground on its coral accent', () => {
  expect(accentForeground({...theme, onAccent: '#fefbfb'}, '#ed5345')).toBe(
    '#fefbfb',
  )
})

it('retains white on dark support green independently of the accent foreground', () => {
  expect(contrastForeground('#16844a')).toBe('#ffffff')
})

it('uses dark text when a themed support color is too light for white', () => {
  expect(contrastForeground('#b9f6ca')).toBe('#000000')
})

it('keeps a readable preferred foreground on a semantic background', () => {
  expect(contrastForeground('#202000', '#fefbfb')).toBe('#fefbfb')
})

it('keeps the primary button foreground on the original green support chip', () => {
  expect(contrastForeground('#119d56', '#ffffff', 3)).toBe('#ffffff')
  expect(contrastForeground('#119d56', '#fefbfb', 3)).toBe('#fefbfb')
})

it('still falls back for support themes with an indistinguishable foreground', () => {
  expect(contrastForeground('#b9f6ca', '#ffffff', 3)).toBe('#000000')
})
