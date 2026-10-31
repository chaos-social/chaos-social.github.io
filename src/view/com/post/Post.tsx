import {useCallback, useMemo, useState} from 'react'
import {type StyleProp, StyleSheet, View, type ViewStyle} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {moderatePost, type ModerationDecision} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {useQueryClient} from '@tanstack/react-query'

import {MAX_POST_LINES} from '#/lib/constants'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {makeProfileLink} from '#/lib/routes/links'
import {segmentsToText} from '#/lib/strings/bridged-html'
import {countLines} from '#/lib/strings/helpers'
import {userStyle} from '#/lib/userstyles'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useCompactPosts} from '#/state/preferences/compact-posts'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {unstableCacheProfileView} from '#/state/queries/profile'
import {Link} from '#/view/com/util/Link'
import {PostMeta} from '#/view/com/util/PostMeta'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, select, useTheme} from '#/alf'
import {
  GalleryBleed,
  maybeApplyGalleryOffsetStyles,
} from '#/components/images/Gallery'
import {ContentHider} from '#/components/moderation/ContentHider'
import {LabelsOnMyPost} from '#/components/moderation/LabelsOnMe'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {PostRepliedTo} from '#/components/Post/PostRepliedTo'
import {ShowMoreTextButton} from '#/components/Post/ShowMoreTextButton'
import {TranslatedPost} from '#/components/Post/Translated'
import {useBridgedHtmlSegments} from '#/components/Post/useBridgedHtmlSegments'
import {PostControls} from '#/components/PostControls'
import {PostTags} from '#/components/PostTags'
import {RichText} from '#/components/RichText'
import {SubtleHover} from '#/components/SubtleHover'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {AviFollowButton} from '../posts/AviFollowButton'

export function Post({
  post,
  showReplyLine,
  hideTopBorder,
  hideQuoteEmbedUri,
  style,
  onBeforePress,
}: {
  post: app.bsky.feed.defs.PostView
  showReplyLine?: boolean
  hideTopBorder?: boolean
  hideQuoteEmbedUri?: string
  style?: StyleProp<ViewStyle>
  onBeforePress?: () => void
}) {
  const moderationOpts = useModerationOpts()
  const record = useMemo<app.bsky.feed.post.Main | undefined>(
    () =>
      bsky.matches(app.bsky.feed.post, post.record) ? post.record : undefined,
    [post],
  )
  const postShadowed = usePostShadow(post)
  const richText = useMemo(
    () =>
      record
        ? new RichTextAPI({
            text: record.text,
            facets: record.facets,
          })
        : undefined,
    [record],
  )
  const moderation = useMemo(
    () => (moderationOpts ? moderatePost(post, moderationOpts) : undefined),
    [moderationOpts, post],
  )
  if (postShadowed === POST_TOMBSTONE) {
    return null
  }
  if (record && richText && moderation) {
    return (
      <ReportDialogMetadataContext.Provider key={postShadowed.uri}>
        <PostInner
          post={postShadowed}
          record={record}
          richText={richText}
          moderation={moderation}
          showReplyLine={showReplyLine}
          hideTopBorder={hideTopBorder}
          hideQuoteEmbedUri={hideQuoteEmbedUri}
          style={style}
          onBeforePress={onBeforePress}
        />
      </ReportDialogMetadataContext.Provider>
    )
  }
  return null
}

function PostInner({
  post,
  record,
  richText,
  moderation,
  showReplyLine,
  hideTopBorder,
  hideQuoteEmbedUri,
  style,
  onBeforePress: outerOnBeforePress,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  record: app.bsky.feed.post.Main
  richText: RichTextAPI
  moderation: ModerationDecision
  showReplyLine?: boolean
  hideTopBorder?: boolean
  hideQuoteEmbedUri?: string
  style?: StyleProp<ViewStyle>
  onBeforePress?: () => void
}) {
  const queryClient = useQueryClient()
  const t = useTheme()
  const {openComposer} = useOpenComposer()
  const compactPosts = useCompactPosts()
  const htmlSegments = useBridgedHtmlSegments(post.record)
  const [limitLines, setLimitLines] = useState(
    () =>
      countLines(
        htmlSegments ? segmentsToText(htmlSegments) : richText?.text,
      ) >= MAX_POST_LINES,
  )
  const itemUrip = new AtUri(post.uri)
  const itemHref = makeProfileLink(post.author, 'post', itemUrip.rkey)
  let replyAuthorDid = ''
  if (record.reply) {
    const urip = new AtUri(record.reply.parent?.uri || record.reply.root.uri)
    replyAuthorDid = urip.hostname
  }

  const onPressReply = useCallback(() => {
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: record.text,
        author: post.author,
        embed: post.embed,
        moderation,
        langs: record.langs,
      },
      logContext: 'PostReply',
    })
  }, [openComposer, post, record, moderation])

  const onPressShowMore = useCallback(() => {
    setLimitLines(false)
  }, [setLimitLines])

  const onBeforePress = useCallback(() => {
    unstableCacheProfileView(queryClient, post.author)
    outerOnBeforePress?.()
  }, [queryClient, post.author, outerOnBeforePress])

  const [hover, setHover] = useState(false)

  return (
    <GalleryBleed>
      <Link
        href={itemHref}
        dataSet={{
          keyboardNavigationPost: post.uri,
          keyboardNavigationHref: itemHref,
          keyboardNavigationClickable: 'true',
          wskyEmbed: post.embed ? 'true' : 'false',
          wskyReply: record.reply ? 'true' : 'false',
          wskyRepost: 'false',
        }}
        style={[
          userStyle('wsky-post', 'wsky-post__surface'),
          styles.outer,
          t.atoms.border_contrast_low,
          !hideTopBorder && a.border_t,
          compactPosts && styles.outerCompact,
          style,
        ]}
        onBeforePress={onBeforePress}
        onPointerEnter={() => {
          setHover(true)
        }}
        onPointerLeave={() => {
          setHover(false)
        }}>
        <SubtleHover hover={hover} style={userStyle('wsky-post__hover')} />
        {showReplyLine && (
          <View
            style={[
              styles.replyLine,
              {
                backgroundColor: select(t.name, {
                  light: t.palette.contrast_100,
                  dim: t.palette.contrast_200,
                  dark: t.palette.contrast_200,
                }),
              },
            ]}
          />
        )}
        <View style={styles.layout}>
          <View style={styles.layoutAvi}>
            <AviFollowButton author={post.author} moderation={moderation}>
              <PreviewableUserAvatar
                size={compactPosts ? 34 : 42}
                profile={post.author}
                moderation={moderation.ui('avatar')}
                type={post.author.associated?.labeler ? 'labeler' : 'user'}
              />
            </AviFollowButton>
          </View>
          <View
            style={[
              styles.layoutContent,
              maybeApplyGalleryOffsetStyles('meta', {
                post,
                modui: moderation.ui('contentList'),
                additionalCauses: [],
              }),
            ]}>
            <PostMeta
              author={post.author}
              moderation={moderation}
              timestamp={post.indexedAt}
              postHref={itemHref}
            />
            {replyAuthorDid !== '' && (
              <PostRepliedTo parentAuthor={replyAuthorDid} />
            )}
            <LabelsOnMyPost post={post} />
            <ContentHider
              modui={moderation.ui('contentList')}
              style={[styles.contentHider, userStyle('wsky-post__content')]}
              childContainerStyle={styles.contentHiderChild}>
              <PostAlerts
                post={post}
                modui={moderation.ui('contentList')}
                style={[a.pb_xs]}
              />
              {htmlSegments?.length || richText.text ? (
                <View style={[a.mb_2xs, userStyle('wsky-post__text')]}>
                  <RichText
                    enableTags
                    testID="postText"
                    value={richText}
                    htmlSegments={htmlSegments}
                    numberOfLines={limitLines ? MAX_POST_LINES : undefined}
                    style={[a.flex_1, a.text_md]}
                    authorHandle={post.author.handle}
                    shouldProxyLinks={true}
                  />
                  {limitLines && (
                    <ShowMoreTextButton
                      style={[a.text_md]}
                      onPress={onPressShowMore}
                    />
                  )}
                </View>
              ) : undefined}
              <TranslatedPost hideTranslateLink post={post} />
              {post.embed ? (
                <View
                  style={[
                    userStyle('wsky-post__embed'),
                    maybeApplyGalleryOffsetStyles('embed', {
                      post,
                      modui: moderation.ui('contentList'),
                      additionalCauses: [],
                    }),
                  ]}>
                  <Embed
                    embed={post.embed}
                    moderation={moderation}
                    viewContext={PostEmbedViewContext.Feed}
                    post={post}
                    hideRecordEmbedUri={hideQuoteEmbedUri}
                  />
                </View>
              ) : null}
              <PostTags post={post} style={[a.pb_2xs]} />
            </ContentHider>
            <PostControls
              variant={compactPosts ? 'compact' : undefined}
              post={post}
              record={record}
              richText={richText}
              onPressReply={onPressReply}
              logContext="Post"
            />
          </View>
        </View>
      </Link>
    </GalleryBleed>
  )
}

const styles = StyleSheet.create({
  outer: {
    paddingTop: 10,
    paddingRight: 15,
    paddingBottom: 5,
    paddingLeft: 10,
    cursor: 'pointer',
  },
  outerCompact: {
    paddingTop: 6,
    paddingBottom: 3,
  },
  layout: {
    flexDirection: 'row',
    gap: 10,
  },
  layoutAvi: {
    paddingLeft: 8,
  },
  layoutContent: {
    flex: 1,
  },
  alert: {
    marginBottom: 6,
  },
  replyLine: {
    position: 'absolute',
    left: 36,
    top: 70,
    bottom: 0,
    borderLeftWidth: 2,
  },
  contentHider: {
    marginBottom: 2,
  },
  contentHiderChild: {
    marginTop: 6,
  },
})
