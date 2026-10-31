import {memo, useMemo} from 'react'
import {View} from 'react-native'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans} from '@lingui/react/macro'

import {userStyle} from '#/lib/userstyles'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {type OnPostSuccessData} from '#/state/shell/composer'
import {ReaderSeam} from '#/screens/PostThread/components/ReaderSeam'
import {ReaderBracket} from '#/screens/PostThread/components/ReaderSeamControls'
import {ThreadItemReadMore} from '#/screens/PostThread/components/ThreadItemReadMore'
import {
  OUTER_SPACE,
  READER_LINE_INDENT,
  READER_SEAM_HEIGHT,
} from '#/screens/PostThread/const'
import {type ReaderSegmentItem} from '#/screens/PostThread/reader'
import {atoms as a, tokens, useTheme} from '#/alf'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {GalleryBleed} from '#/components/images/Gallery'
import {LabelsOnMyPost} from '#/components/moderation/LabelsOnMe'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {TranslatedPost} from '#/components/Post/Translated'
import {useBridgedHtmlSegments} from '#/components/Post/useBridgedHtmlSegments'
import {PostTags} from '#/components/PostTags'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'

export type ThreadItemReaderSegmentProps = {
  item: ReaderSegmentItem
  sort: string
  onToggleSeam: (uri: string) => void
  onPostSuccess?: (data: OnPostSuccessData) => void
  threadgateRecord?: app.bsky.feed.threadgate.Main
}

/**
 * A continuation post in reader view. Renders the post body beside the bracket
 * gutter, with no avatar or meta row, so consecutive segments read as one
 * continuous post, followed by its seam toggle inside the same bracket.
 */
export function ThreadItemReaderSegment({
  item,
  sort,
  onToggleSeam,
  onPostSuccess,
  threadgateRecord,
}: ThreadItemReaderSegmentProps) {
  const postShadow = usePostShadow(item.item.value.post)

  if (postShadow === POST_TOMBSTONE) {
    return <ThreadItemReaderSegmentDeleted />
  }

  return (
    <ThreadItemReaderSegmentInner
      item={item}
      postShadow={postShadow}
      sort={sort}
      onToggleSeam={onToggleSeam}
      onPostSuccess={onPostSuccess}
      threadgateRecord={threadgateRecord}
    />
  )
}

function ThreadItemReaderSegmentDeleted() {
  const t = useTheme()

  return (
    <View style={[{paddingHorizontal: OUTER_SPACE}, a.py_xs]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_md,
          a.p_md,
          a.rounded_sm,
          t.atoms.bg_contrast_25,
        ]}>
        <TrashIcon style={[t.atoms.text_contrast_medium]} />
        <Text
          style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          <Trans>Post has been deleted</Trans>
        </Text>
      </View>
    </View>
  )
}

const ThreadItemReaderSegmentInner = memo(
  function ThreadItemReaderSegmentInner({
    item,
    postShadow,
    sort,
    onToggleSeam,
    onPostSuccess,
    threadgateRecord,
  }: ThreadItemReaderSegmentProps & {
    postShadow: Shadow<app.bsky.feed.defs.PostView>
  }) {
    const post = postShadow
    const seam = item.seam
    const record = item.item.value.post.record
    const moderation = item.item.moderation
    const trailingReadMore = item.trailingReadMore
    const richText = useMemo(
      () =>
        new RichTextAPI({
          text: record.text,
          facets: record.facets,
        }),
      [record],
    )
    const htmlSegments = useBridgedHtmlSegments(record)
    return (
      <View
        // @ts-expect-error web only -wsky
        dataSet={{
          wskyEmbed: post.embed ? 'true' : 'false',
          wskyReply: record.reply ? 'true' : 'false',
          wskyRepost: 'false',
        }}
        style={userStyle('wsky-post', 'wsky-post__surface')}>
        <View
          {...{
            dataSet: {
              keyboardNavigationPost: post.uri,
              keyboardNavigationHref: seam.href,
              keyboardNavigationClickable: 'false',
            },
          }}>
          <GalleryBleed>
            <View style={[{paddingHorizontal: OUTER_SPACE}]}>
              <View style={userStyle('wsky-post__content')}>
                {seam.expanded && (
                  <>
                    <LabelsOnMyPost post={post} style={[a.pb_xs]} />
                    <PostAlerts
                      modui={moderation.ui('contentList')}
                      style={[a.pb_2xs]}
                    />
                  </>
                )}
                {htmlSegments?.length || richText?.text ? (
                  <View style={[a.mb_2xs, userStyle('wsky-post__text')]}>
                    {/* Intentionally not line-limited: reader view is for
                      uninterrupted reading */}
                    <RichText
                      enableTags
                      selectable
                      value={richText}
                      htmlSegments={htmlSegments}
                      style={[a.flex_1, a.text_lg]}
                      authorHandle={post.author.handle}
                      shouldProxyLinks={true}
                    />
                  </View>
                ) : undefined}
                <TranslatedPost
                  hideTranslateLink
                  post={post}
                  postTextStyle={[a.text_lg]}
                />
                {post.embed && (
                  <View style={[a.pb_2xs, userStyle('wsky-post__embed')]}>
                    <Embed
                      embed={post.embed}
                      moderation={moderation}
                      viewContext={PostEmbedViewContext.ThreadHighlighted}
                      post={post}
                    />
                  </View>
                )}
                <PostTags post={post} style={[a.pb_2xs]} />
              </View>
            </View>
          </GalleryBleed>
          <View style={[{paddingHorizontal: OUTER_SPACE}]}>
            <ReaderSeam
              post={item.item}
              expanded={seam.expanded}
              hiddenReplyCount={seam.hiddenReplyCount}
              continuationUri={seam.continuationUri}
              href={seam.href}
              sort={sort}
              isThreadEnd={seam.isThreadEnd}
              onToggle={() => onToggleSeam(item.uri)}
              onPostSuccess={onPostSuccess}
              threadgateRecord={threadgateRecord}
            />
          </View>
        </View>
        {trailingReadMore && (
          <>
            <ThreadItemReadMore item={trailingReadMore} view="reader" />
            <View style={[a.pb_lg]} />
          </>
        )}
        {/* Bracket rendered last so it paints over the outline border.
            - Collapsed mid-chain: bottom cap at hairline
            - Collapsed thread end: hairline, accounting for the modest spacer
            - Expanded: close above the trailing spacer
            - Trailing read-more: close above the continuation button */}
        <ReaderBracket
          left={READER_LINE_INDENT}
          bottom={
            trailingReadMore
              ? READER_SEAM_HEIGHT + tokens.space.lg + READER_SEAM_HEIGHT / 2
              : seam.isThreadEnd && !seam.expanded
                ? tokens.space.sm + READER_SEAM_HEIGHT / 2
                : seam.expanded
                  ? OUTER_SPACE
                  : READER_SEAM_HEIGHT / 2
          }
        />
      </View>
    )
  },
)
