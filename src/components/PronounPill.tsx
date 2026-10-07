import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {getShapeStyle} from '#/lib/shapes'
import {sanitizePronouns} from '#/lib/strings/pronouns'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function PronounPill({
  pronouns,
  showLabel = false,
  style,
}: {
  pronouns?: string
  showLabel?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const square = useEnableSquareButtons()
  const label = sanitizePronouns(pronouns ?? '')
  if (!label) return null
  const pill = (
    <View
      style={[
        t.atoms.bg_contrast_50,
        getShapeStyle(square, a.rounded_xs, a.rounded_full),
        a.px_xs,
        a.py_2xs,
        a.flex_shrink,
        {maxWidth: '100%'},
        style,
      ]}>
      <Text
        emoji
        numberOfLines={1}
        style={[t.atoms.text_contrast_medium, a.text_xs, a.font_medium]}>
        {label}
      </Text>
    </View>
  )
  return showLabel ? (
    <View style={[a.flex_row, a.align_center, a.flex_shrink, a.gap_xs]}>
      {pill}
      <Text style={t.atoms.text_contrast_medium}>
        <Trans>pronouns</Trans>
      </Text>
    </View>
  ) : (
    pill
  )
}
