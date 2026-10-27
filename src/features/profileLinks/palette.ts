import chroma from 'chroma-js'

import {useTheme} from '#/alf'

/** Keep the theme's support hue while making small white labels readable. */
function supportBackground(color: string) {
  let background = color
  while (chroma.contrast(background, '#ffffff') < 4.5) {
    background = chroma(background).darken(0.1).hex()
  }
  return background
}

/**
 * Support labels use white on a sufficiently dark fill. Primary-button text
 * may be dark in Material You and cannot be reused on these mid-tone fills.
 */
export function useSupportPalette() {
  const t = useTheme()
  const light = t.name === 'light'
  return {
    bg: supportBackground(light ? t.palette.positive_600 : t.palette.positive_400),
    bgHover: supportBackground(
      light ? t.palette.positive_700 : t.palette.positive_300,
    ),
    fg: '#ffffff',
    tintBg: t.palette.positive_25,
    tintBorder: t.palette.positive_100,
    tintText: t.palette.positive_700,
  }
}
