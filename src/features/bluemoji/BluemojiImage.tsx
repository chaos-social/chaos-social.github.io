import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'

import {useBluemojiInstance} from '#/state/preferences/bluemoji-instance'
import {usePdsServiceUrl} from '#/state/session'
import {
  type BluemojiItem,
  getBluemojiImage,
  getBluemojiPdsImage,
} from '#/features/bluemoji/util'

/**
 * An emoji rendition, falling back to the owning PDS if moji.blue's CDN does
 * not have the blob.
 *
 * The CDN only serves blobs its index has seen, so an emoji uploaded moments
 * ago 404s there until the firehose catches up. The PDS serves it immediately,
 * and is where the CDN itself reads from.
 */
export function BluemojiImage({
  item,
  size,
  label,
}: {
  item: BluemojiItem
  size: number
  /** The emoji's alias; the image is otherwise decorative to a screen reader. */
  label?: string
}) {
  const [fallbackUri, setFallbackUri] = useState<string>()
  const pdsUrl = usePdsServiceUrl()
  const instance = useBluemojiInstance()
  const cdnUri = getBluemojiImage(item, instance)
  const uri = fallbackUri ?? cdnUri

  return (
    <View style={{width: size, height: size}}>
      {uri ? (
        <Image
          source={{uri}}
          contentFit="contain"
          cachePolicy="memory-disk"
          style={{width: size, height: size}}
          accessibilityLabel={label}
          accessibilityHint={undefined}
          accessibilityIgnoresInvertColors
          onError={() => {
            // One retry, against the PDS; a failure there is a real failure.
            if (fallbackUri || cdnUri !== uri || !pdsUrl) return
            const next = getBluemojiPdsImage(item, pdsUrl)
            if (next) setFallbackUri(next)
          }}
        />
      ) : null}
    </View>
  )
}
