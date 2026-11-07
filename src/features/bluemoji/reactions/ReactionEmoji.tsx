import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'

import {useBluemojiInstance} from '#/state/preferences/bluemoji-instance'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {usePdsServiceUrl} from '#/state/session'
import {atoms as a, useTheme, type ViewStyleProp} from '#/alf'
import {Text} from '#/components/Typography'
import {useBluemojiItemQuery} from '#/features/bluemoji/queries'
import {
  getReactionEmojiAlt,
  getReactionEmojiDid,
  getReactionEmojiImage,
  getReactionEmojiModeration,
  type ReactionEmoji as ReactionEmojiRef,
} from '#/features/bluemoji/reactions/util'
import {
  getBluemojiImage,
  getBluemojiModeration,
  getBluemojiPdsImage,
} from '#/features/bluemoji/util'

/**
 * One reaction glyph. Renders the alias instead of the image when the viewer's
 * label preferences hide the source item - a 16px image has no room for a
 * blur affordance, and the alias is what the post itself falls back to.
 */
export function ReactionEmoji({
  emoji,
  size = 16,
  style,
  accessible = false,
}: {
  emoji: ReactionEmojiRef
  size?: number
  style?: ViewStyleProp['style']
  accessible?: boolean
}) {
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const [failed, setFailed] = useState(false)
  const [fallbackUri, setFallbackUri] = useState<string>()
  const pdsUrl = usePdsServiceUrl()
  const instance = useBluemojiInstance()
  /*
   * Other clients write reactions whose `formats` is empty, so fall back to
   * the item record on its owner's PDS. Cached per item across every pill.
   */
  const {data: item, isPending: itemPending} = useBluemojiItemQuery({
    did: getReactionEmojiDid(emoji) ?? '',
    name: emoji.name,
    record: {uri: emoji.uri, cid: emoji.cid},
  })
  const uri =
    getReactionEmojiImage(emoji, instance) ??
    (item ? getBluemojiImage(item, instance) : undefined)
  const visible =
    uri &&
    (item
      ? getBluemojiModeration(item, moderationOpts)
      : getReactionEmojiModeration(emoji, moderationOpts)) !== 'hide'

  /*
   * Resolving the item (and then the image) takes a beat. Rendering the alias
   * in that gap is what makes every pill flash text before the picture lands,
   * so hold an empty box of the right size instead.
   */
  const resolving =
    itemPending && getReactionEmojiImage(emoji, instance) === undefined
  if (!visible && !resolving) {
    return (
      <Text
        accessible={accessible}
        accessibilityLabel={emoji.name}
        accessibilityHint={undefined}
        style={[a.text_sm, t.atoms.text_contrast_medium, style]}>
        {emoji.name}
      </Text>
    )
  }

  return (
    <View
      accessible={accessible}
      accessibilityLabel={getReactionEmojiAlt(emoji)}
      accessibilityHint={undefined}
      accessibilityRole={accessible ? 'image' : undefined}
      style={style}>
      <View style={{width: size, height: size}}>
        {visible && !failed ? (
          <Image
            // moji.blue's CDN 404s until the blob is indexed; the PDS has it.
            source={{uri: fallbackUri ?? uri}}
            contentFit="contain"
            style={{width: size, height: size}}
            cachePolicy="memory-disk"
            // No fade: reaction emoji are tiny and appear constantly, so a
            // transition reads as a flicker rather than an entrance.
            transition={0}
            accessibilityIgnoresInvertColors
            onError={() => {
              if (fallbackUri || !item || !pdsUrl) {
                setFailed(true)
                return
              }
              const next = getBluemojiPdsImage(item, pdsUrl)
              if (next) setFallbackUri(next)
              else setFailed(true)
            }}
          />
        ) : null}
      </View>
    </View>
  )
}
