import {useState} from 'react'
import {View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {useSafeAreaFrame} from 'react-native-safe-area-context'
import {BlurView} from 'expo-blur'
import {Image, type ImageContentPosition} from 'expo-image'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {Logo} from '#/view/icons/Logo'
import {Logotype} from '#/view/icons/Logotype'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
// @ts-expect-error
import catArt from '../../../../assets/illustrations/signin-cat.jpg'

const ART = {
  phone: {light: catArt, dark: catArt},
  safe: {light: catArt, dark: catArt},
}

/**
 * Keep separate aspect-ratio and theme slots for future illustrated artwork.
 */
const MAX_PHONE_ART_ASPECT_RATIO = 0.57

/**
 * Center the photo when wider layouts crop the top and bottom.
 */
const SAFE_ART_POSITION: ImageContentPosition = {top: '50%', left: '50%'}

export function NativeSplashScreen({
  onPressSignin,
  onPressCreateAccount,
}: {
  onPressSignin: () => void
  onPressCreateAccount: () => void
}) {
  const t = useTheme()
  const {gtPhone} = useBreakpoints()
  const {_} = useLingui()
  const isDarkMode = t.name !== 'light'

  const haptics = useHaptics()

  /*
   * The root frame is right on the first render, so phones never flash the
   * safe art. After that, follow the measured size: on web the frame doesn't
   * update when the window is resized.
   */
  const frame = useSafeAreaFrame()
  const [size, setSize] = useState<{width: number; height: number}>()
  const {width, height} = size ?? frame
  const isPhoneShaped = width / height <= MAX_PHONE_ART_ASPECT_RATIO

  const styles = {
    logoFill: 'white',
    logoShadow: [
      {
        shadowColor: 'black',
        shadowRadius: 8,
        shadowOpacity: 0.5,
        shadowOffset: {
          width: 0,
          height: 0,
        },
      },
    ],
  }

  return (
    <>
      <View
        style={[a.absolute, a.inset_0]}
        onLayout={evt => {
          const layout = evt.nativeEvent.layout
          if (layout.width > 0 && layout.height > 0) {
            setSize({width: layout.width, height: layout.height})
          }
        }}>
        <Image
          accessibilityIgnoresInvertColors
          source={
            ART[isPhoneShaped ? 'phone' : 'safe'][isDarkMode ? 'dark' : 'light']
          }
          contentFit="cover"
          contentPosition={isPhoneShaped ? 'center' : SAFE_ART_POSITION}
          style={[a.absolute, a.inset_0]}
        />
      </View>

      <Animated.View
        entering={FadeIn.duration(90)}
        exiting={FadeOut.duration(90)}
        style={[a.flex_1]}>
        <View
          style={[a.justify_center, a.align_center, {gap: 6, paddingTop: 46}]}>
          <Logo width={76} fill={styles.logoFill} style={styles.logoShadow} />
          <Logotype
            width={91}
            fill={styles.logoFill}
            style={styles.logoShadow}
          />
        </View>

        <View style={[a.flex_1]} />

        <View
          testID="signinOrCreateAccount"
          style={[
            a.px_5xl,
            a.gap_md,
            isPhoneShaped ? a.pb_sm : a.pb_xl,
            gtPhone && [a.w_full, a.self_center, {maxWidth: 600}],
          ]}>
          <Button
            testID="createAccountButton"
            onPress={() => {
              onPressCreateAccount()
              haptics.tap()
            }}
            label={_(msg`Create new account`)}
            accessibilityHint={_(
              msg`Opens flow to create a new Bluesky account`,
            )}
            size="large"
            color={isDarkMode ? 'secondary_inverted' : 'secondary'}
            style={[
              {
                shadowColor: t.palette.black,
                shadowRadius: 8,
                shadowOpacity: 0.1,
                shadowOffset: {
                  width: 0,
                  height: 5,
                },
                elevation: 16,
              },
            ]}>
            <ButtonText>
              <Trans>Create account</Trans>
            </ButtonText>
          </Button>

          <Button
            testID="signInButton"
            onPress={() => {
              onPressSignin()
              haptics.tap()
            }}
            label={_(msg`Sign in`)}
            accessibilityHint={_(
              msg`Opens flow to sign in to your existing Bluesky account`,
            )}
            size="large"
            style={[a.overflow_hidden, {backgroundColor: 'rgba(0, 0, 0, 0.5)'}]}
            hoverStyle={{opacity: 0.5}}>
            <BlurView
              intensity={20}
              tint="dark"
              style={[a.absolute, a.inset_0]}
            />
            <ButtonText style={{color: 'white'}}>
              <Trans>Sign in</Trans>
            </ButtonText>
          </Button>
        </View>
      </Animated.View>
    </>
  )
}
