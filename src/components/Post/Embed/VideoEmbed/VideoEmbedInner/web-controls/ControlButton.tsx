import {type SvgProps} from 'react-native-svg'

import {getShapeStyle, SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme, web} from '#/alf'

export function ControlButton({
  testID,
  disabled = false,
  active,
  activeLabel,
  inactiveLabel,
  activeIcon: ActiveIcon,
  inactiveIcon: InactiveIcon,
  onPress,
}: {
  testID?: string
  disabled?: boolean
  active: boolean
  activeLabel: string
  inactiveLabel: string
  activeIcon: React.ComponentType<Pick<SvgProps, 'fill' | 'width'>>
  inactiveIcon: React.ComponentType<Pick<SvgProps, 'fill' | 'width'>>
  onPress: () => void
}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <PressableWithHover
      testID={testID}
      disabled={disabled}
      accessibilityState={{disabled}}
      accessibilityRole="button"
      accessibilityLabel={active ? activeLabel : inactiveLabel}
      accessibilityHint=""
      onPress={onPress}
      style={[
        a.p_xs,
        getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
        web({transition: 'background-color 0.1s'}),
        enableSquareButtons === 'sharp' && SHARP_CORNERS,
      ]}
      hoverStyle={{backgroundColor: 'rgba(255, 255, 255, 0.2)'}}>
      {active ? (
        <ActiveIcon fill={t.palette.white} width={20} aria-hidden />
      ) : (
        <InactiveIcon fill={t.palette.white} width={20} aria-hidden />
      )}
    </PressableWithHover>
  )
}
