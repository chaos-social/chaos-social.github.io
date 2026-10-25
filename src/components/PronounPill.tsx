import {useState} from 'react'
import {Pressable, type StyleProp, View, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {getShapeStyle} from '#/lib/shapes'
import {sanitizePronouns} from '#/lib/strings/pronouns'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, tokens, useTheme, web} from '#/alf'
import {CircleSlash_Stroke2_Corner0_Rounded as CircleSlash} from '#/components/icons/Circle'
import * as Tooltip from '#/components/Tooltip'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'

export function PronounPill({
  pronouns,
  showIcon = false,
  style,
}: {
  pronouns?: string
  showIcon?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [tooltipVisible, setTooltipVisible] = useState(false)
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
  if (!showIcon) return pill

  const contents = (
    <>
      <CircleSlash
        width={tokens.space.lg}
        style={t.atoms.text_contrast_medium}
      />
      {pill}
    </>
  )

  return IS_NATIVE ? (
    <Tooltip.Outer
      color="primary"
      visible={tooltipVisible}
      onVisibleChange={setTooltipVisible}>
      <Tooltip.Target>
        <Pressable
          testID="profilePronouns"
          accessibilityRole="button"
          accessibilityLabel={l`Pronouns: ${label}`}
          accessibilityHint=""
          style={[a.flex_row, a.align_center, a.flex_shrink, a.gap_xs]}
          onPress={() => setTooltipVisible(visible => !visible)}>
          {contents}
        </Pressable>
      </Tooltip.Target>
      <Tooltip.BubbleText label={l`Pronouns`}>{l`Pronouns`}</Tooltip.BubbleText>
    </Tooltip.Outer>
  ) : (
    <View
      style={[a.flex_row, a.align_center, a.flex_shrink, a.gap_xs]}
      {...web({dataSet: {tooltip: l`Pronouns`, tooltipPos: 'top'}})}>
      {contents}
    </View>
  )
}
