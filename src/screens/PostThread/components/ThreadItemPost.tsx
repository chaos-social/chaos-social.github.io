import {memo, type ReactNode, useCallback, useMemo, useState} from 'react'
import {View} from 'react-native'
import {type StyleProp, type ViewStyle} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans} from '@lingui/react/macro'

import {MAX_POST_LINES} from '#/lib/constants'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {makeProfileLink} from '#/lib/routes/links'
import {getShapeRadius} from '#/lib/shapes'
import {countLines} from '#/lib/strings/helpers'
import {userStyle} from '#/lib/userstyles'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useCompactPosts} from '#/state/preferences/compact-posts'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {useSession} from '#/state/session'
import {type OnPostSuccessData} from '#/state/shell/composer'
import {useMergedThreadgateHiddenReplies} from '#/state/threadgate-hidden-replies'
import {PostMeta} from '#/view/com/util/PostMeta'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {
  POST_NUMBER_INLINE_OFFSET,
  ThreadItemPostNumber,
  useHasThreadItemPostNumber,
} from '#/screens/PostThread/components/ThreadItemPostNumber'
import {
  LINEAR_AVI_WIDTH,
  OUTER_SPACE,
  REPLY_LINE_WIDTH,
} from '#/screens/PostThread/const'
import {atoms as a, useTheme} from '#/alf'
import {DebugFieldDisplay} from '#/components/DebugFieldDisplay'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {
  GalleryBleed,
  maybeApplyGalleryOffsetStyles,
} from '#/components/images/Gallery'
import {LabelsOnMyPost} from '#/components/moderation/LabelsOnMe'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import {PostHider} from '#/components/moderation/PostHider'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {type AppModerationCause} from '#/components/Pills'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {ShowMoreTextButton} from '#/components/Post/ShowMoreTextButton'
import {TranslatedPost} from '#/components/Post/Translated'
import {PostControls, PostControlsSkeleton} from '#/components/PostControls'
import {PostTags} from '#/components/PostTags'
import {RichText} from '#/components/RichText'
import * as Skele from '#/components/Skeleton'
import {SubtleHover} from '#/components/SubtleHover'
import {Text} from '#/components/Typography'
import {useActorStatus} from '#/features/liveNow'
import {type app} from '#/lexicons'

export type ThreadItemPostProps = {
  item: Extract<ThreadItem, {type: 'threadPost'}>
  overrides?: {
    moderation?: boolean
    topBorder?: boolean
  }
  /**
   * Adjusts the hover overlay, e.g. to start at the reader bracket edge.
   */
  hoverStyle?: StyleProp<ViewStyle>
  onPostSuccess?: (data: OnPostSuccessData) => void
  threadgateRecord?: app.bsky.feed.threadgate.Main
}

export function ThreadItemPost({
  item,
  overrides,
  hoverStyle,
  onPostSuccess,
  threadgateRecord,
}: ThreadItemPostProps) {
  const postShadow = usePostShadow(item.value.post)

  if (postShadow === POST_TOMBSTONE) {
    return <ThreadItemPostDeleted item={item} overrides={overrides} />
  }

  return (
    <ReportDialogMetadataContext.Provider key={postShadow.uri}>
      <ThreadItemPostInner
        item={item}
        postShadow={postShadow}
        threadgateRecord={threadgateRecord}
        overrides={overrides}
        hoverStyle={hoverStyle}
        onPostSuccess={onPostSuccess}
      />
    </ReportDialogMetadataContext.Provider>
  )
}

function ThreadItemPostDeleted({
  item,
  overrides,
}: Pick<ThreadItemPostProps, 'item' | 'overrides'>) {
  const t = useTheme()

  return (
    <ThreadItemPostOuterWrapper item={item} overrides={overrides}>
      <ThreadItemPostParentReplyLine
        item={item}
        avatarSize={LINEAR_AVI_WIDTH}
        compactPosts={false}
      />

      <View
        style={[
          a.flex_row,
          a.align_center,
          a.py_md,
          a.rounded_sm,
          t.atoms.bg_contrast_25,
        ]}>
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.justify_center,
            {
              width: LINEAR_AVI_WIDTH,
            },
          ]}>
          <TrashIcon style={[t.atoms.text_contrast_medium]} />
        </View>
        <Text
          style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          <Trans>Post has been deleted</Trans>
        </Text>
      </View>

      <View style={[{height: 4}]} />
    </ThreadItemPostOuterWrapper>
  )
}

const ThreadItemPostOuterWrapper = memo(function ThreadItemPostOuterWrapper({
  item,
  overrides,
  children,
}: Pick<ThreadItemPostProps, 'item' | 'overrides'> & {
  children: ReactNode
}) {
  const t = useTheme()
  const compactPosts = useCompactPosts()
  const showTopBorder =
    !item.ui.showParentReplyLine && overrides?.topBorder !== true

  return (
    <GalleryBleed>
      <View
        // @ts-expect-error web only -wsky
        dataSet={{
          wskyEmbed: item.value.post.embed ? 'true' : 'false',
          wskyReply: item.value.post.record.reply ? 'true' : 'false',
          wskyRepost: 'false',
        }}
        style={[
          userStyle('wsky-post', 'wsky-post__surface'),
          showTopBorder && [a.border_t, t.atoms.border_contrast_low],
          {paddingHorizontal: compactPosts ? OUTER_SPACE - 2 : OUTER_SPACE},
          // If there's no next child, add a little padding to bottom
          !item.ui.showChildReplyLine &&
            !item.ui.precedesChildReadMore && {
              paddingBottom: compactPosts ? OUTER_SPACE / 3 : OUTER_SPACE / 2,
            },
        ]}>
        {children}
      </View>
    </GalleryBleed>
  )
})

/**
 * Provides some space between posts as well as contains the reply line
 */
const ThreadItemPostParentReplyLine = memo(
  function ThreadItemPostParentReplyLine({
    item,
    avatarSize,
    compactPosts,
  }: {
    item: Extract<ThreadItem, {type: 'threadPost'}>
    avatarSize: number
    compactPosts: boolean
  }) {
    const t = useTheme()
    return (
      <View style={[a.flex_row, {height: compactPosts ? 8 : 12}]}>
        <View style={{width: avatarSize}}>
          {item.ui.showParentReplyLine && (
            <View
              style={[
                a.mx_auto,
                a.flex_1,
                compactPosts ? a.mb_2xs : a.mb_xs,
                {
                  width: REPLY_LINE_WIDTH,
                  backgroundColor: t.atoms.border_contrast_low.borderColor,
                },
              ]}
            />
          )}
        </View>
      </View>
    )
  },
)

const ThreadItemPostInner = memo(function ThreadItemPostInner({
  item,
  postShadow,
  overrides,
  hoverStyle,
  onPostSuccess,
  threadgateRecord,
}: ThreadItemPostProps & {
  postShadow: Shadow<app.bsky.feed.defs.PostView>
}) {
  const t = useTheme()
  const {openComposer} = useOpenComposer()
  const {currentAccount} = useSession()
  const compactPosts = useCompactPosts()
  const avatarSize = compactPosts ? 34 : LINEAR_AVI_WIDTH
  const horizontalPadding = compactPosts ? OUTER_SPACE - 2 : OUTER_SPACE
  const bottomPadding =
    !item.ui.showChildReplyLine && !item.ui.precedesChildReadMore
      ? compactPosts
        ? OUTER_SPACE / 3
        : OUTER_SPACE / 2
      : 0

  const post = item.value.post
  const record = item.value.post.record
  const postNumbering = item.value
  const showPostNumber = useHasThreadItemPostNumber(postNumbering)
  const moderation = item.moderation
  const richText = useMemo(
    () =>
      new RichTextAPI({
        text: record.text,
        facets: record.facets,
      }),
    [record],
  )
  const [limitLines, setLimitLines] = useState(
    () => countLines(richText?.text) >= MAX_POST_LINES,
  )
  const threadRootUri = record.reply?.root?.uri || post.uri
  const postHref = useMemo(() => {
    const urip = new AtUri(post.uri)
    return makeProfileLink(post.author, 'post', urip.rkey)
  }, [post.uri, post.author])
  const threadgateHiddenReplies = useMergedThreadgateHiddenReplies({
    threadgateRecord,
  })
  const additionalPostAlerts: AppModerationCause[] = useMemo(() => {
    const isPostHiddenByThreadgate = threadgateHiddenReplies.has(post.uri)
    const isControlledByViewer =
      new AtUri(threadRootUri).host === currentAccount?.did
    return isControlledByViewer && isPostHiddenByThreadgate
      ? [
          {
            type: 'reply-hidden',
            source: {type: 'user', did: currentAccount?.did},
            priority: 6,
          },
        ]
      : []
  }, [post, currentAccount?.did, threadgateHiddenReplies, threadRootUri])

  const onPressReply = useCallback(() => {
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: record.text,
        author: post.author,
        embed: post.embed,
        moderation,
        langs: post.record.langs,
      },
      onPostSuccess: onPostSuccess,
      logContext: 'PostReply',
    })
  }, [openComposer, post, record, onPostSuccess, moderation])

  const onPressShowMore = useCallback(() => {
    setLimitLines(false)
  }, [setLimitLines])

  const {isActive: live} = useActorStatus(post.author)

  return (
    <SubtleHoverWrapper hoverStyle={hoverStyle}>
      <ThreadItemPostOuterWrapper item={item} overrides={overrides}>
        <PostHider
          testID={`postThreadItem-by-${post.author.handle}`}
          dataSet={{
            keyboardNavigationPost: post.uri,
            keyboardNavigationHref: postHref,
            keyboardNavigationClickable: 'true',
          }}
          href={postHref}
          // Include the outer spacing in the link's click and focus area.
          style={{
            marginHorizontal: -horizontalPadding,
            paddingHorizontal: horizontalPadding,
            marginBottom: -bottomPadding,
            paddingBottom: bottomPadding,
          }}
          disabled={overrides?.moderation === true}
          modui={moderation.ui('contentList')}
          hiderStyle={[
            a.bg_transparent,
            {
              marginHorizontal: -horizontalPadding,
              paddingLeft: horizontalPadding,
              paddingRight: horizontalPadding + a.pr_2xs.paddingRight,
              marginBottom: -bottomPadding,
              paddingBottom: a.py_md.paddingBottom + bottomPadding,
            },
          ]}
          iconSize={avatarSize}
          iconStyles={[a.mr_xs]}
          profile={post.author}
          interpretFilterAsBlur>
          <ThreadItemPostParentReplyLine
            item={item}
            avatarSize={avatarSize}
            compactPosts={!!compactPosts}
          />

          <View style={[a.flex_row, compactPosts ? a.gap_sm : a.gap_md]}>
            <View>
              <PreviewableUserAvatar
                size={avatarSize}
                profile={post.author}
                moderation={moderation.ui('avatar')}
                type={post.author.associated?.labeler ? 'labeler' : 'user'}
                live={live}
              />

              {(item.ui.showChildReplyLine ||
                item.ui.precedesChildReadMore) && (
                <View
                  style={[
                    a.mx_auto,
                    compactPosts ? a.mt_2xs : a.mt_xs,
                    a.flex_1,
                    {
                      width: REPLY_LINE_WIDTH,
                      backgroundColor: t.atoms.border_contrast_low.borderColor,
                    },
                  ]}
                />
              )}
            </View>

            <View style={[a.flex_1, userStyle('wsky-post__content')]}>
              <PostMeta
                author={post.author}
                moderation={moderation}
                timestamp={post.indexedAt}
                postHref={postHref}
                style={[
                  compactPosts ? a.pb_0 : a.pb_xs,
                  maybeApplyGalleryOffsetStyles('meta', {
                    post,
                    modui: moderation.ui('contentList'),
                    additionalCauses: additionalPostAlerts,
                  }),
                ]}
              />
              <LabelsOnMyPost
                post={post}
                style={[compactPosts ? a.pb_2xs : a.pb_xs]}
              />
              <PostAlerts
                post={post}
                modui={moderation.ui('contentList')}
                style={[a.pb_2xs]}
                additionalCauses={additionalPostAlerts}
              />
              {richText?.text ? (
                <View style={[a.mb_2xs, userStyle('wsky-post__text')]}>
                  <RichText
                    enableTags
                    value={richText}
                    style={[a.flex_1, a.text_md]}
                    numberOfLines={limitLines ? MAX_POST_LINES : undefined}
                    authorHandle={post.author.handle}
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
                      <ThreadItemPostNumber
                        inline={false}
                        value={postNumbering}
                      />
                    </View>
                  )}
                </View>
              ) : (
                <ThreadItemPostNumber inline={false} value={postNumbering} />
              )}
              <TranslatedPost hideTranslateLink post={post} />
              {post.embed && (
                <View
                  style={[
                    userStyle('wsky-post__embed'),
                    maybeApplyGalleryOffsetStyles('embed', {
                      post,
                      modui: moderation.ui('contentList'),
                      additionalCauses: additionalPostAlerts,
                    }),
                    a.pb_xs,
                  ]}>
                  <Embed
                    embed={post.embed}
                    moderation={moderation}
                    viewContext={PostEmbedViewContext.Feed}
                    post={post}
                  />
                </View>
              )}
              <PostTags post={post} style={[a.pb_2xs]} />
              <PostControls
                variant={compactPosts ? 'compact' : undefined}
                post={postShadow}
                record={record}
                richText={richText}
                onPressReply={onPressReply}
                logContext="PostThreadItem"
                threadgateRecord={threadgateRecord}
              />
              <DebugFieldDisplay subject={post} />
            </View>
          </View>
        </PostHider>
      </ThreadItemPostOuterWrapper>
    </SubtleHoverWrapper>
  )
})

function SubtleHoverWrapper({
  hoverStyle,
  children,
}: {
  hoverStyle?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const {
    state: hover,
    onIn: onHoverIn,
    onOut: onHoverOut,
  } = useInteractionState()
  return (
    <View
      onPointerEnter={onHoverIn}
      onPointerLeave={onHoverOut}
      style={a.pointer}>
      <SubtleHover
        hover={hover}
        style={[hoverStyle, userStyle('wsky-post__hover')]}
      />
      {children}
    </View>
  )
}

export function ThreadItemPostSkeleton({index}: {index: number}) {
  const enableSquareAvatars = useEnableSquareAvatars()
  const even = index % 2 === 0
  return (
    <View
      style={[
        {paddingHorizontal: OUTER_SPACE, paddingVertical: OUTER_SPACE / 1.5},
        a.gap_md,
      ]}>
      <Skele.Row style={[a.align_start, a.gap_md]}>
        <Skele.Circle
          size={LINEAR_AVI_WIDTH}
          style={{borderRadius: getShapeRadius(enableSquareAvatars, 8, 999)}}
        />

        <Skele.Col style={[a.gap_xs]}>
          <Skele.Row style={[a.gap_sm]}>
            <Skele.Text style={[a.text_md, {width: '20%'}]} />
            <Skele.Text blend style={[a.text_md, {width: '30%'}]} />
          </Skele.Row>

          <Skele.Col>
            {even ? (
              <>
                <Skele.Text blend style={[a.text_md, {width: '100%'}]} />
                <Skele.Text blend style={[a.text_md, {width: '60%'}]} />
              </>
            ) : (
              <Skele.Text blend style={[a.text_md, {width: '60%'}]} />
            )}
          </Skele.Col>

          <PostControlsSkeleton />
        </Skele.Col>
      </Skele.Row>
    </View>
  )
}
