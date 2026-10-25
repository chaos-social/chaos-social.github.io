import {forwardRef, useCallback, useEffect, useState} from 'react'
import {AccessibilityInfo, View} from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Svg, {Path, type SvgProps} from 'react-native-svg'
import {scheduleOnRN} from 'react-native-worklets'
import * as SplashScreen from 'expo-splash-screen'

import {Logotype} from '#/view/icons/Logotype'
import {atoms as a, useTheme} from '#/alf'

export const Logo = forwardRef(function LogoImpl(props: SvgProps, ref) {
  const width = 1000
  const height = width * (67 / 64)
  return (
    <Svg
      fill="none"
      // @ts-expect-error it's fiiiiine
      ref={ref}
      viewBox="0 0 512 512"
      style={[{width, height}, props.style]}>
      <Path
        fill={props.fill || '#fff'}
        d="M374.473 57.7173C367.666 50.7995 357.119 49.1209 348.441 53.1659C347.173 53.7567 342.223 56.0864 334.796 59.8613C326.32 64.1696 314.568 70.3869 301.394 78.0596C275.444 93.1728 242.399 114.83 218.408 139.477C185.983 172.786 158.719 225.503 140.029 267.661C130.506 289.144 122.878 308.661 117.629 322.81C116.301 326.389 115.124 329.63 114.104 332.478C87.1783 336.42 64.534 341.641 47.5078 348.101C37.6493 351.84 28.3222 356.491 21.0573 362.538C13.8818 368.511 6.00003 378.262 6.00003 391.822C6.00014 403.222 11.8738 411.777 17.4566 417.235C23.0009 422.655 29.9593 426.793 36.871 430.062C50.8097 436.653 69.5275 441.988 90.8362 446.249C133.828 454.846 192.21 460 256.001 460C319.79 460 378.172 454.846 421.164 446.249C442.472 441.988 461.19 436.653 475.129 430.062C482.041 426.793 488.999 422.655 494.543 417.235C500.039 411.862 505.817 403.489 505.996 392.353L506 391.822L505.995 391.188C505.754 377.959 498.012 368.417 490.945 362.534C483.679 356.485 474.35 351.835 464.491 348.095C446.749 341.366 422.906 335.982 394.476 331.987C393.6 330.57 392.633 328.995 391.595 327.273C386.477 318.777 379.633 306.842 372.737 293.115C358.503 264.781 345.757 232.098 344.756 206.636C343.87 184.121 351.638 154.087 360.819 127.789C365.27 115.041 369.795 103.877 373.207 95.9072C374.909 91.9309 376.325 88.7712 377.302 86.6328C377.79 85.5645 378.167 84.7524 378.416 84.2224C378.54 83.9579 378.632 83.7635 378.69 83.643C378.718 83.5829 378.739 83.5411 378.75 83.5181C378.753 83.5108 378.756 83.5049 378.757 83.5015C382.909 74.8634 381.196 64.5488 374.473 57.7173Z"
      />
    </Svg>
  )
})

type Props = {
  isReady: boolean
}

export function Splash(props: React.PropsWithChildren<Props>) {
  'use no memo'
  const insets = useSafeAreaInsets()
  const intro = useSharedValue(0)
  const outroLogo = useSharedValue(0)
  const outroApp = useSharedValue(0)
  const outroSplashOpacity = useSharedValue(0)
  const [isAnimationComplete, setIsAnimationComplete] = useState(false)
  const [isLayoutReady, setIsLayoutReady] = useState(false)
  const [reduceMotion, setReduceMotion] = useState<boolean | undefined>(false)
  const isReady = props.isReady && isLayoutReady && reduceMotion !== undefined

  const t = useTheme()

  const logoAnimation = useAnimatedStyle(() => {
    const introScale = interpolate(intro.get(), [0, 1], [0.8, 1], 'clamp')
    const outroScale =
      reduceMotion === true
        ? 1
        : interpolate(outroLogo.get(), [0, 0.08, 1], [1, 0.8, 500], 'clamp')

    const introOpacity = interpolate(intro.get(), [0, 1], [0, 1], 'clamp')
    const outroOpacity = interpolate(
      outroSplashOpacity.get(),
      [0, 0.1, 0.2, 1],
      [1, 1, 0, 0],
      'clamp',
    )

    return {
      opacity: introOpacity * outroOpacity,
      transform: [
        {translateY: -(insets.top / 2)},
        {scale: 0.1 * outroScale * introScale},
      ],
    }
  })
  const bottomLogoAnimation = useAnimatedStyle(() => {
    return {
      opacity: interpolate(intro.get(), [0, 1], [0, 1], 'clamp'),
    }
  })

  const splashAnimation = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        outroSplashOpacity.get(),
        [0, 0.1, 0.2, 1],
        [1, 1, 0, 0],
        'clamp',
      ),
    }
  })

  /**
   * Keep the app opaque so iOS blur/glass effects can initialize while the
   * splash hides it.
   */
  const appAnimation = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(outroApp.get(), [0, 1], [1.1, 1], 'clamp'),
        },
      ],
    }
  })

  const onFinish = useCallback(() => setIsAnimationComplete(true), [])
  const onLayout = useCallback(() => setIsLayoutReady(true), [])

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync()
        .then(() => {
          intro.set(
            withTiming(
              1,
              {duration: 400, easing: Easing.out(Easing.cubic)},
              () => {
                'worklet'
                // set these values to check animation at specific point
                outroLogo.set(
                  withTiming(
                    1,
                    {duration: 1200, easing: Easing.in(Easing.cubic)},
                    () => {
                      scheduleOnRN(onFinish)
                    },
                  ),
                )
                outroApp.set(
                  withTiming(1, {
                    duration: 1200,
                    easing: Easing.inOut(Easing.cubic),
                  }),
                )
                outroSplashOpacity.set(
                  withTiming(1, {
                    duration: 1200,
                    easing: Easing.in(Easing.cubic),
                  }),
                )
              },
            ),
          )
        })
        .catch(() => {})
    }
  }, [onFinish, intro, outroLogo, outroApp, outroSplashOpacity, isReady])

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  const logoBg = t.atoms.bg.backgroundColor

  return (
    <View style={{flex: 1}} onLayout={onLayout}>
      {isReady && (
        <Animated.View style={[{flex: 1}, appAnimation]}>
          {props.children}
        </Animated.View>
      )}

      {!isAnimationComplete && (
        <Animated.View
          style={[
            a.absolute,
            a.inset_0,
            a.align_center,
            a.justify_center,
            {backgroundColor: logoBg},
            splashAnimation,
          ]}>
          <Logo
            fill={t.palette.primary_500}
            style={{width: 125, height: 125}}
          />

          <Animated.View
            style={[
              bottomLogoAnimation,
              {
                position: 'absolute',
                bottom: insets.bottom + 40,
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
              },
            ]}>
            <Logotype fill={t.palette.contrast_1000} width={90} />
          </Animated.View>
        </Animated.View>
      )}

      {isReady && !isAnimationComplete && (
        <Animated.View
          style={[
            a.absolute,
            a.inset_0,
            logoAnimation,
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}>
          <Logo fill={logoBg} />
        </Animated.View>
      )}
    </View>
  )
}
