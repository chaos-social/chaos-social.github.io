import {useState} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {useHideBluemojiReactions} from '#/state/preferences/hide-bluemoji-reactions'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useRequireAuth} from '#/state/session'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {EmojiSmile_Stroke2_Corner0_Rounded as SmileIcon} from '#/components/icons/Emoji'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Menu from '#/components/Menu'
import {
  PostControlButton,
  PostControlButtonIcon,
} from '#/components/PostControls/PostControlButton'
import {Text} from '#/components/Typography'
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
import {ReactionBurst} from '#/features/bluemoji/reactions/ReactionBurst'
import {ReactionDialog} from '#/features/bluemoji/reactions/ReactionDialog'
import {ReactionEmoji} from '#/features/bluemoji/reactions/ReactionEmoji'
import {
  getReactionEmojiModeration,
  reactionEmojiToItem,
  type ReactionGroup,
} from '#/features/bluemoji/reactions/util'
import {accentForeground} from '#/features/themes/accentForeground'
import {type app} from '#/lexicons'

const MAX_PILLS = 3
const PILL_HEIGHT = 24

/**
 * The reaction control, sized to sit inside the post action row to the right of
 * likes: the top few emoji with their counts, then a plus that opens the
 * picker. Each pill toggles that emoji.
 *
 * The picker hangs off a `Menu` so it anchors to the plus the way the post
 * options menu anchors to the three dots (Radix popover on web, a popover
 * sheet on iOS, a bottom sheet on Android).
 */
export function ReactionBar({
  post,
  big,
  hitSlop,
}: {
  post: app.bsky.feed.defs.PostView
  big?: boolean
  hitSlop?: {left?: number; right?: number; top?: number; bottom?: number}
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {gtPhone} = useBreakpoints()
  const hidden = useHideBluemojiReactions()
  const moderationOpts = useModerationOpts()
  const requireAuth = useRequireAuth()

  const {data: appviewGroups} = useReactionCountsQuery(post.uri)
  const {data: fallbackGroups} = useConstellationReactionsQuery(
    post.uri,
    Boolean(appviewGroups) && !appviewGroups?.length,
  )
  const {reactions: viewerReactions, known: ownKnown} =
    useViewerReactionForPost(post.uri)
  /*
   * Our own reactions come from our PDS and are always ahead of the AppView,
   * so they are merged in rather than left to the firehose. `ownKnown` also
   * lets a removal subtract the viewer's share of a count the AppView has not
   * caught up with yet.
   */
  const groups = mergeViewerReactions(
    appviewGroups?.length ? appviewGroups : (fallbackGroups ?? []),
    viewerReactions,
    ownKnown,
  )
  const allowed = groups.filter(
    group => getReactionEmojiModeration(group.emoji, moderationOpts) !== 'hide',
  )
  /*
   * The viewer's own reactions sort first. Without this a brand-new one (count
   * one, behind older groups) is sliced off the row entirely, so the pill they
   * just added would not appear and its burst had nowhere to render.
   */
  const isOwn = (group: ReactionGroup) =>
    Boolean(viewerReactions?.some(r => r.emoji.uri === group.emoji.uri))
  const visible = [
    ...allowed.filter(isOwn),
    ...allowed.filter(group => !isOwn(group)),
    // Phones share this row with three `flex_1` slots, so fewer pills.
  ].slice(0, gtPhone ? MAX_PILLS : 1)
  const {mutate: create} = useCreateReactionMutation()
  const {mutate: remove} = useDeleteReactionMutation()
  // Which pill, if any, is currently celebrating. One at a time is plenty.
  const [burst, setBurst] = useState<ReactionGroup | undefined>(undefined)

  if (hidden) return null

  const react = (emoji: ReactionGroup['emoji']) => {
    const item = reactionEmojiToItem(emoji)
    if (!item) return
    create({target: {uri: post.uri, cid: post.cid}, item})
    setBurst({emoji, count: 1})
  }

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
        return
      }
      if (own) return
      react(group.emoji)
    })
  }

  return (
    <Menu.Root>
      <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
        {visible.map(group => {
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
                a.px_xs,
                a.rounded_full,
                {height: PILL_HEIGHT},
                // Reacted-with reads as saturated; the rest are quiet chips.
                own
                  ? {backgroundColor: t.palette.primary_500}
                  : t.atoms.bg_contrast_25,
              ]}>
              <ReactionEmoji emoji={group.emoji} size={14} />
              <Text
                style={[
                  a.text_xs,
                  a.font_bold,
                  own
                    ? {color: accentForeground(t, t.palette.primary_500)}
                    : t.atoms.text_contrast_medium,
                ]}>
                {group.count}
              </Text>
              {/*
                Absolute inside the pill, so it floats over it without taking
                part in the row's layout. The pill is always present here: the
                viewer's own reactions sort to the front of `visible`.
              */}
              {burst?.emoji.uri === group.emoji.uri ? (
                <ReactionBurst
                  emoji={burst.emoji}
                  onComplete={() => setBurst(undefined)}
                />
              ) : null}
            </Button>
          )
        })}
        <Menu.Trigger label={l`Add a reaction`}>
          {({props}) => (
            <PostControlButton
              {...props}
              testID="reactionAddBtn"
              big={big}
              label={props.accessibilityLabel}
              hitSlop={hitSlop}
              /*
               * Repeats PostControlButton's own `bg_transparent`: passing a
               * `style` replaces its base array, and without it the ghost
               * variant's background shows on the pill until hover.
               */
              style={[a.bg_transparent, a.px_2xs, {height: PILL_HEIGHT}]}>
              {/*
                PostControlButtonIcon takes its colour from the button context,
                so the icon matches the other post actions. A plain icon would
                fall back to the accent colour the picker icons use.
              */}
              <PostControlButtonIcon
                icon={visible.length === 0 ? SmileIcon : PlusIcon}
              />
            </PostControlButton>
          )}
        </Menu.Trigger>
        {/*
          A Menu is a portal on both platforms, so it doesn't matter that this
          sits inside the trigger's sibling row.
        */}
        <ReactionDialog
          post={post}
          onReact={emoji => setBurst({emoji, count: 1})}
        />
      </View>
    </Menu.Root>
  )
}
