import {useTheme} from '#/alf'
import {
  accentForeground,
  contrastForeground,
} from '#/features/themes/accentForeground'

/**
 * Shared support-link colors. Prefer the primary button's text color, falling
 * back only when it cannot be read against the theme's support green.
 */
export function useSupportPalette() {
  const t = useTheme()
  const light = t.name === 'light'
  const bg = light ? t.palette.positive_600 : t.palette.positive_400
  return {
    bg,
    bgHover: light ? t.palette.positive_700 : t.palette.positive_300,
    fg: contrastForeground(bg, accentForeground(t, t.palette.primary_500), 3),
    tintBg: t.palette.positive_25,
    tintBorder: t.palette.positive_100,
    tintText: t.palette.positive_700,
  }
}
