import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {getShapeRadius} from '#/lib/shapes'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {atoms as a, useTheme} from '#/alf'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import * as Skele from '#/components/Skeleton'
import {Text} from '#/components/Typography'

export function ThreadItemAnchorNoUnauthenticated() {
  const t = useTheme()
  const enableSquareAvatars = useEnableSquareAvatars()

  return (
    <View style={[a.p_lg, a.gap_md]}>
      <Skele.Row style={[a.align_center, a.gap_md]}>
        <Skele.Circle
          size={42}
          style={{borderRadius: getShapeRadius(enableSquareAvatars, 8, 999)}}>
          <LockIcon size="md" fill={t.atoms.text_contrast_medium.color} />
        </Skele.Circle>

        <Skele.Col>
          <Skele.Text style={[a.text_lg, {width: '20%'}]} />
          <Skele.Text blend style={[a.text_md, {width: '40%'}]} />
        </Skele.Col>
      </Skele.Row>

      <View style={[a.py_sm]}>
        <Text style={[a.text_xl, a.italic, t.atoms.text_contrast_medium]}>
          <Trans>
            This author has chosen to make their posts visible only to people
            who are signed in.
          </Trans>
        </Text>
      </View>
    </View>
  )
}
