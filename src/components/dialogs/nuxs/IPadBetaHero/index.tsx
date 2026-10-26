import {View} from 'react-native'
import {useReducedMotion} from 'react-native-reanimated'
import {Asset} from 'expo-asset'
import {Image} from 'expo-image'
import {BlueskyVideoView} from '@bsky.app/video'
import {useLingui} from '@lingui/react/macro'

import {getShapeRadius} from '#/lib/shapes'
import {useAutoplayDisabled} from '#/state/preferences'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a} from '#/alf'

const VIDEO = Asset.fromModule(
  require('../../../../../assets/images/ipad_beta_nux.mp4'),
).uri
/** First frame of the video, shown while it loads or instead of it */
const POSTER = require('../../../../../assets/images/ipad_beta_nux_poster.webp')

/**
 * Looping video of an iPad floating above the clouds. Falls back to the
 * first frame when autoplay is off or reduced motion is on.
 */
export function IPadBetaHero() {
  const {t: l} = useLingui()
  const autoplayDisabled = useAutoplayDisabled()
  const shape = useEnableSquareButtons()
  const reducedMotion = useReducedMotion()

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={l`An iPad Pro floating above the clouds, showing an illustration of people enjoying a sunny park in a futuristic city.`}
      accessibilityHint=""
      style={[
        a.w_full,
        a.overflow_hidden,
        {
          aspectRatio: 393 / 226,
          borderTopLeftRadius: getShapeRadius(
            shape,
            a.rounded_md.borderRadius,
            a.rounded_md.borderRadius,
          ),
          borderTopRightRadius: getShapeRadius(
            shape,
            a.rounded_md.borderRadius,
            a.rounded_md.borderRadius,
          ),
        },
      ]}>
      <Image
        accessibilityIgnoresInvertColors
        source={POSTER}
        style={[a.absolute, a.inset_0]}
        useAppleWebpCodec
      />
      {!autoplayDisabled && !reducedMotion && (
        <BlueskyVideoView
          url={VIDEO}
          autoplay
          beginMuted
          forceTakeover
          style={[a.absolute, a.inset_0]}
        />
      )}
    </View>
  )
}
