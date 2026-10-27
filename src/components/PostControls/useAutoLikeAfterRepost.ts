import {type Shadow} from '#/state/cache/types'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {useAutoLikeOnRepost} from '#/state/preferences/auto-like-on-repost'
import {useGetPost, type usePostLikeMutationQueue} from '#/state/queries/post'
import {useSession} from '#/state/session'
import {
  ProgressGuideAction,
  useProgressGuideControls,
} from '#/state/shell/progress-guide'
import * as userActionHistory from '#/state/userActionHistory'
import {type app} from '#/lexicons'

/** Apply the same auto-like preference to repost buttons and compact menus. */
export function useAutoLikeAfterRepost({
  post,
  queueLike,
  feedContext,
  reqId,
  onLike,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  queueLike: ReturnType<typeof usePostLikeMutationQueue>[0]
  feedContext?: string
  reqId?: string
  onLike?: () => void
}) {
  const enabled = useAutoLikeOnRepost()
  const {currentAccount} = useSession()
  const getPost = useGetPost()
  const {sendInteraction} = useFeedFeedbackContext()
  const {captureAction} = useProgressGuideControls()

  return async () => {
    if (
      !enabled ||
      post.author.did === currentAccount?.did ||
      post.viewer?.like
    )
      return
    if (userActionHistory.getActionHistory().likes.includes(post.uri)) return
    let latestPost
    try {
      latestPost = await getPost({uri: post.uri})
    } catch {
      return
    }
    if (latestPost.viewer?.like) return
    onLike?.()
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#interactionLike',
      feedContext,
      reqId,
    })
    captureAction(ProgressGuideAction.Like)
    await queueLike()
  }
}
