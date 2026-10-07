import {Pressable, View} from 'react-native'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useBreakpoints, web} from '#/alf'
import {Heart2_Filled_Stroke2_Corner0_Rounded as HeartIcon} from '#/components/icons/Heart2'
import {Text} from '#/components/Typography'
import {type ThemeColorSet} from './types'

export function ThemeVariantCard({
  colorSet,
  selected,
  onPress,
}: {
  colorSet: ThemeColorSet
  selected: boolean
  onPress: () => void
}) {
  const enableSquareButtons = useEnableSquareButtons()
  const {gtMobile} = useBreakpoints()
  const colors = colorSet.colors
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={colorSet.name}
      accessibilityHint=""
      onPress={onPress}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.p_sm,
        a.pl_md,
        getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_md),
        {
          flexBasis: gtMobile ? '30%' : '46%',
          flexGrow: gtMobile ? 0 : 1,
          flexShrink: 1,
          minWidth: gtMobile ? 150 : 0,
          maxWidth: gtMobile ? 190 : '48%',
          minHeight: 56,
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderWidth: 1,
        },
        web(
          gtMobile
            ? {
                flexBasis: 'calc((100% - 32px) / 3)',
                maxWidth: 'calc((100% - 32px) / 3)',
              }
            : {
                flexBasis: 'calc((100% - 16px) / 2)',
                maxWidth: 'calc((100% - 16px) / 2)',
              },
        ),
      ]}>
      <HeartIcon width={24} style={{color: colors.accent, marginLeft: 2}} />
      <Text
        numberOfLines={2}
        style={[a.flex_1, a.text_lg, a.font_bold, {color: colors.text}]}>
        {colorSet.name}
      </Text>
      {selected && (
        <View
          pointerEvents="none"
          style={[
            a.absolute,
            a.inset_0,
            getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_md),
            {borderColor: colors.accent, borderWidth: 2},
          ]}
        />
      )}
    </Pressable>
  )
}
