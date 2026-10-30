import {memo, useCallback, useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {moderatePost, type ModerationDecision} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {type ReasonFeedSource} from '#/lib/api/feed/types'
import {type FeedPostNumbering} from '#/lib/api/feed-manip'
import {MAX_POST_LINES} from '#/lib/constants'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {usePalette} from '#/lib/hooks/usePalette'
import {makeProfileLink} from '#/lib/routes/links'
import {countLines} from '#/lib/strings/helpers'
import {userStyle} from '#/lib/userstyles'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {useCompactPosts} from '#/state/preferences/compact-posts'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useSeeThroughBlocks} from '#/state/preferences/see-through-blocks'
import {unstableCacheProfileView} from '#/state/queries/profile'
import {
  blockCauses,
  isBlocked,
  useUnblockedPostQuery,
  withLabels,
} from '#/state/queries/see-through-blocks'
import {useSession} from '#/state/session'
import {useMergedThreadgateHiddenReplies} from '#/state/threadgate-hidden-replies'
import {
  buildPostSourceKey,
  setUnstablePostSource,
} from '#/state/unstable-post-source'
import {Link} from '#/view/com/util/Link'
import {PostMeta} from '#/view/com/util/PostMeta'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {
  POST_NUMBER_INLINE_OFFSET,
  ThreadItemPostNumber,
  useHasThreadItemPostNumber,
} from '#/screens/PostThread/components/ThreadItemPostNumber'
import {atoms as a, select, useTheme} from '#/alf'
import {
  GalleryBleed,
  maybeApplyGalleryOffsetStyles,
} from '#/components/images/Gallery'
import {ContentHider} from '#/components/moderation/ContentHider'
import {LabelsOnMyPost} from '#/components/moderation/LabelsOnMe'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {type AppModerationCause} from '#/components/Pills'
import {Embed} from '#/components/Post/Embed'
import {PostEmbedViewContext} from '#/components/Post/Embed/types'
import {KnownLikers} from '#/components/Post/KnownLikers'
import {PostRepliedTo} from '#/components/Post/PostRepliedTo'
import {ShowMoreTextButton} from '#/components/Post/ShowMoreTextButton'
import {TranslatedPost} from '#/components/Post/Translated'
import {PostControls} from '#/components/PostControls'
import {DiscoverDebug} from '#/components/PostControls/DiscoverDebug'
import {PostTags} from '#/components/PostTags'
import {RichText} from '#/components/RichText'
import {SubtleHover} from '#/components/SubtleHover'
import {Text} from '#/components/Typography'
import {Features, useAnalytics} from '#/analytics'
import {IS_NATIVE, IS_WEB} from '#/env'
import {useActorStatus} from '#/features/liveNow'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {AviFollowButton} from './AviFollowButton'
import {PostFeedReason} from './PostFeedReason'

interface FeedItemProps {
  record: app.bsky.feed.post.Main
  postNumbering?: FeedPostNumbering
  reason:
    | app.bsky.feed.defs.ReasonRepost
    | app.bsky.feed.defs.ReasonPin
    | ReasonFeedSource
    | {[k: string]: unknown; $type: string}
    | undefined
  moderation: ModerationDecision
  parentAuthor: app.bsky.actor.defs.ProfileViewBasic | undefined
  showReplyTo: boolean
  isThreadChild?: boolean
  isThreadLastChild?: boolean
  isThreadParent?: boolean
  feedContext: string | undefined
  reqId: string | undefined
  hideTopBorder?: boolean
  isParentBlocked?: boolean
  isParentNotFound?: boolean
  isCarouselItem?: boolean
}

export function PostFeedItem({
  post,
  record,
  postNumbering,
  reason,
  feedContext,
  reqId,
  moderation,
  parentAuthor,
  showReplyTo,
  isThreadChild,
  isThreadLastChild,
  isThreadParent,
  hideTopBorder,
  isParentBlocked,
  isParentNotFound,
  rootPost,
  isCarouselItem,
  onShowLess,
}: FeedItemProps & {
  post: app.bsky.feed.defs.PostView
  rootPost: app.bsky.feed.defs.PostView
  onShowLess?: (interaction: app.bsky.feed.defs.Interaction) => void
}): React.ReactNode {
  const seeThroughBlocks = useSeeThroughBlocks()
  const moderationOpts = useModerationOpts()
  const blocked = seeThroughBlocks && isBlocked(moderation)
  const unblocked = useUnblockedPostQuery({
    uri: post.uri,
    enabled: blocked,
  })
  /*
   * The anonymous read has no `viewer`, so the card that renders it cannot
   * find the block again. Falls back to the original view until it arrives.
   */
  const anonPost =
    blocked && unblocked.data
      ? withLabels(unblocked.data, post)
      : undefined
  const displayPost = anonPost || post
  const displayRecord = bsky.isType(app.bsky.feed.post.main, displayPost.record)
    ? displayPost.record
    : record
  const postShadowed = usePostShadow(displayPost)
  const richText = useMemo(
    () =>
      new RichTextAPI({
        text: displayRecord.text,
        facets: displayRecord.facets,
      }),
    [displayRecord],
  )
  if (postShadowed === POST_TOMBSTONE) {
    return null
  }
  /*
   * The block lived on the original view, so the decision is rebuilt against
   * the anonymous one - otherwise the card would blur itself again once the
   * content arrives. The block causes are rendered as pills separately; see
   * `blockCauses`.
   */
  const displayModeration =
    anonPost && moderationOpts
      ? moderatePost(anonPost, moderationOpts)
      : moderation
  if (richText && moderation) {
    return (
      <ReportDialogMetadataContext.Provider key={postShadowed.uri}>
        <FeedItemInner
          post={postShadowed}
          record={displayRecord}
          seeThrough={Boolean(anonPost)}
          seeThroughCauses={anonPost ? blockCauses(moderation) : undefined}
          postNumbering={postNumbering}
          reason={reason}
          feedContext={feedContext}
          reqId={reqId}
          richText={richText}
          parentAuthor={parentAuthor}
          showReplyTo={showReplyTo}
          moderation={displayModeration}
          isThreadChild={isThreadChild}
          isThreadLastChild={isThreadLastChild}
          isThreadParent={isThreadParent}
          hideTopBorder={hideTopBorder}
          isParentBlocked={isParentBlocked}
          isParentNotFound={isParentNotFound}
          isCarouselItem={isCarouselItem}
          rootPost={rootPost}
          onShowLess={onShowLess}
        />
      </ReportDialogMetadataContext.Provider>
    )
  }
  return null
}

let FeedItemInner = ({
  post,
  record,
  postNumbering,
  reason,
  feedContext,
  reqId,
  richText,
  moderation,
  parentAuthor,
  showReplyTo,
  isThreadChild,
  isThreadLastChild,
  isThreadParent,
  hideTopBorder,
  isParentBlocked,
  isParentNotFound,
  isCarouselItem,
  rootPost,
  onShowLess,
  seeThrough,
  seeThroughCauses,
}: FeedItemProps & {
  richText: RichTextAPI
  post: Shadow<app.bsky.feed.defs.PostView>
  rootPost: app.bsky.feed.defs.PostView
  onShowLess?: (interaction: app.bsky.feed.defs.Interaction) => void
  /** This is an anonymous read of a post you're blocked from. */
  seeThrough?: boolean
  /** The block causes the anonymous read no longer carries. */
  seeThroughCauses?: AppModerationCause[]
}): React.ReactNode => {
  const ax = useAnalytics()
  const queryClient = useQueryClient()
  const {openComposer} = useOpenComposer()
  const pal = usePalette('default')
  const t = useTheme()
  const {currentAccount} = useSession()
  const compactPosts = useCompactPosts()

  const [hover, setHover] = useState(false)

  const [href] = useMemo(() => {
    const urip = new AtUri(post.uri)
    return [makeProfileLink(post.author, 'post', urip.rkey), urip.rkey]
  }, [post.uri, post.author])
  const {sendInteraction, feedSourceInfo, feedDescriptor} =
    useFeedFeedbackContext()

  const onPressReply = () => {
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#interactionReply',
      feedContext,
      reqId,
    })
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: record.text || '',
        author: post.author,
        embed: post.embed,
        moderation,
        langs: record.langs,
      },
      logContext: 'PostReply',
    })
  }

  const onOpenAuthor = () => {
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#clickthroughAuthor',
      feedContext,
      reqId,
    })
    ax.metric('post:clickthroughAuthor', {
      uri: post.uri,
      authorDid: post.author.did,
      logContext: 'FeedItem',
      feedDescriptor,
    })
  }

  const onOpenReposter = () => {
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#clickthroughReposter',
      feedContext,
      reqId,
    })
  }

  const onOpenEmbed = () => {
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#clickthroughEmbed',
      feedContext,
      reqId,
    })
    ax.metric('post:clickthroughEmbed', {
      uri: post.uri,
      authorDid: post.author.did,
      logContext: 'FeedItem',
      feedDescriptor,
    })
  }

  const onBeforePress = () => {
    sendInteraction({
      item: post.uri,
      event: 'app.bsky.feed.defs#clickthroughItem',
      feedContext,
      reqId,
    })
    ax.metric('post:clickthroughItem', {
      uri: post.uri,
      authorDid: post.author.did,
      logContext: 'FeedItem',
      feedDescriptor,
    })
    unstableCacheProfileView(queryClient, post.author)
    setUnstablePostSource(buildPostSourceKey(post.uri, post.author.handle), {
      feedSourceInfo,
      post: {
        post,
        reason: bsky.isType(app.bsky.feed.defs.reasonRepost, reason)
          ? {...reason, $type: 'app.bsky.feed.defs#reasonRepost'}
          : undefined,
        feedContext,
        reqId,
      },
    })
  }

  const outerStyles = [
    styles.outer,
    {
      borderColor: pal.colors.border,
      paddingTop: compactPosts ? 2 : undefined,
      paddingBottom:
        isCarouselItem && IS_WEB
          ? 4
          : isThreadLastChild || (!isThreadChild && !isThreadParent)
            ? compactPosts
              ? 2
              : 8
            : undefined,
      borderTopWidth:
        hideTopBorder || isThreadChild ? 0 : StyleSheet.hairlineWidth,
    },
    isCarouselItem && a.w_full,
  ]

  /**
   * If `post[0]` in this slice is the actual root post (not an orphan thread),
   * then we may have a threadgate record to reference
   */
  const threadgateRecord = bsky.isType(
    app.bsky.feed.threadgate.main,
    rootPost.threadgate?.record,
  )
    ? rootPost.threadgate?.record
    : undefined

  const {isActive: live} = useActorStatus(post.author)

  const viaRepost = useMemo(() => {
    if (
      bsky.isType(app.bsky.feed.defs.reasonRepost, reason) &&
      reason.uri &&
      reason.cid
    ) {
      return {
        uri: reason.uri,
        cid: reason.cid,
      }
    }
  }, [reason])

  const threadgateHiddenReplies = useMergedThreadgateHiddenReplies({
    threadgateRecord,
  })
  const additionalPostAlerts: AppModerationCause[] = useMemo(() => {
    const isPostHiddenByThreadgate = threadgateHiddenReplies.has(post.uri)
    const rootPostUri = bsky.isType(app.bsky.feed.post.main, post.record)
      ? post.record?.reply?.root?.uri || post.uri
      : undefined
    const isControlledByViewer =
      rootPostUri && new AtUri(rootPostUri).host === currentAccount?.did
    const threadgateAlerts: AppModerationCause[] =
      isControlledByViewer && isPostHiddenByThreadgate
        ? [
            {
              type: 'reply-hidden',
              source: {type: 'user', did: currentAccount?.did},
              priority: 6,
            },
          ]
        : []
    return seeThroughCauses?.length
      ? [...seeThroughCauses, ...threadgateAlerts]
      : threadgateAlerts
  }, [post, currentAccount?.did, threadgateHiddenReplies, seeThroughCauses])

  const feedItem = (
    <Link
      testID={`feedItem-by-${post.author.handle}`}
      style={[outerStyles, userStyle('wsky-post__surface')]}
      outerStyle={userStyle('wsky-feed-item', 'wsky-post')}
      href={href}
      noFeedback
      accessible={false}
      onBeforePress={onBeforePress}
      dataSet={{
        keyboardNavigationPost: post.uri,
        keyboardNavigationHref: href,
        keyboardNavigationClickable: 'true',
        feedContext,
        wskyEmbed: post.embed ? 'true' : 'false',
        wskyReply: record.reply ? 'true' : 'false',
        wskyRepost: bsky.isType(app.bsky.feed.defs.reasonRepost, reason)
          ? 'true'
          : 'false',
      }}
      onPointerEnter={() => {
        setHover(true)
      }}
      onPointerLeave={() => {
        setHover(false)
      }}>
      <SubtleHover hover={hover} style={userStyle('wsky-post__hover')} />
      <View
        style={{
          flexDirection: 'row',
          gap: compactPosts ? 8 : 10,
          paddingLeft: compactPosts ? 6 : 8,
        }}>
        <View style={{width: isCarouselItem ? 0 : 42}}>
          {isThreadChild && (
            <View
              style={[
                styles.replyLine,
                {
                  backgroundColor: select(t.name, {
                    light: t.palette.contrast_100,
                    dim: t.palette.contrast_200,
                    dark: t.palette.contrast_200,
                  }),
                  marginBottom: 4,
                },
              ]}
            />
          )}
        </View>

        <View style={[compactPosts ? a.pt_2xs : a.pt_sm, a.flex_shrink]}>
          {reason && (
            <PostFeedReason
              reason={reason}
              moderation={moderation}
              onOpenReposter={onOpenReposter}
              reposterOnly={isCarouselItem}
            />
          )}
        </View>
      </View>

      <View style={[styles.layout, isCarouselItem && a.w_full]}>
        {!isCarouselItem && (
          <View
            style={[styles.layoutAvi, compactPosts && styles.layoutAviCompact]}>
            <AviFollowButton author={post.author} moderation={moderation}>
              <PreviewableUserAvatar
                size={compactPosts ? 34 : 42}
                profile={post.author}
                moderation={moderation.ui('avatar')}
                type={post.author.associated?.labeler ? 'labeler' : 'user'}
                onBeforePress={onOpenAuthor}
                live={live}
              />
            </AviFollowButton>
            {isThreadParent && (
              <View
                style={[
                  styles.replyLine,
                  {
                    backgroundColor: select(t.name, {
                      light: t.palette.contrast_100,
                      dim: t.palette.contrast_200,
                      dark: t.palette.contrast_200,
                    }),
                    marginTop: live ? 8 : 4,
                  },
                ]}
              />
            )}
          </View>
        )}
        <View
          style={[
            styles.layoutContent,
            isCarouselItem && IS_NATIVE && styles.layoutContentCarousel,
            maybeApplyGalleryOffsetStyles('meta', {
              post,
              modui: moderation.ui('contentList'),
              additionalCauses: additionalPostAlerts,
            }),
          ]}>
          <PostMeta
            author={post.author}
            moderation={moderation}
            timestamp={post.indexedAt}
            postHref={href}
            onOpenAuthor={onOpenAuthor}
            showAvatar={isCarouselItem}
            avatarSize={16}
            narrowLayout={isCarouselItem}
            constrainWidth={isCarouselItem && IS_NATIVE}
            style={
              isCarouselItem && IS_NATIVE ? styles.postMetaCarousel : undefined
            }
          />
          {showReplyTo &&
            (parentAuthor || isParentBlocked || isParentNotFound) && (
              <PostRepliedTo
                parentAuthor={parentAuthor}
                isParentBlocked={isParentBlocked}
                isParentNotFound={isParentNotFound}
              />
            )}
          <LabelsOnMyPost post={post} />
          {seeThrough && (
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                a.pb_2xs,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Blocked - shown anonymously</Trans>
            </Text>
          )}
          <PostContent
            compactPosts={!!compactPosts}
            isCarouselItem={isCarouselItem}
            moderation={moderation}
            richText={richText}
            postNumbering={postNumbering}
            postEmbed={post.embed}
            postAuthor={post.author}
            onOpenEmbed={onOpenEmbed}
            post={post}
            additionalPostAlerts={additionalPostAlerts}
            feedDescriptor={feedDescriptor}
          />
          <PostControls
            variant={compactPosts ? 'compact' : undefined}
            post={post}
            record={record}
            richText={richText}
            onPressReply={onPressReply}
            logContext="FeedItem"
            feedContext={feedContext}
            reqId={reqId}
            threadgateRecord={threadgateRecord}
            onShowLess={onShowLess}
            viaRepost={viaRepost}
          />
          <KnownLikers
            post={post}
            feature={Features.PostFeedKnownLikersEnable}
            outerStyle={[a.py_sm]}
          />
        </View>

        <DiscoverDebug feedContext={feedContext} />
      </View>
    </Link>
  )

  if (isCarouselItem) {
    return feedItem
  }

  return <GalleryBleed>{feedItem}</GalleryBleed>
}
FeedItemInner = memo(FeedItemInner)

let PostContent = ({
  compactPosts,
  isCarouselItem,
  post,
  postNumbering,
  moderation,
  richText,
  postEmbed,
  postAuthor,
  onOpenEmbed,
  additionalPostAlerts,
  feedDescriptor,
}: {
  compactPosts: boolean
  isCarouselItem?: boolean
  moderation: ModerationDecision
  richText: RichTextAPI
  postEmbed: app.bsky.feed.defs.PostView['embed']
  postAuthor: app.bsky.feed.defs.PostView['author']
  onOpenEmbed: () => void
  post: app.bsky.feed.defs.PostView
  postNumbering: FeedPostNumbering | undefined
  additionalPostAlerts?: AppModerationCause[]
  feedDescriptor?: string
}): React.ReactNode => {
  const [limitLines, setLimitLines] = useState(
    () => countLines(richText.text) >= MAX_POST_LINES,
  )
  const showPostNumber = useHasThreadItemPostNumber(postNumbering)

  const record = useMemo<app.bsky.feed.post.Main | undefined>(
    () =>
      bsky.isType(app.bsky.feed.post.main, post.record)
        ? post.record
        : undefined,
    [post],
  )

  const onPressShowMore = useCallback(() => {
    setLimitLines(false)
  }, [setLimitLines])

  return (
    <ContentHider
      testID="contentHider-post"
      style={userStyle('wsky-post__content')}
      modui={moderation.ui('contentList')}
      ignoreMute
      childContainerStyle={[
        styles.contentHiderChild,
        compactPosts && styles.contentHiderChildCompact,
      ]}>
      <PostAlerts
        post={post}
        modui={moderation.ui('contentList')}
        style={[a.pb_xs]}
        additionalCauses={additionalPostAlerts}
      />
      {richText.text ? (
        <View style={[a.mb_2xs, userStyle('wsky-post__text')]}>
          <RichText
            enableTags
            testID="postText"
            value={richText}
            numberOfLines={limitLines ? MAX_POST_LINES : undefined}
            style={[isCarouselItem ? a.text_md : [a.flex_1, a.text_md]]}
            authorHandle={postAuthor.handle}
            shouldProxyLinks={true}
            suffixOffset={POST_NUMBER_INLINE_OFFSET}
            suffix={
              !limitLines && showPostNumber ? (
                <ThreadItemPostNumber value={postNumbering} />
              ) : undefined
            }
          />
          {limitLines && (
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <ShowMoreTextButton
                style={[a.text_md]}
                onPress={onPressShowMore}
              />
              <ThreadItemPostNumber inline={false} value={postNumbering} />
            </View>
          )}
        </View>
      ) : (
        <ThreadItemPostNumber inline={false} value={postNumbering} />
      )}
      {record && <TranslatedPost hideTranslateLink post={post} />}
      {postEmbed ? (
        <View
          style={[
            userStyle('wsky-post__embed'),
            a.pb_xs,
            maybeApplyGalleryOffsetStyles('embed', {
              post,
              modui: moderation.ui('contentList'),
              additionalCauses: additionalPostAlerts,
            }),
          ]}>
          <Embed
            embed={postEmbed}
            moderation={moderation}
            onOpen={onOpenEmbed}
            viewContext={
              isCarouselItem
                ? PostEmbedViewContext.FeedCarousel
                : PostEmbedViewContext.Feed
            }
            post={post}
            feedDescriptor={feedDescriptor}
          />
        </View>
      ) : null}
      <PostTags post={post} style={[a.pb_2xs]} />
    </ContentHider>
  )
}
PostContent = memo(PostContent)

const styles = StyleSheet.create({
  outer: {
    paddingLeft: 10,
    paddingRight: 15,
    cursor: 'pointer',
  },
  replyLine: {
    flexGrow: 1,
    width: 2,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  layout: {
    flexDirection: 'row',
    marginTop: 1,
  },
  layoutAvi: {
    paddingLeft: 8,
    paddingRight: 10,
  },
  layoutAviCompact: {
    paddingLeft: 6,
    paddingRight: 8,
  },
  layoutContent: {
    flex: 1,
  },
  layoutContentCarousel: {
    flex: 1,
    minWidth: 0,
    width: 0,
  },
  postMetaCarousel: {
    flex: 0,
    flexGrow: 0,
  },
  alert: {
    marginTop: 6,
    marginBottom: 6,
  },
  contentHiderChild: {
    marginTop: 6,
  },
  contentHiderChildCompact: {
    marginTop: 2,
  },
  embed: {
    marginBottom: 6,
  },
  translateLink: {
    marginBottom: 6,
  },
})
