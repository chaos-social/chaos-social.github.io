import {View} from 'react-native'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Play_Filled_Corner0_Rounded as PlayIcon} from '#/components/icons/Play'

export function PlayButtonIcon({size = 32}: {size?: number}) {
  const t = useTheme()
  const bg = t.name === 'light' ? t.palette.contrast_25 : t.palette.contrast_975
  const fg = t.name === 'light' ? t.palette.contrast_975 : t.palette.contrast_25

  const enableSquareButtons = useEnableSquareButtons()

  /*
   * The glyph is absolutely positioned, so it needs a positioned box of its
   * own to sit in. Without this wrapper it anchors to whatever happens to be
   * positioned further up - or to the top of the nearest block - which puts it
   * at the top edge of the circle instead of the middle.
   */
  return (
    <View
      style={[
        a.relative,
        {
          width: size + size / 1.5,
          height: size + size / 1.5,
        },
      ]}>
      <View
        style={[
          getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
          {
            backgroundColor: bg,
            shadowColor: 'black',
            shadowRadius: 32,
            shadowOpacity: 0.5,
            elevation: 24,
            opacity: 0.7,
            width: size + size / 1.5,
            height: size + size / 1.5,
          },
        ]}
      />
      {/* Centred explicitly: an absolute child with no insets sits at 0,0. */}
      <PlayIcon
        width={size}
        fill={fg}
        style={[a.absolute, {top: size / 3, left: size / 3}]}
      />
    </View>
  )
}
