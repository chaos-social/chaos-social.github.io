import {memo, useMemo, useRef, useState} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {type RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {CountWheel} from '#/lib/custom-animations/CountWheel'
import {AnimatedLikeIcon} from '#/lib/custom-animations/LikeIcon'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {
  shouldShowCountsMetricLabelOnly,
  shouldShowCountsMetricRow,
} from '#/lib/metrics-display'
import {userStyle} from '#/lib/userstyles'
import {type Shadow} from '#/state/cache/types'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {useAutoLikeOnRepost} from '#/state/preferences/auto-like-on-repost'
import {
  useLikesMetricsDisplay,
  useQuotesMetricsDisplay,
  useReplyMetricsDisplay,
  useRepostsMetricsDisplay,
} from '#/state/preferences/metrics-display-preference'
import {
  usePostLikeMutationQueue,
  usePostRepostMutationQueue,
} from '#/state/queries/post'
import {
  threadgateRecordToAllowUISetting,
  threadgateViewToAllowUISetting,
} from '#/state/queries/threadgate/util'
import {useRequireAuth, useSession} from '#/state/session'
import {
  ProgressGuideAction,
  useProgressGuideControls,
} from '#/state/shell/progress-guide'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {EphemeralAccountSwitcherFromScope} from '#/components/EphemeralAccountSwitcher'
import {useEphemeralAccountError} from '#/components/hooks/useEphemeralAccountError'
import {useFormatPostStatCount} from '#/components/PostControls/util'
import * as Skele from '#/components/Skeleton'
import * as Toast from '#/components/Toast'
import {useAnalytics} from '#/analytics'
import {type app} from '#/lexicons'
import {useRunWithEphemeralAgent} from '../hooks/useRunWithEphemeralAgent'
import {BookmarkButton} from './BookmarkButton'
import {MetricCountLabel} from './MetricCountLabel'
import {
  PostControlButton,
  PostControlButtonIcon,
  PostControlButtonText,
} from './PostControlButton'
import {PostMenuButton} from './PostMenu'
import {useReplyIcon} from './ReplyIcon'
import {RepostButton} from './RepostButton'
import {ShareMenuButton} from './ShareMenu'
import {useAutoLikeAfterRepost} from './useAutoLikeAfterRepost'

function PostControlsInner({
  big,
  post,
  record,
  richText,
  feedContext,
  reqId,
  style,
  onPressReply,
  onPostReply,
  logContext,
  threadgateRecord,
  onShowLess,
  viaRepost,
  variant,
  forceGoogleTranslate = false,
}: {
  big?: boolean
  post: Shadow<app.bsky.feed.defs.PostView>
  record: app.bsky.feed.post.Main
  richText: RichTextAPI
  feedContext?: string | undefined
  reqId?: string | undefined
  style?: StyleProp<ViewStyle>
  onPressReply: () => void
  onPostReply?: (postUri: string | undefined) => void
  logContext: 'FeedItem' | 'PostThreadItem' | 'Post' | 'ImmersiveVideo'
  threadgateRecord?: app.bsky.feed.threadgate.Main
  onShowLess?: (interaction: app.bsky.feed.defs.Interaction) => void
  viaRepost?: {uri: string; cid: string}
  variant?: 'compact' | 'normal' | 'large'
  forceGoogleTranslate?: boolean
}): React.ReactNode {
  const ax = useAnalytics()
  const t = useTheme()
  const {t: l} = useLingui()
  const {openComposer} = useOpenComposer()
  const {feedDescriptor} = useFeedFeedbackContext()
  const {accounts, currentAccount} = useSession()
  const runWithEphemeralAgent = useRunWithEphemeralAgent()
  const showEphemeralError = useEphemeralAccountError()
  const [queueLike, queueUnlike] = usePostLikeMutationQueue(
    post,
    viaRepost,
    feedDescriptor,
    logContext,
  )
  const [queueRepost, queueUnrepost] = usePostRepostMutationQueue(
    post,
    viaRepost,
    feedDescriptor,
    logContext,
  )
  const requireAuth = useRequireAuth()
  const {sendInteraction} = useFeedFeedbackContext()
  const {captureAction} = useProgressGuideControls()
  const isBlocked = Boolean(
    post.author.viewer?.blocking ||
    post.author.viewer?.blockedBy ||
    post.author.viewer?.blockingByList,
  )
  const replyDisabled = post.viewer?.replyDisabled
  const isReplyGatedPost = useMemo(() => {
    const settings = threadgateRecord
      ? threadgateRecordToAllowUISetting(threadgateRecord)
      : threadgateViewToAllowUISetting(post.threadgate)
    return !(settings.length === 1 && settings[0].type === 'everybody')
  }, [threadgateRecord, post.threadgate])
  const {gtPhone} = useBreakpoints()
  const likesMetricsDisplay = useLikesMetricsDisplay()
  const repostsMetricsDisplay = useRepostsMetricsDisplay()
  const replyMetricsDisplay = useReplyMetricsDisplay()
  const quotesMetricsDisplay = useQuotesMetricsDisplay()
  const formatPostStatCount = useFormatPostStatCount(likesMetricsDisplay)
  const ReplyIcon = useReplyIcon(post.replyCount ?? 0, isReplyGatedPost)

  const [hasLikeIconBeenToggled, setHasLikeIconBeenToggled] = useState(false)

  const autoLikeOnRepost = useAutoLikeOnRepost()
  const autoLikeAfterRepost = useAutoLikeAfterRepost({
    post,
    queueLike,
    feedContext,
    reqId,
    onLike: () => setHasLikeIconBeenToggled(true),
  })

  const onPressToggleLike = async () => {
    if (isBlocked) {
      Toast.show(l`Cannot interact with a blocked user`, {
        type: 'warning',
      })
      return
    }

    const existingLike = post.viewer?.like
    try {
      setHasLikeIconBeenToggled(true)
      if (!existingLike) {
        sendInteraction({
          item: post.uri,
          event: 'app.bsky.feed.defs#interactionLike',
          feedContext,
          reqId,
        })
        captureAction(ProgressGuideAction.Like)
        await queueLike()
      } else {
        await queueUnlike()
      }
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        throw e
      }
    }
  }

  const repostInFlight = useRef(false)

  const onRepost = async (bump = false) => {
    if (repostInFlight.current) return
    if (isBlocked) {
      Toast.show(l`Cannot interact with a blocked user`, {
        type: 'warning',
      })
      return
    }

    const existingRepost = post.viewer?.repost
    repostInFlight.current = true
    try {
      if (bump && post.viewer?.repost) {
        await queueUnrepost()
        await queueRepost()
        Toast.show(l`Repost bumped`)
      } else if (!existingRepost) {
        sendInteraction({
          item: post.uri,
          event: 'app.bsky.feed.defs#interactionRepost',
          feedContext,
          reqId,
        })
        await queueRepost()
        await autoLikeAfterRepost()
      } else {
        await queueUnrepost()
      }
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        if (bump) {
          Toast.show(l`Could not bump repost. Please try again.`, {
            type: 'error',
          })
        } else {
          throw e
        }
      }
    } finally {
      repostInFlight.current = false
    }
  }

  const onQuote = (openAccountSwitcher = false) => {
    if (isBlocked) {
      Toast.show(l`Cannot interact with a blocked user`, {
        type: 'warning',
      })
      return
    }

    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#interactionQuote',
      feedContext,
      reqId,
    })
    ax.metric('post:clickQuotePost', {
      uri: post.uri,
      authorDid: post.author.did,
      logContext,
      feedDescriptor,
    })
    openComposer({
      quote: post,
      openAccountSwitcher,
      onPost: onPostReply,
      logContext: 'QuotePost',
    })
  }

  const onShare = () => {
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#interactionShare',
      feedContext,
      reqId,
    })
  }

  const onReplyAsAccount = (accountDid: string) => {
    setTimeout(() => {
      ax.metric('post:clickReply', {
        uri: post.uri,
        authorDid: post.author.did,
        logContext,
        feedDescriptor,
      })
      openComposer({
        activeAccountDid: accountDid,
        replyTo: {
          uri: post.uri,
          cid: post.cid,
          text: record.text || '',
          author: post.author,
          embed: post.embed,
          langs: record.langs,
        },
        onPost: onPostReply,
        logContext: 'PostReply',
      })
    }, 0)
  }

  const secondaryControlSpacingStyles = useSecondaryControlSpacingStyles({
    variant,
    big,
    gtPhone,
  })
  const hasAlternateAccounts = accounts.length > 1 && Boolean(currentAccount)
  const onSelectReplyAccount = async (account: (typeof accounts)[number]) => {
    try {
      if (isReplyGatedPost) {
        const allowed = await runWithEphemeralAgent(account, async agent => {
          const res = await agent.getPosts({uris: [post.uri]})
          const target = res.data.posts[0]
          return Boolean(target && !target.viewer?.replyDisabled)
        })
        if (!allowed) {
          Toast.show(l`This account cannot reply to this post`, {
            type: 'warning',
          })
          return
        }
      }
      onReplyAsAccount(account.did)
    } catch (error) {
      showEphemeralError(error, account, onSelectReplyAccount)
    }
  }

  const onSelectLikeAccount = async (account: (typeof accounts)[number]) => {
    try {
      const wasLiked = await runWithEphemeralAgent(account, async agent => {
        const res = await agent.getPosts({uris: [post.uri]})
        const target = res.data.posts[0]
        const likeUri = target?.viewer?.like

        if (likeUri) {
          await agent.deleteLike(likeUri)
          return true
        }

        await agent.like(post.uri, post.cid)
        return false
      })

      if (wasLiked) {
        Toast.show(l`Removed like as @${account.handle}`)
      } else {
        Toast.show(l`Liked as @${account.handle}`)
      }
    } catch (e) {
      showEphemeralError(e, account, onSelectLikeAccount)
    }
  }

  const onSelectRepostAccount = async (account: (typeof accounts)[number]) => {
    try {
      const wasReposted = await runWithEphemeralAgent(account, async agent => {
        const res = await agent.getPosts({uris: [post.uri]})
        const target = res.data.posts[0]
        const repostUri = target?.viewer?.repost

        if (repostUri) {
          await agent.deleteRepost(repostUri)
          return true
        }

        await agent.repost(post.uri, post.cid)
        if (
          autoLikeOnRepost &&
          target &&
          target.author.did !== account.did &&
          !target.viewer?.like
        ) {
          await agent.like(post.uri, post.cid)
        }
        return false
      })

      if (wasReposted) {
        Toast.show(l`Removed repost as @${account.handle}`)
      } else {
        Toast.show(l`Reposted as @${account.handle}`)
      }
    } catch (e) {
      showEphemeralError(e, account, onSelectRepostAccount)
    }
  }

  const onSelectBookmarkAccount = async (
    account: (typeof accounts)[number],
  ) => {
    try {
      const wasBookmarked = await runWithEphemeralAgent(
        account,
        async agent => {
          const res = await agent.getPosts({uris: [post.uri]})
          const target = res.data.posts[0]

          if (target?.viewer?.bookmarked) {
            await agent.app.bsky.bookmark.deleteBookmark({uri: post.uri})
            return true
          }

          await agent.app.bsky.bookmark.createBookmark({
            uri: post.uri,
            cid: post.cid,
          })
          return false
        },
      )

      if (wasBookmarked) {
        Toast.show(l`Removed save as @${account.handle}`)
      } else {
        Toast.show(l`Saved as @${account.handle}`)
      }
    } catch (e) {
      showEphemeralError(e, account, onSelectBookmarkAccount)
    }
  }

  const renderReplyButton = (onLongPress?: () => void) => (
    <PostControlButton
      testID="replyBtn"
      onPress={
        !replyDisabled
          ? () =>
              requireAuth(() => {
                ax.metric('post:clickReply', {
                  uri: post.uri,
                  authorDid: post.author.did,
                  logContext,
                  feedDescriptor,
                })
                onPressReply()
              })
          : undefined
      }
      onLongPress={onLongPress}
      label={l({
        message: `Reply (${plural(post.replyCount || 0, {
          one: '# reply',
          other: '# replies',
        })})`,
        comment:
          'Accessibility label for the reply button, verb form followed by number of replies and noun form',
      })}
      big={big}>
      <PostControlButtonIcon icon={ReplyIcon} />
      <MetricCountLabel
        display={replyMetricsDisplay}
        count={post.replyCount ?? 0}
        labelOnly={plural(post.replyCount ?? 0, {
          one: 'reply',
          other: 'replies',
        })}
      />
    </PostControlButton>
  )

  const renderRepostButton = (onLongPress?: () => void) => (
    <RepostButton
      isReposted={!!post.viewer?.repost}
      repostCount={
        (shouldShowCountsMetricRow(repostsMetricsDisplay)
          ? (post.repostCount ?? 0)
          : 0) +
        (shouldShowCountsMetricRow(quotesMetricsDisplay)
          ? (post.quoteCount ?? 0)
          : 0)
      }
      metricsDisplay={
        (post.repostCount ?? 0) > 0
          ? repostsMetricsDisplay
          : quotesMetricsDisplay
      }
      onRepost={() => void onRepost()}
      onBumpRepost={() => void onRepost(true)}
      onQuote={onQuote}
      onLongPress={onLongPress}
      big={big}
      embeddingDisabled={Boolean(post.viewer?.embeddingDisabled)}
    />
  )

  const renderLikeButton = (onLongPress?: () => void) => (
    <PostControlButton
      testID="likeBtn"
      big={big}
      active={Boolean(post.viewer?.like)}
      activeColor={t.palette.pink}
      onPress={() => requireAuth(() => onPressToggleLike())}
      onLongPress={onLongPress}
      label={
        post.viewer?.like
          ? l({
              message: `Unlike (${plural(post.likeCount || 0, {
                one: '# like',
                other: '# likes',
              })})`,
              comment:
                'Accessibility label for the like button when the post has been liked, verb followed by number of likes and noun',
            })
          : l({
              message: `Like (${plural(post.likeCount || 0, {
                one: '# like',
                other: '# likes',
              })})`,
              comment:
                'Accessibility label for the like button when the post has not been liked, verb form followed by number of likes and noun form',
            })
      }>
      <AnimatedLikeIcon
        isLiked={Boolean(post.viewer?.like)}
        big={big}
        hasBeenToggled={hasLikeIconBeenToggled}
      />
      {shouldShowCountsMetricRow(likesMetricsDisplay) ? (
        shouldShowCountsMetricLabelOnly(
          likesMetricsDisplay,
          post.likeCount ?? 0,
        ) ? (
          <MetricCountLabel
            display={likesMetricsDisplay}
            count={post.likeCount ?? 0}
            testID="likeCount"
            labelOnly={plural(post.likeCount ?? 0, {
              one: 'like',
              other: 'likes',
            })}
          />
        ) : (
          <CountWheel
            count={post.likeCount ?? 0}
            isToggled={Boolean(post.viewer?.like)}
            hasBeenToggled={hasLikeIconBeenToggled}
            renderCount={({count}) => (
              <PostControlButtonText testID="likeCount">
                {formatPostStatCount(count)}
              </PostControlButtonText>
            )}
          />
        )
      ) : null}
    </PostControlButton>
  )

  return (
    <>
      <View
        style={[
          userStyle('wsky-post__actions'),
          a.flex_row,
          a.justify_between,
          a.align_center,
          !big && a.pt_2xs,
          a.gap_md,
          style,
        ]}>
        <View style={[a.flex_row, a.flex_1, {maxWidth: 320}]}>
          <View
            style={[
              a.flex_1,
              a.align_start,
              {marginLeft: big ? -2 : -6},
              replyDisabled ? {opacity: 0.6} : undefined,
            ]}>
            {hasAlternateAccounts && currentAccount ? (
              <EphemeralAccountSwitcherFromScope
                selectedDid={currentAccount.did}
                title={l`Reply as`}
                triggerBehavior="longPress"
                onSelectAccount={account => {
                  void onSelectReplyAccount(account)
                }}
                renderTrigger={({triggerProps}) =>
                  renderReplyButton(triggerProps.onLongPress)
                }
              />
            ) : (
              renderReplyButton()
            )}
          </View>
          <View style={[a.flex_1, a.align_start]}>
            {hasAlternateAccounts && currentAccount ? (
              <EphemeralAccountSwitcherFromScope
                selectedDid={currentAccount.did}
                title={l`Repost as`}
                triggerBehavior="longPress"
                onSelectAccount={account => {
                  void onSelectRepostAccount(account)
                }}
                renderTrigger={({triggerProps}) =>
                  renderRepostButton(triggerProps.onLongPress)
                }
              />
            ) : (
              renderRepostButton()
            )}
          </View>
          <View style={[a.flex_1, a.align_start]}>
            {hasAlternateAccounts && currentAccount ? (
              <EphemeralAccountSwitcherFromScope
                selectedDid={currentAccount.did}
                title={l`Like as`}
                triggerBehavior="longPress"
                onSelectAccount={account => {
                  void onSelectLikeAccount(account)
                }}
                renderTrigger={({triggerProps}) =>
                  renderLikeButton(triggerProps.onLongPress)
                }
              />
            ) : (
              renderLikeButton()
            )}
          </View>
          {/* Spacer! */}
          <View />
        </View>
        <View
          style={[a.flex_row, a.justify_end, secondaryControlSpacingStyles]}>
          {hasAlternateAccounts && currentAccount ? (
            <EphemeralAccountSwitcherFromScope
              selectedDid={currentAccount.did}
              title={l`Save as`}
              triggerBehavior="longPress"
              onSelectAccount={account => {
                void onSelectBookmarkAccount(account)
              }}
              renderTrigger={({triggerProps}) => (
                <BookmarkButton
                  post={post}
                  big={big}
                  logContext={logContext}
                  onLongPress={triggerProps.onLongPress}
                  hitSlop={{
                    right: secondaryControlSpacingStyles.gap / 2,
                  }}
                />
              )}
            />
          ) : (
            <BookmarkButton
              post={post}
              big={big}
              logContext={logContext}
              hitSlop={{
                right: secondaryControlSpacingStyles.gap / 2,
              }}
            />
          )}
          <ShareMenuButton
            testID="postShareBtn"
            post={post}
            big={big}
            record={record}
            richText={richText}
            timestamp={post.indexedAt}
            threadgateRecord={threadgateRecord}
            onShare={onShare}
            hitSlop={{
              left: secondaryControlSpacingStyles.gap / 2,
              right: secondaryControlSpacingStyles.gap / 2,
            }}
            logContext={logContext}
          />
          <PostMenuButton
            testID="postDropdownBtn"
            post={post}
            postFeedContext={feedContext}
            postReqId={reqId}
            big={big}
            record={record}
            richText={richText}
            timestamp={post.indexedAt}
            threadgateRecord={threadgateRecord}
            onShowLess={onShowLess}
            hitSlop={{
              left: secondaryControlSpacingStyles.gap / 2,
            }}
            logContext={logContext}
            forceGoogleTranslate={forceGoogleTranslate}
          />
        </View>
      </View>
    </>
  )
}

const PostControls = memo(PostControlsInner)
export {PostControls}

export function PostControlsSkeleton({
  big,
  style,
  variant,
}: {
  big?: boolean
  style?: StyleProp<ViewStyle>
  variant?: 'compact' | 'normal' | 'large'
}) {
  const {gtPhone} = useBreakpoints()

  const rowHeight = big ? 32 : 28
  const padding = 4
  const size = rowHeight - padding * 2

  const secondaryControlSpacingStyles = useSecondaryControlSpacingStyles({
    variant,
    big,
    gtPhone,
  })

  const itemStyles = {
    padding,
  }

  return (
    <Skele.Row
      style={[a.flex_row, a.justify_between, a.align_center, a.gap_md, style]}>
      <View style={[a.flex_row, a.flex_1, {maxWidth: 320}]}>
        <View
          style={[itemStyles, a.flex_1, a.align_start, {marginLeft: -padding}]}>
          <Skele.Pill blend size={size} />
        </View>

        <View style={[itemStyles, a.flex_1, a.align_start]}>
          <Skele.Pill blend size={size} />
        </View>

        <View style={[itemStyles, a.flex_1, a.align_start]}>
          <Skele.Pill blend size={size} />
        </View>
      </View>
      <View style={[a.flex_row, a.justify_end, secondaryControlSpacingStyles]}>
        <View style={itemStyles}>
          <Skele.Circle blend size={size} />
        </View>
        <View style={itemStyles}>
          <Skele.Circle blend size={size} />
        </View>
        <View style={itemStyles}>
          <Skele.Circle blend size={size} />
        </View>
      </View>
    </Skele.Row>
  )
}

function useSecondaryControlSpacingStyles({
  variant,
  big,
  gtPhone,
}: {
  variant?: 'compact' | 'normal' | 'large'
  big?: boolean
  gtPhone: boolean
}) {
  return useMemo(() => {
    let gap = 0 // default, we want `gap` to be defined on the resulting object
    if (variant !== 'compact') gap = a.gap_xs.gap
    if (big || gtPhone) gap = a.gap_sm.gap
    return {gap}
  }, [variant, big, gtPhone])
}
