import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {type PollVoteValue} from '#/lib/api/poll'
import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Pressable} from '#/components/Pressable'
import {Text} from '#/components/Typography'

export function VoteButtons({
  onVote,
  disabled,
  pending,
  passLabel,
}: {
  onVote: (value: PollVoteValue) => void
  disabled?: boolean
  pending?: boolean
  passLabel?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const shapePreference = useEnableSquareButtons()
  // Same corners as the event RSVP buttons, which are house `Button`s.
  const shape = getShapeStyle(shapePreference, a.rounded_sm, a.rounded_full)

  const options: {
    value: PollVoteValue
    label: string
    hint: string
    color: string
    border: string
    hover: string
  }[] = [
    {
      value: 'agree',
      label: l`Agree`,
      hint: l`Vote agree on this statement`,
      color: t.palette.positive_500,
      border: t.palette.positive_500,
      hover: t.atoms.bg_contrast_50.backgroundColor,
    },
    {
      value: 'disagree',
      label: l`Disagree`,
      hint: l`Vote disagree on this statement`,
      color: t.palette.negative_500,
      border: t.palette.negative_500,
      hover: t.atoms.bg_contrast_50.backgroundColor,
    },
    {
      value: 'pass',
      label: passLabel ?? l`Pass`,
      hint: l`Pass on this statement`,
      color: t.atoms.text_contrast_medium.color,
      border: t.atoms.border_contrast_low.borderColor,
      hover: t.atoms.bg_contrast_50.backgroundColor,
    },
  ]

  return (
    <View style={[a.flex_row, a.gap_sm]} onStartShouldSetResponder={() => true}>
      {options.map(option => (
        <Pressable
          key={option.value}
          testID={`pollVote-${option.value}`}
          style={({hovered}) => [
            a.flex_1,
            a.align_center,
            a.py_sm,
            a.border,
            shape,
            {
              borderColor: option.border,
              backgroundColor: hovered
                ? option.hover
                : t.atoms.bg_contrast_25.backgroundColor,
            },
          ]}
          onPress={() => onVote(option.value)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityHint={option.hint}
          accessibilityState={{disabled: !!disabled}}>
          <Text style={[a.text_sm, a.font_semi_bold, {color: option.color}]}>
            {pending ? '...' : option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
