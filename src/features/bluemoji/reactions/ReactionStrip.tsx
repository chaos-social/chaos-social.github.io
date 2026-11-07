import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {useHideBluemojiReactions} from '#/state/preferences/hide-bluemoji-reactions'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'
import {useConstellationReactionsQuery} from '#/features/bluemoji/reactions/constellation'
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '#/features/bluemoji/reactions/mutations'
import {
  isPersistedReaction,
  useReactionCountsQuery,
  useViewerReactionForPost,
} from '#/features/bluemoji/reactions/queries'
import {ReactionDialog} from '#/features/bluemoji/reactions/ReactionDialog'
import {ReactionEmoji} from '#/features/bluemoji/reactions/ReactionEmoji'
import {
  getReactionEmojiModeration,
  reactionEmojiToItem,
  type ReactionGroup,
} from '#/features/bluemoji/reactions/util'
import {type app} from '#/lexicons'

const MAX_PILLS = 6

/**
 * Compact reaction row under a post. Renders nothing without reactions, except
 * on the focused post, where the trailing "add" pill is the entry point.
 */
export function ReactionStrip({
  post,
  showAdd = false,
}: {
  post: app.bsky.feed.defs.PostView
  /** Focused posts offer an "add" pill even when nothing has been reacted yet. */
  showAdd?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const dialogControl = Dialog.useDialogControl()
  const requireAuth = useRequireAuth()
  const hidden = useHideBluemojiReactions()
  const moderationOpts = useModerationOpts()
  const {data: appviewGroups} = useReactionCountsQuery(post.uri)
  const viewerReactions = useViewerReactionForPost(post.uri)
  // Only pay for the constellation walk when the AppView has nothing to say.
  const {data: fallbackGroups} = useConstellationReactionsQuery(
    post.uri,
    Boolean(appviewGroups) && !appviewGroups?.length,
  )
  const groups = appviewGroups?.length ? appviewGroups : (fallbackGroups ?? [])
  const visible = groups.filter(
    group => getReactionEmojiModeration(group.emoji, moderationOpts) !== 'hide',
  )
  const {mutate: create} = useCreateReactionMutation()
  const {mutate: remove} = useDeleteReactionMutation()
  const open = () => requireAuth(() => dialogControl.open())

  if (hidden) return null
  if (!visible.length && !showAdd) return null

  const toggle = (group: ReactionGroup) => {
    const own = viewerReactions?.find(
      reaction => reaction.emoji.uri === group.emoji.uri,
    )
    requireAuth(() => {
      if (own && isPersistedReaction(own)) {
        remove({
          reactionUri: own.uri,
          target: {uri: post.uri, cid: post.cid},
          emoji: group.emoji,
        })
      } else {
        const item = reactionEmojiToItem(group.emoji)
        if (!item) {
          open()
          return
        }
        create({target: {uri: post.uri, cid: post.cid}, item})
      }
    })
  }

  return (
    <>
      <View
        style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_xs, a.pt_xs]}>
        {visible.slice(0, MAX_PILLS).map(group => {
          const own = viewerReactions?.some(
            reaction => reaction.emoji.uri === group.emoji.uri,
          )
          return (
            <Button
              key={group.emoji.uri}
              testID="reactionPill"
              label={l`${group.emoji.name}, ${plural(group.count, {
                one: '# reaction',
                other: '# reactions',
              })}`}
              onPress={() => toggle(group)}
              style={[
                a.flex_row,
                a.align_center,
                a.gap_2xs,
                a.px_sm,
                a.py_2xs,
                a.rounded_full,
                t.atoms.bg_contrast_25,
                /*
                 * Outline, not a fill: the strip sits directly under post text,
                 * and a stronger background would read as selected text.
                 */
                own ? [a.border, t.atoms.border_contrast_high] : null,
              ]}>
              <ReactionEmoji emoji={group.emoji} size={16} />
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {group.count}
              </Text>
            </Button>
          )
        })}
        {visible.length > MAX_PILLS ? (
          <Button
            label={l`Show ${visible.length - MAX_PILLS} more reactions`}
            onPress={open}
            style={[a.px_sm, a.py_2xs, a.rounded_full, t.atoms.bg_contrast_25]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              +{visible.length - MAX_PILLS}
            </Text>
          </Button>
        ) : null}
        {showAdd ? (
          <Button
            testID="reactionsAddBtn"
            label={l`Add a reaction`}
            onPress={open}
            style={[a.px_sm, a.py_2xs, a.rounded_full, t.atoms.bg_contrast_25]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {visible.length ? '+' : l`React`}
            </Text>
          </Button>
        ) : null}
      </View>
      <Dialog.Outer control={dialogControl}>
        <Dialog.Handle />
        <ReactionDialog post={post} />
      </Dialog.Outer>
    </>
  )
}
