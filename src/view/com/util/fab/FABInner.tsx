import {type ComponentProps, type JSX, useRef} from 'react'
import {
  type GestureResponderEvent,
  type Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {useHaptics} from '#/lib/haptics'
import {useMinimalShellFabTransform} from '#/lib/hooks/useMinimalShellTransform'
import {clamp} from '#/lib/numbers'
import {getShapeStyle} from '#/lib/shapes'
import {userStyle} from '#/lib/userstyles'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, ios, useBreakpoints, useTheme} from '#/alf'
import {IS_WEB} from '#/env'

/**
 * Minimum time between the press-in and release haptics on iOS, so a quick tap
 * still plays two distinct taps.
 */
const MIN_HAPTIC_GAP_MS = 50

export interface FABProps extends ComponentProps<typeof Pressable> {
  testID?: string
  icon: JSX.Element
  style?: StyleProp<ViewStyle>
  userStyleVariant?: 'compose'
}

export function FABInner({
  testID,
  icon,
  onPress,
  style,
  userStyleVariant,
  ...props
}: FABProps) {
  const insets = useSafeAreaInsets()
  const {gtMobile} = useBreakpoints()
  const t = useTheme()
  const haptics = useHaptics()
  const pressInHapticAt = useRef(0)
  const fabMinimalShellTransform = useMinimalShellFabTransform()

  const enableSquareButtons = useEnableSquareButtons()

  const size = gtMobile
    ? getShapeStyle(
        enableSquareButtons,
        styles.sizeLargeSquare,
        styles.sizeLarge,
      )
    : getShapeStyle(
        enableSquareButtons,
        styles.sizeRegularSquare,
        styles.sizeRegular,
      )

  const tabletSpacing = gtMobile
    ? {right: 50, bottom: 50}
    : {right: 24, bottom: IS_WEB ? 24 : clamp(insets.bottom, 15, 60) + 15}

  return (
    <Animated.View
      style={[
        userStyle(
          'wsky-fab',
          userStyleVariant === 'compose' && 'wsky-fab--compose',
        ),
        styles.outer,
        size,
        tabletSpacing,
        !gtMobile && fabMinimalShellTransform,
      ]}>
      <PressableScale
        testID={testID}
        onPressIn={ios(() => {
          pressInHapticAt.current = Date.now()
          haptics.tap()
        })}
        onPress={evt => {
          onPress?.(evt)
          const elapsed = Date.now() - pressInHapticAt.current
          if (elapsed < MIN_HAPTIC_GAP_MS) {
            setTimeout(haptics.tap, MIN_HAPTIC_GAP_MS - elapsed)
          } else {
            haptics.tap()
          }
        }}
        onLongPress={ios((evt: GestureResponderEvent) => {
          onPress?.(evt)
          haptics.longPress()
        })}
        targetScale={0.9}
        style={[
          getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
          size,
          {backgroundColor: t.palette.primary_500},
          a.align_center,
          a.justify_center,
          style,
        ]}
        {...props}>
        {icon}
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sizeRegular: {
    width: 56,
    height: 56,
    borderRadius: 30,
  },
  sizeLarge: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  sizeRegularSquare: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  sizeLargeSquare: {
    width: 70,
    height: 70,
    borderRadius: 15,
  },
  outer: {
    // @ts-expect-error web-only
    position: IS_WEB ? 'fixed' : 'absolute',
    zIndex: 1,
    cursor: 'pointer',
  },
})
