import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** One option of a poll as a percentage bar, highlighted if the viewer picked it. */
export function PollBar({
  label,
  pct,
  mine,
}: {
  label: string
  pct: number
  mine: boolean
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.relative,
        a.rounded_xs,
        a.border,
        a.overflow_hidden,
        mine ? t.atoms.bg_contrast_25 : null,
        t.atoms.border_contrast_low,
      ]}>
      <View
        style={[
          {position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`},
          {backgroundColor: t.palette.primary_100},
        ]}
      />
      <View
        style={[
          a.flex_row,
          a.justify_between,
          a.align_center,
          a.gap_sm,
          a.px_sm,
          a.py_xs,
        ]}>
        <Text
          emoji
          style={[a.text_sm, mine && a.font_bold, a.flex_1, a.leading_snug]}
          numberOfLines={2}>
          {label}
        </Text>
        <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_high]}>
          {pct}%
        </Text>
      </View>
    </View>
  )
}
