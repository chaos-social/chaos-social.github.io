import {useState} from 'react'
import {Pressable, type StyleProp, View, type ViewStyle} from 'react-native'
import {type AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useShowPostTags} from '#/state/preferences/show-post-tags'
import {atoms as a, tokens, useTheme} from '#/alf'
import {RichTextTag} from '#/components/RichTextTag'

/**
 * Renders outline tags from `app.bsky.feed.post` `tags` (separate from
 * in-text hashtag facets).
 */
export function PostTags({
  post,
  style,
}: {
  post: AppBskyFeedDefs.PostView
  style?: StyleProp<ViewStyle>
}) {
  const showPostTags = useShowPostTags()
  const tags = getOutlineTags(post)

  if (!showPostTags || !tags.length) {
    return null
  }

  return (
    <View
      style={[
        a.flex_row,
        a.flex_wrap,
        a.pt_xs,
        {gap: tokens.space._2xs},
        style,
      ]}>
      {tags.map(tag => (
        <PostTag key={tag} tag={tag} authorHandle={post.author.handle} />
      ))}
    </View>
  )
}

function PostTag({tag, authorHandle}: {tag: string; authorHandle: string}) {
  const t = useTheme()
  const square = useEnableSquareButtons()
  const [hovered, setHovered] = useState(false)
  return (
    <Pressable
      role="presentation"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({pressed}) => [
        getShapeStyle(square, a.rounded_xs, a.rounded_full),
        hovered || pressed ? t.atoms.bg_contrast_50 : t.atoms.bg_contrast_25,
        {paddingHorizontal: 6, paddingVertical: 3},
      ]}>
      <RichTextTag
        tag={tag}
        display={`#${tag}`}
        authorHandle={authorHandle}
        textStyle={[
          a.text_sm,
          a.font_normal,
          a.leading_tight,
          t.atoms.text_contrast_high,
        ]}
        disableUnderline
      />
    </Pressable>
  )
}

function getOutlineTags(post: AppBskyFeedDefs.PostView): string[] {
  if (!AppBskyFeedPost.isRecord(post.record)) {
    return []
  }
  const tags = post.record.tags
  return Array.isArray(tags)
    ? tags.filter(
        (tag): tag is string =>
          typeof tag === 'string' && tag !== 'anisota',
      )
    : []
}
