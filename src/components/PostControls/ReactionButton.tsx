import {type Insets, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {type Shadow} from '#/state/cache/post-shadow'
import {useHideBluemojiReactions} from '#/state/preferences/hide-bluemoji-reactions'
import {useRequireAuth} from '#/state/session'
import * as Dialog from '#/components/Dialog'
import {EmojiSmile_Stroke2_Corner0_Rounded as ReactionIcon} from '#/components/icons/Emoji'
import {MetricCountLabel} from '#/components/PostControls/MetricCountLabel'
import {
  PostControlButton,
  PostControlButtonIcon,
} from '#/components/PostControls/PostControlButton'
import {
  useReactionCountsQuery,
  useViewerReactionForPost,
} from '#/features/bluemoji/reactions/queries'
import {ReactionDialog} from '#/features/bluemoji/reactions/ReactionDialog'
import {type ReactionGroup} from '#/features/bluemoji/reactions/util'
import {type app} from '#/lexicons'

/**
 * Post control row entry point. Opens the same sheet the under-post strip
 * does; the count is the sum of every reaction group.
 */
export function ReactionButton({
  post,
  big,
  onLongPress,
  hitSlop,
  metricsDisplay = 'visible',
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  big?: boolean
  onLongPress?: () => void
  hitSlop?: Insets
  metricsDisplay?: Parameters<typeof MetricCountLabel>[0]['display']
}) {
  const {t: l} = useLingui()
  const requireAuth = useRequireAuth()
  const dialogControl = Dialog.useDialogControl()
  const hidden = useHideBluemojiReactions()
  const {data: groups} = useReactionCountsQuery(post.uri)
  const viewerReactions = useViewerReactionForPost(post.uri)
  const total = (groups ?? []).reduce(
    (sum: number, group: ReactionGroup) => sum + group.count,
    0,
  )
  const reacted = Boolean(viewerReactions?.length)

  if (hidden) return null

  return (
    <View>
      <PostControlButton
        testID="reactionBtn"
        active={reacted}
        activeColor="primary"
        big={big}
        onPress={() => requireAuth(() => dialogControl.open())}
        onLongPress={onLongPress}
        hitSlop={hitSlop}
        label={
          reacted
            ? l({
                message: `View your reactions (${plural(total, {
                  one: '# reaction',
                  other: '# reactions',
                })})`,
                comment:
                  'Accessibility label for the reaction button when the viewer has reacted, verb followed by the total number of reactions',
              })
            : l({
                message: `React (${plural(total, {
                  one: '# reaction',
                  other: '# reactions',
                })})`,
                comment:
                  'Accessibility label for the reaction button when the viewer has not reacted, verb followed by the total number of reactions',
              })
        }>
        <PostControlButtonIcon icon={ReactionIcon} />
        <MetricCountLabel
          display={metricsDisplay}
          count={total}
          testID="reactionCount"
          labelOnly={plural(total, {one: 'reaction', other: 'reactions'})}
        />
      </PostControlButton>
      <Dialog.Outer
        control={dialogControl}
        nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <ReactionDialog post={post} />
      </Dialog.Outer>
    </View>
  )
}
