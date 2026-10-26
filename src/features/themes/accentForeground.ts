import {type Theme} from '@bsky.app/alf'
import chroma from 'chroma-js'

// eslint-disable-next-line import/no-named-as-default-member -- Installed typings expose these methods only on the default export.
const {valid, contrast} = chroma

/** Honor authored on-accent colors; infer contrast only for legacy themes. */
export function accentForeground(
  theme: Theme & {onAccent?: string},
  background: string,
) {
  if (theme.onAccent && valid(theme.onAccent)) return theme.onAccent

  return contrastForeground(background, theme.palette.white)
}

/** Chooses a readable foreground for semantic or provider-colored surfaces. */
export function contrastForeground(
  background: string,
  preferred = '#ffffff',
  minimumContrast = 4.5,
) {
  if (!valid(background)) return preferred
  if (valid(preferred) && contrast(preferred, background) >= minimumContrast) {
    return preferred
  }
  return contrast('#000000', background) >= contrast('#ffffff', background)
    ? '#000000'
    : '#ffffff'
}
