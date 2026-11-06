import {View} from 'react-native'
import {Image} from 'expo-image'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme, type ViewStyleProp} from '#/alf'
import {Text} from '#/components/Typography'
import {
  getReactionEmojiAlt,
  getReactionEmojiImage,
  getReactionEmojiModeration,
  type ReactionEmoji as ReactionEmojiRef,
} from '#/features/bluemoji/reactions/util'

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
  const uri = getReactionEmojiImage(emoji)
  const visible =
    uri && getReactionEmojiModeration(emoji, moderationOpts) !== 'hide'

  if (!visible) {
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
      <Image
        source={{uri}}
        contentFit="contain"
        style={{width: size, height: size}}
        accessibilityIgnoresInvertColors
      />
    </View>
  )
}
