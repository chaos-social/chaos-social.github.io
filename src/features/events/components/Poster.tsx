import {type ImageStyle, type StyleProp} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {LinearGradientBackground} from '#/components/LinearGradientBackground'
import {Text} from '#/components/Typography'
import {eventPoster} from '../poster'
import {coverUrl, type ParsedEvent} from '../record'
import {type EventView} from '../types'

/**
 * An event's cover as a square tile. Falls back to a deterministic gradient
 * and a keyword emoji when the event has no cover, or its cover is labelled.
 */
export function Poster({
  event,
  parsed,
  size,
  style,
}: {
  event: EventView
  parsed: ParsedEvent
  size: number
  style?: StyleProp<ImageStyle>
}) {
  const {t: l} = useLingui()
  const cover = coverUrl(event)
  if (cover) {
    return (
      <Image
        source={{uri: cover}}
        alt={l`Cover image for ${parsed.name}`}
        accessibilityIgnoresInvertColors
        style={[a.rounded_lg, {width: size, height: size}, style]}
        contentFit="cover"
      />
    )
  }
  const {gradient, emoji} = eventPoster(event.uri, parsed)
  return (
    <LinearGradientBackground
      gradient={gradient}
      style={[
        a.rounded_lg,
        a.align_center,
        a.justify_center,
        {width: size, height: size},
        style,
      ]}>
      <Text aria-hidden style={{fontSize: size / 3}}>
        {emoji}
      </Text>
    </LinearGradientBackground>
  )
}
