import {View} from 'react-native'

import {getShapeRadius} from '#/lib/shapes'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Skele from '#/components/Skeleton'

export function ThreadItemReplyComposerSkeleton() {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const enableSquareAvatars = useEnableSquareAvatars()

  if (!gtMobile) return null

  return (
    <View style={[a.px_sm, a.py_xs, a.border_t, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.px_sm, a.py_sm]}>
        <Skele.Circle
          size={24}
          style={{borderRadius: getShapeRadius(enableSquareAvatars, 8, 999)}}
        />
        <Skele.Text style={[a.text_md, {maxWidth: 119}]} />
      </View>
    </View>
  )
}
