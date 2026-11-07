import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {BluemojiPickerList} from '#/features/bluemoji/Picker'
import {useConstellationReactionsQuery} from '#/features/bluemoji/reactions/constellation'
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '#/features/bluemoji/reactions/mutations'
import {
  isPersistedReaction,
  usePostReactionsQuery,
  useReactionCountsQuery,
  useViewerReactionForPost,
} from '#/features/bluemoji/reactions/queries'
import {ReactionEmoji} from '#/features/bluemoji/reactions/ReactionEmoji'
import {
  getReactionEmojiModeration,
  reactionEmojiToItem,
  type ReactionGroup,
} from '#/features/bluemoji/reactions/util'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {type app} from '#/lexicons'

/**
 * Existing reactions, who reacted, and a grid to add your own. Shared by the
 * under-post strip and the post control row so both open the same thing.
 */
export function ReactionDialog({post}: {post: app.bsky.feed.defs.PostView}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const dialogControl = Dialog.useDialogControl()
  const requireAuth = useRequireAuth()

  const {data: counts, isLoading: countsLoading} = useReactionCountsQuery(
    post.uri,
  )
  const {data: fallback} = useConstellationReactionsQuery(
    post.uri,
    Boolean(counts) && !counts?.length,
  )
  const groups: ReactionGroup[] = counts?.length ? counts : (fallback ?? [])
  const visibleGroups = groups.filter(
    group => getReactionEmojiModeration(group.emoji, moderationOpts) !== 'hide',
  )
  const viewerReactions = useViewerReactionForPost(post.uri)
  const {mutate: create} = useCreateReactionMutation()
  const {mutate: remove} = useDeleteReactionMutation()

  const total = visibleGroups.reduce((sum, group) => sum + group.count, 0)

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
        if (item) create({target: {uri: post.uri, cid: post.cid}, item})
      }
    })
  }

  const addFromPicker = (item: BluemojiItem) => {
    requireAuth(() => create({target: {uri: post.uri, cid: post.cid}, item}))
  }

  return (
    <Dialog.ScrollableInner label={l`Reactions`} style={[web({maxWidth: 460})]}>
      <View style={[a.gap_lg, a.pb_lg]}>
        <View style={[a.gap_2xs]}>
          <Text style={[a.text_xl, a.font_bold]}>
            <Trans>Reactions</Trans>
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {plural(total, {
              one: '# reaction',
              other: '# reactions',
            })}
          </Text>
        </View>

        {countsLoading ? (
          <Skeleton.Row>
            <Skeleton.Block style={[{width: 96, height: 32}]} />
            <Skeleton.Block style={[{width: 96, height: 32}]} />
          </Skeleton.Row>
        ) : visibleGroups.length ? (
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            {visibleGroups.map(group => {
              const own = viewerReactions?.some(
                reaction => reaction.emoji.uri === group.emoji.uri,
              )
              return (
                <Button
                  key={group.emoji.uri}
                  label={
                    own
                      ? l`Remove ${group.emoji.name}`
                      : l`React with ${group.emoji.name}`
                  }
                  onPress={() => toggle(group)}
                  style={[
                    a.flex_row,
                    a.align_center,
                    a.gap_xs,
                    a.px_md,
                    a.py_sm,
                    a.rounded_full,
                    own
                      ? [
                          t.atoms.bg_contrast_25,
                          {borderWidth: 1, borderColor: t.palette.primary_500},
                        ]
                      : [t.atoms.bg_contrast_25],
                  ]}>
                  <ReactionEmoji emoji={group.emoji} size={20} accessible />
                  <Text style={[a.text_md, a.font_bold]}>{group.count}</Text>
                </Button>
              )
            })}
          </View>
        ) : (
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>No reactions yet. Pick one below.</Trans>
          </Text>
        )}

        <View
          style={[a.border_t, a.pt_md, t.atoms.border_contrast_low, a.gap_sm]}>
          <Text style={[a.text_md, a.font_bold]}>
            <Trans>Add your own</Trans>
          </Text>
          <BluemojiPickerList onSelect={addFromPicker} />
        </View>

        <ActorsList post={post} onClose={() => dialogControl.close()} />
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function ActorsList({
  post,
  onClose,
}: {
  post: app.bsky.feed.defs.PostView
  onClose: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const query = usePostReactionsQuery(post.uri)
  const reactions = query.data?.pages.flatMap(page => page.reactions) ?? []
  if (!reactions.length) return null

  return (
    <View style={[a.border_t, a.pt_md, t.atoms.border_contrast_low, a.gap_sm]}>
      <Text style={[a.text_md, a.font_bold]}>
        <Trans>Who reacted</Trans>
      </Text>
      {reactions.map(reaction => (
        <View key={reaction.uri} style={[a.flex_row, a.align_center, a.gap_sm]}>
          <ReactionEmoji emoji={reaction.emoji} size={20} accessible />
          <Text numberOfLines={1} style={[a.flex_1, a.text_sm]}>
            {reaction.actor.displayName?.trim() || `@${reaction.actor.handle}`}
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            @{reaction.actor.handle}
          </Text>
        </View>
      ))}
      {query.hasNextPage ? (
        <Button
          size="small"
          color="secondary"
          label={l`Load more reactions`}
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}>
          <ButtonText>
            <Trans>Load more</Trans>
          </ButtonText>
        </Button>
      ) : null}
      <Button size="small" color="secondary" label={l`Close`} onPress={onClose}>
        <ButtonText>
          <Trans>Close</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
