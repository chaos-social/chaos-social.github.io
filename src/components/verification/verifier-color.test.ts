import {chroma} from '#/platform/chroma-formats'
import {accentForeground} from '#/features/themes/accentForeground'
import {DEFAULT_ACTIVE_THEME} from '#/features/themes/catalog'
import {activeThemeToScheme} from '#/features/themes/semanticTheme'
import {verifierColor} from './verifier-color'

const themes = activeThemeToScheme(DEFAULT_ACTIVE_THEME)!

it('keeps a broad range of DID colors readable in both color modes', () => {
  for (const theme of [themes.light, themes.dark]) {
    const colors = new Set<string>()
    for (let i = 0; i < 360; i++) {
      const did = `did:plc:account${i}`
      const background = verifierColor(did, theme)
      colors.add(background)
      expect(verifierColor(did, theme)).toBe(background)
      expect(
        chroma.contrast(background, theme.palette.contrast_0),
      ).toBeGreaterThanOrEqual(3)
      const foreground = accentForeground(
        {...theme, onAccent: undefined},
        background,
      )
      expect(chroma.contrast(background, foreground)).toBeGreaterThanOrEqual(
        4.5,
      )
    }
    expect(colors.size).toBeGreaterThan(180)
  }
})
