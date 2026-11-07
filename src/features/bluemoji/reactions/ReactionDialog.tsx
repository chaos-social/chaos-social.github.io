import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import * as Menu from '#/components/Menu'
import {Text} from '#/components/Typography'
import {EmojiGrid} from '#/features/bluemoji/Picker'
import {useConstellationReactionsQuery} from '#/features/bluemoji/reactions/constellation'
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '#/features/bluemoji/reactions/mutations'
import {
  isPersistedReaction,
  mergeViewerReactions,
  useReactionCountsQuery,
  useViewerReactionForPost,
} from '#/features/bluemoji/reactions/queries'
import {
  getReactionEmojiModeration,
  type ReactionGroup,
  toReactionEmoji,
} from '#/features/bluemoji/reactions/util'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {type app} from '#/lexicons'

/**
 * Discord-style picker: just the emoji grid. Existing reactions are already in
 * the action row, so repeating them here would be noise.
 *
 * Renders as `Menu.Outer` content, so it anchors to the plus button on web and
 * presents as a popover sheet on iOS.
 */
export function ReactionDialog({
  post,
  onReact,
}: {
  post: app.bsky.feed.defs.PostView
  /** Reports a newly added emoji so the action row can celebrate it. */
  onReact?: (emoji: ReactionGroup['emoji']) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const {control} = Menu.useMenuContext()
  const navigation = useNavigation<NavigationProp>()
  const requireAuth = useRequireAuth()

  const {data: counts} = useReactionCountsQuery(post.uri)
  const {data: fallback} = useConstellationReactionsQuery(
    post.uri,
    Boolean(counts) && !counts?.length,
  )
  const {reactions: viewerReactions, known: ownKnown} =
    useViewerReactionForPost(post.uri)
  const groups: ReactionGroup[] = mergeViewerReactions(
    counts?.length ? counts : (fallback ?? []),
    viewerReactions,
    ownKnown,
  )
  const visibleGroups = groups.filter(
    group => getReactionEmojiModeration(group.emoji, moderationOpts) !== 'hide',
  )
  const {mutate: create} = useCreateReactionMutation()
  const {mutate: remove} = useDeleteReactionMutation()

  const react = (item: BluemojiItem) => {
    // Tapping an emoji you already used removes it: the un-react gesture.
    const own = viewerReactions?.find(
      reaction => reaction.emoji.uri === item.uri,
    )
    requireAuth(() => {
      if (own && isPersistedReaction(own)) {
        remove({
          reactionUri: own.uri,
          target: {uri: post.uri, cid: post.cid},
          emoji: own.emoji,
        })
        return
      }
      if (own) return
      create({target: {uri: post.uri, cid: post.cid}, item})
      /*
       * Close before celebrating: the picker is a popover anchored over the
       * action row, so a burst underneath it would be hidden.
       */
      control.close(() => onReact?.(toReactionEmoji(item)))
    })
  }

  const total = visibleGroups.reduce((sum, group) => sum + group.count, 0)
  const chosen = viewerReactions?.map(r => r.emoji.uri) ?? []

  return (
    <Menu.Outer label={l`Reactions`} style={[web({width: 320}), a.p_md]}>
      <View style={[a.gap_sm, a.pb_xs]}>
        <View style={[a.flex_row, a.align_baseline, a.justify_between]}>
          <Text style={[a.text_md, a.font_bold]}>
            <Trans>React</Trans>
          </Text>
          {total > 0 ? (
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {plural(total, {one: '# reaction', other: '# reactions'})}
            </Text>
          ) : null}
        </View>
        <EmojiGrid
          onSelect={react}
          chosen={chosen}
          onNewCollection={() =>
            control.close(() => navigation.navigate('CustomEmojiSettings'))
          }
        />
      </View>
    </Menu.Outer>
  )
}
