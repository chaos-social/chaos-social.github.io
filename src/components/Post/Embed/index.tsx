import {useCallback, useMemo} from 'react'
import {View} from 'react-native'
import {type $Typed} from '@atproto/lex'
import {AtUri} from '@atproto/syntax'
import {
  mergeModUIResults,
  moderatePost,
  moderateViewExternal,
} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {getEmbedCreator} from '#/lib/at-card'
import {makeProfileLink} from '#/lib/routes/links'
import {SHARP_CORNERS} from '#/lib/shapes'
import {getChatInviteCodeFromUrl} from '#/lib/strings/url-helpers'
import {useDirectFetchRecords} from '#/state/preferences/direct-fetch-records'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useDirectFetchEmbedRecord} from '#/state/queries/direct-fetch-record'
import {unstableCacheProfileView} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {Link} from '#/view/com/util/Link'
import {PostMeta} from '#/view/com/util/PostMeta'
import {
  POST_NUMBER_INLINE_OFFSET,
  ThreadItemPostNumber,
  useHasThreadItemPostNumber,
} from '#/screens/PostThread/components/ThreadItemPostNumber'
import {atoms as a, useTheme} from '#/alf'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {GalleryBleed} from '#/components/images/Gallery'
import {ContentHider} from '#/components/moderation/ContentHider'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {AtCard} from '#/components/Post/Embed/AtCard'
import {getAtCardProvider} from '#/components/Post/Embed/AtCard/providers'
import {StandardSiteEmbed} from '#/components/Post/Embed/StandardSiteEmbed'
import {isStandardSiteEmbed} from '#/components/Post/Embed/StandardSiteEmbed/utils'
import {ThemeEmbed} from '#/components/Post/Embed/ThemeEmbed'
import {isThemeEmbed} from '#/components/Post/Embed/ThemeEmbed/utils'
import {PostTags} from '#/components/PostTags'
import {RichText} from '#/components/RichText'
import {Embed as StarterPackCard} from '#/components/StarterPack/StarterPackCard'
import {SubtleHover} from '#/components/SubtleHover'
import {IS_ANDROID, IS_WEB} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {
  type Embed as TEmbed,
  type EmbedType,
  parseEmbed,
} from '#/types/bsky/post'
import {ChatInviteEmbed} from './ChatInviteEmbed'
import {ExternalEmbed} from './ExternalEmbed'
import {ModeratedFeedEmbed} from './FeedEmbed'
import {ImageEmbed} from './ImageEmbed'
import {ModeratedListEmbed} from './ListEmbed'
import {PostPlaceholder as PostPlaceholderText} from './PostPlaceholder'
import {type CommonProps, type EmbedProps, PostEmbedViewContext} from './types'
import {VideoEmbed} from './VideoEmbed'

export {PostEmbedViewContext} from './types'

export function Embed(props: EmbedProps) {
  if (IS_WEB) {
    return (
      <div data-keyboard-navigation-embed style={{display: 'contents'}}>
        <EmbedInner {...props} />
      </div>
    )
  }
  return <EmbedInner {...props} />
}

function EmbedInner({embed: rawEmbed, ...rest}: EmbedProps) {
  const embed = parseEmbed(rawEmbed)

  switch (embed.type) {
    case 'images':
    case 'gallery':
    case 'link':
    case 'video': {
      return (
        <EmbedTarget kind={embed.type === 'link' ? 'embed' : 'media'}>
          <MediaEmbed embed={embed} {...rest} />
        </EmbedTarget>
      )
    }
    case 'feed':
    case 'list':
    case 'starter_pack':
    case 'labeler':
    case 'post':
    case 'post_not_found':
    case 'post_blocked':
    case 'post_detached': {
      return (
        <EmbedTarget kind={embed.type.startsWith('post') ? 'quote' : 'embed'}>
          <RecordEmbed embed={embed} {...rest} />
        </EmbedTarget>
      )
    }
    case 'post_with_media': {
      return (
        <View
          style={[
            rest.style,
            rest.viewContext === PostEmbedViewContext.ChatMessage && a.gap_sm,
          ]}>
          <EmbedTarget kind={embed.media.type === 'link' ? 'embed' : 'media'}>
            <MediaEmbed embed={embed.media} {...rest} />
          </EmbedTarget>
          <EmbedTarget
            kind={embed.view.type.startsWith('post') ? 'quote' : 'embed'}>
            <RecordEmbed embed={embed.view} {...rest} />
          </EmbedTarget>
        </View>
      )
    }
    default: {
      return null
    }
  }
}

/** Keep each top-level attachment separate from media nested in quoted posts. */
export function EmbedTarget({
  kind,
  children,
}: {
  kind: 'media' | 'embed' | 'quote'
  children: React.ReactNode
}) {
  if (!IS_WEB) return children
  return (
    <div
      data-keyboard-navigation-embed-target={kind}
      style={{display: 'contents'}}>
      {children}
    </div>
  )
}

function MediaEmbed({
  embed,
  ...rest
}: CommonProps & {
  embed: TEmbed
}) {
  switch (embed.type) {
    case 'images':
    case 'gallery': {
      return (
        <ContentHider
          modui={rest.moderation?.ui('contentMedia')}
          activeStyle={[a.mt_sm]}>
          <ImageEmbed embed={embed} {...rest} />
        </ContentHider>
      )
    }
    case 'link': {
      if (isThemeEmbed(embed.view.external)) {
        return (
          <ContentHider
            modui={rest.moderation?.ui('contentMedia')}
            activeStyle={[a.mt_sm]}>
            <ThemeEmbed view={embed.view.external} onOpen={rest.onOpen} />
          </ContentHider>
        )
      }
      const atProvider = getAtCardProvider(embed.view.external.uri)
      if (atProvider || isStandardSiteEmbed(embed.view.external)) {
        return (
          <ExternalCardEmbed
            embed={embed}
            Card={atProvider ? AtCard : StandardSiteEmbed}
            {...rest}
          />
        )
      }
      const chatInviteCode = getChatInviteCodeFromUrl(embed.view.external.uri)
      if (chatInviteCode) {
        return (
          <ContentHider
            modui={rest.moderation?.ui('contentMedia')}
            activeStyle={[a.mt_sm]}>
            <ChatInviteEmbed
              code={chatInviteCode}
              link={embed.view.external}
              onOpen={rest.onOpen}
              style={rest.style}
            />
          </ContentHider>
        )
      }
      return (
        <ContentHider
          modui={rest.moderation?.ui('contentMedia')}
          activeStyle={[a.mt_sm]}>
          <ExternalEmbed
            link={embed.view.external}
            onOpen={rest.onOpen}
            viewContext={rest.viewContext}
            post={rest.post}
            style={[a.mt_sm, rest.style]}
          />
        </ContentHider>
      )
    }
    case 'video': {
      return (
        <ContentHider
          modui={rest.moderation?.ui('contentMedia')}
          activeStyle={[a.mt_sm]}>
          <VideoEmbed embed={embed.view} post={rest.post} />
        </ContentHider>
      )
    }
    default: {
      return null
    }
  }
}

/*
 * Renders rich external cards (AtCard, StandardSiteEmbed), respecting any
 * moderation labels attached to the `viewExternal` itself. The SDK's
 * `moderatePost` only covers post-level labels, so the external view's labels
 * produce their own decision, merged into the card's `ContentHider` alongside
 * the post-level media moderation.
 */
function ExternalCardEmbed({
  embed,
  Card,
  ...rest
}: CommonProps & {
  embed: EmbedType<'link'>
  Card: typeof AtCard | typeof StandardSiteEmbed
}) {
  const postModerationDecision = rest.moderation
  const moderationOpts = useModerationOpts()
  const external = embed.view.external

  /*
   * The card is both the "content" and the "media" of the embed, so merge
   * the two contexts: label defs with `blurs: content` act on `contentView`,
   * while defs with `blurs: media` act on `contentMedia`.
   */
  const moduis = [postModerationDecision?.ui('contentMedia')]
  if (moderationOpts && external.labels?.length) {
    const decision = moderateViewExternal(external, moderationOpts)
    moduis.push(decision.ui('contentView'), decision.ui('contentMedia'))
  }

  return (
    <ContentHider modui={mergeModUIResults(...moduis)} activeStyle={[a.mt_sm]}>
      <Card
        view={external}
        authorDid={getEmbedCreator(rest.post?.record, external.uri)}
        onEmbedInteractionCallback={rest.onOpen}
        style={[a.mt_sm, rest.style]}
      />
    </ContentHider>
  )
}

function RecordEmbed({
  embed,
  ...rest
}: CommonProps & {
  embed: TEmbed
}) {
  const {_} = useLingui()
  const directFetchEnabled = useDirectFetchRecords()
  const shouldDirectFetch =
    (embed.type === 'post_blocked' ||
      embed.type === 'post_detached' ||
      embed.type === 'post_not_found') &&
    directFetchEnabled

  const directRecord = useDirectFetchEmbedRecord({
    uri:
      embed.type === 'post_blocked' ||
      embed.type === 'post_detached' ||
      embed.type === 'post_not_found'
        ? embed.view.uri
        : '',
    enabled: shouldDirectFetch,
  })

  if (
    (embed.type === 'post' ||
      embed.type === 'post_blocked' ||
      embed.type === 'post_detached' ||
      embed.type === 'post_not_found') &&
    embed.view.uri === rest.hideRecordEmbedUri
  ) {
    return null
  }

  switch (embed.type) {
    case 'feed': {
      return (
        <View style={a.mt_sm}>
          <ModeratedFeedEmbed embed={embed} {...rest} />
        </View>
      )
    }
    case 'list': {
      return (
        <View style={a.mt_sm}>
          <ModeratedListEmbed embed={embed} />
        </View>
      )
    }
    case 'starter_pack': {
      return (
        <View style={a.mt_sm}>
          <StarterPackCard starterPack={embed.view} />
        </View>
      )
    }
    case 'labeler': {
      // not implemented
      return null
    }
    case 'post': {
      if (rest.isWithinQuote && !rest.allowNestedQuotes) {
        return null
      }

      return (
        <QuoteEmbed
          {...rest}
          embed={embed}
          viewContext={rest.viewContext}
          isWithinQuote={rest.isWithinQuote}
          allowNestedQuotes={rest.allowNestedQuotes}
        />
      )
    }
    case 'post_not_found': {
      const directFetchResult = directRecord.data
      const record = directFetchResult?.record
      if (record !== undefined) {
        return (
          <DirectFetchEmbed
            {...rest}
            embed={record}
            visibilityLabel={_(msg`Blocked`)}
          />
        )
      }

      const directFetchPending = shouldDirectFetch && directRecord.isPending

      return (
        <PostPlaceholderText directFetchEnabled={directFetchPending}>
          {directFetchResult?.unavailableReason === 'account_suspended' ? (
            <Trans>Author account suspended</Trans>
          ) : directFetchResult?.unavailableReason === 'repo_not_found' ? (
            <Trans>Author account unavailable</Trans>
          ) : (
            <Trans>Deleted</Trans>
          )}
        </PostPlaceholderText>
      )
    }
    case 'post_blocked': {
      const directFetchResult = directRecord.data
      const record = directFetchResult?.record
      if (record !== undefined) {
        return (
          <DirectFetchEmbed
            {...rest}
            embed={record}
            visibilityLabel={_(msg`Blocked`)}
          />
        )
      }

      const directFetchPending = shouldDirectFetch && directRecord.isPending

      return (
        <PostPlaceholderText directFetchEnabled={directFetchPending}>
          {directFetchResult?.unavailableReason === 'account_suspended' ? (
            <Trans>Author account suspended</Trans>
          ) : directFetchResult?.unavailableReason === 'repo_not_found' ? (
            <Trans>Author account unavailable</Trans>
          ) : shouldDirectFetch && !directFetchPending ? (
            <Trans>Post unavailable</Trans>
          ) : (
            <Trans>Blocked</Trans>
          )}
        </PostPlaceholderText>
      )
    }
    case 'post_detached': {
      const record = directRecord.data?.record
      if (record !== undefined) {
        return (
          <DirectFetchEmbed
            {...rest}
            embed={record}
            visibilityLabel={_(msg`Removed by author`)}
            visibilityLabelOwner={_(msg`Removed by you`)}
          />
        )
      }

      return (
        <PostDetachedEmbed
          embed={embed}
          directFetchEnabled={shouldDirectFetch && directRecord.isPending}
        />
      )
    }
    default: {
      return null
    }
  }
}

export function DirectFetchEmbed({
  embed,
  visibilityLabel,
  visibilityLabelOwner,
  ...rest
}: Omit<CommonProps, 'viewContext'> & {
  embed: EmbedType<'post'>
  viewContext?: PostEmbedViewContext
  visibilityLabel: string
  visibilityLabelOwner?: string
}) {
  const {currentAccount} = useSession()
  const isViewerOwner = currentAccount?.did
    ? embed.view.uri.includes(currentAccount.did)
    : false

  return (
    <View>
      <QuoteEmbed
        {...rest}
        embed={embed}
        viewContext={rest.viewContext}
        isWithinQuote={rest.isWithinQuote}
        allowNestedQuotes={rest.allowNestedQuotes}
        visibilityLabel={
          isViewerOwner && visibilityLabelOwner
            ? visibilityLabelOwner
            : visibilityLabel
        }
      />
    </View>
  )
}

export function PostDetachedEmbed({
  embed,
  directFetchEnabled,
}: {
  embed: EmbedType<'post_detached'>
  directFetchEnabled?: boolean
}) {
  const {currentAccount} = useSession()
  const isViewerOwner = currentAccount?.did
    ? embed.view.uri.includes(currentAccount.did)
    : false

  return (
    <PostPlaceholderText directFetchEnabled={directFetchEnabled}>
      {isViewerOwner ? (
        <Trans>Removed by you</Trans>
      ) : (
        <Trans>Removed by author</Trans>
      )}
    </PostPlaceholderText>
  )
}

/*
 * Nests parent `Embed` component and therefore must live in this file to avoid
 * circular imports.
 */
export function QuoteEmbed({
  embed,
  onOpen,
  style,
  linkDisabled,
  isWithinQuote: parentIsWithinQuote,
  allowNestedQuotes: parentAllowNestedQuotes,
  showPronouns,
  viewContext,
}: Omit<CommonProps, 'viewContext'> & {
  embed: EmbedType<'post'>
  viewContext?: PostEmbedViewContext
  visibilityLabel?: string
  linkDisabled?: boolean
}) {
  const shapePreference = useEnableSquareButtons()

  const moderationOpts = useModerationOpts()
  const quote = useMemo<$Typed<app.bsky.feed.defs.PostView>>(
    () => ({
      ...embed.view,
      $type: 'app.bsky.feed.defs#postView',
      record: embed.view.value,
      embed: embed.view.embeds?.[0],
    }),
    [embed],
  )
  const moderation = useMemo(() => {
    return moderationOpts ? moderatePost(quote, moderationOpts) : undefined
  }, [quote, moderationOpts])

  const t = useTheme()
  const queryClient = useQueryClient()
  const itemUrip = new AtUri(quote.uri)
  const itemHref = makeProfileLink(quote.author, 'post', itemUrip.rkey)
  const itemTitle = `Post by ${quote.author.handle}`
  const isAndroidCarousel =
    IS_ANDROID && viewContext === PostEmbedViewContext.FeedCarousel
  const postNumbering = embed.view
  const showPostNumber = useHasThreadItemPostNumber(embed.view)

  const richText = useMemo(() => {
    if (!bsky.isType(app.bsky.feed.post, quote.record)) return undefined
    const {text, facets} = quote.record
    return text.trim()
      ? new RichTextAPI({text: text, facets: facets})
      : undefined
  }, [quote.record])

  const onBeforePress = useCallback(() => {
    unstableCacheProfileView(queryClient, quote.author)
    onOpen?.()
  }, [queryClient, quote.author, onOpen])

  const {
    state: hover,
    onIn: onPointerEnter,
    onOut: onPointerLeave,
  } = useInteractionState()
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()

  const contents = (
    <ReportDialogMetadataContext.Provider key={quote.uri}>
      <PostMeta
        author={quote.author}
        moderation={moderation}
        showAvatar
        showPronouns={showPronouns}
        postHref={itemHref}
        timestamp={quote.indexedAt}
        linkDisabled
        narrowLayout={isAndroidCarousel}
        style={isAndroidCarousel ? {flex: 0} : undefined}
      />
      {moderation ? (
        <PostAlerts
          post={quote}
          modui={moderation.ui('contentView')}
          style={[a.py_xs]}
        />
      ) : null}
      {richText?.text ? (
        <RichText
          value={richText}
          style={a.text_md}
          numberOfLines={20}
          disableLinks
          suffixOffset={POST_NUMBER_INLINE_OFFSET}
          suffix={
            showPostNumber ? (
              <ThreadItemPostNumber value={postNumbering} />
            ) : undefined
          }
        />
      ) : (
        <ThreadItemPostNumber inline={false} value={postNumbering} />
      )}
      {quote.embed && (
        <Embed
          embed={quote.embed}
          moderation={moderation}
          viewContext={viewContext}
          isWithinQuote={parentIsWithinQuote ?? true}
          // already within quote? override nested
          allowNestedQuotes={
            parentIsWithinQuote ? false : parentAllowNestedQuotes
          }
          // The photo embed belongs to the quoted post, so attribute its
          // analytics to the quoted post rather than the parent.
          post={quote}
        />
      )}
      <PostTags post={quote} style={[a.pb_2xs]} />
    </ReportDialogMetadataContext.Provider>
  )

  return (
    <GalleryBleed>
      <View
        style={[viewContext !== PostEmbedViewContext.ChatMessage && a.mt_sm]}
        onPointerEnter={linkDisabled ? undefined : onPointerEnter}
        onPointerLeave={linkDisabled ? undefined : onPointerLeave}>
        <ContentHider
          modui={moderation?.ui('contentList')}
          style={[
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
            style,
            shapePreference === 'sharp' && SHARP_CORNERS,
          ]}
          activeStyle={[a.p_md, a.pt_sm]}
          childContainerStyle={[a.pt_sm]}>
          {({active}) => (
            <>
              {!active && !linkDisabled && (
                <SubtleHover
                  native
                  hover={hover || pressed}
                  style={[
                    a.rounded_md,
                    shapePreference === 'sharp' && SHARP_CORNERS,
                  ]}
                />
              )}
              {linkDisabled ? (
                <View style={[!active && a.p_md]} pointerEvents="none">
                  {contents}
                </View>
              ) : (
                <Link
                  testID="quotedPostOpenBtn"
                  style={[!active && a.p_md]}
                  hoverStyle={t.atoms.border_contrast_high}
                  href={itemHref}
                  title={itemTitle}
                  onBeforePress={onBeforePress}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}>
                  {contents}
                </Link>
              )}
            </>
          )}
        </ContentHider>
      </View>
    </GalleryBleed>
  )
}
