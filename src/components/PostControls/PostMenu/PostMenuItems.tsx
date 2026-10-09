import {memo, useMemo} from 'react'
import {
  Platform,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import {
  type AppBskyEmbedExternal,
  AppBskyEmbedRecord,
  type AppBskyEmbedRecordWithMedia,
  type AppBskyEmbedVideo,
  AppBskyFeedPost,
  isDid,
} from '@atproto/api'
import {AtUri} from '@atproto/syntax'
import {type RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {DISCOVER_DEBUG_DIDS} from '#/lib/constants'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {getPostMediaDownloadName} from '#/lib/media/downloadFilename'
import {saveVideoToDevice} from '#/lib/media/saveVideoToDevice'
import {getRedraftImages} from '#/lib/redraft'
import {getCurrentRoute} from '#/lib/routes/helpers'
import {makeProfileLink} from '#/lib/routes/links'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {richTextToRedraftString} from '#/lib/strings/rich-text-helpers'
import {toShareUrl} from '#/lib/strings/url-helpers'
import {useTranslate} from '#/lib/translation'
import {getPostLanguageTags} from '#/locale/helpers'
import {logger} from '#/logger'
import {type Shadow} from '#/state/cache/post-shadow'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {completeRedraftedPost} from '#/state/cache/replace-redrafted-post'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {
  useHiddenPosts,
  useHiddenPostsApi,
  useLanguagePrefs,
} from '#/state/preferences'
import {usePinnedPostMutation} from '#/state/queries/pinned-post'
import {
  useGetPost,
  usePostDeleteMutation,
  useThreadMuteMutationQueue,
} from '#/state/queries/post'
import {useToggleQuoteDetachmentMutation} from '#/state/queries/postgate'
import {getMaybeDetachedQuoteEmbed} from '#/state/queries/postgate/util'
import {
  useProfileBlockMutationQueue,
  useProfileMuteMutationQueue,
} from '#/state/queries/profile'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {
  InvalidInteractionSettingsError,
  MAX_HIDDEN_REPLIES,
  MaxHiddenRepliesError,
  useToggleReplyVisibilityMutation,
} from '#/state/queries/threadgate'
import {useRequireAuth, useSession} from '#/state/session'
import {
  type ComposerOpts,
  type ComposerOptsPostRef,
} from '#/state/shell/composer'
import {useMergedThreadgateHiddenReplies} from '#/state/threadgate-hidden-replies'
import {useDialogControl} from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import {
  PostInteractionSettingsDialog,
  usePrefetchPostInteractionSettings,
} from '#/components/dialogs/PostInteractionSettingsDialog'
import {Atom_Stroke2_Corner0_Rounded as AtomIcon} from '#/components/icons/Atom'
import {BubbleQuestion_Stroke2_Corner0_Rounded as Translate} from '#/components/icons/Bubble'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {Download_Stroke2_Corner0_Rounded as Download} from '#/components/icons/Download'
import {
  EmojiSad_Stroke2_Corner0_Rounded as EmojiSad,
  EmojiSmile_Stroke2_Corner0_Rounded as EmojiSmile,
} from '#/components/icons/Emoji'
import {Eye_Stroke2_Corner0_Rounded as Eye} from '#/components/icons/Eye'
import {EyeSlash_Stroke2_Corner0_Rounded as EyeSlash} from '#/components/icons/EyeSlash'
import {Filter_Stroke2_Corner0_Rounded as Filter} from '#/components/icons/Filter'
import {
  Mute_Stroke2_Corner0_Rounded as Mute,
  Mute_Stroke2_Corner0_Rounded as MuteIcon,
} from '#/components/icons/Mute'
import {Pencil_Stroke2_Corner0_Rounded as Pen} from '#/components/icons/Pencil'
import {PersonX_Stroke2_Corner0_Rounded as PersonX} from '#/components/icons/Person'
import {Pin_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/Pin'
import {SettingsGear2_Stroke2_Corner0_Rounded as Gear} from '#/components/icons/SettingsGear2'
import {
  SpeakerVolumeFull_Stroke2_Corner0_Rounded as Unmute,
  SpeakerVolumeFull_Stroke2_Corner0_Rounded as UnmuteIcon,
} from '#/components/icons/Speaker'
import {Trash_Stroke2_Corner0_Rounded as Trash} from '#/components/icons/Trash'
import {Warning_Stroke2_Corner0_Rounded as Warning} from '#/components/icons/Warning'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import {BlockDialog} from '#/components/moderation/BlockDialog'
import {
  ReportDialog,
  useReportDialogControl,
} from '#/components/moderation/ReportDialog'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {useAnalytics} from '#/analytics'
import {IS_INTERNAL} from '#/env'
import {IS_NATIVE} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

let PostMenuItems = ({
  post,
  postFeedContext,
  postReqId,
  record,
  richText,
  threadgateRecord,
  onShowLess,
  logContext,
  forceGoogleTranslate,
}: {
  testID: string
  post: Shadow<app.bsky.feed.defs.PostView>
  postFeedContext: string | undefined
  postReqId: string | undefined
  record: app.bsky.feed.post.Main
  richText: RichTextAPI
  style?: StyleProp<ViewStyle>
  hitSlop?: PressableProps['hitSlop']
  size?: 'lg' | 'md' | 'sm'
  timestamp: string
  threadgateRecord?: app.bsky.feed.threadgate.Main
  onShowLess?: (interaction: app.bsky.feed.defs.Interaction) => void
  logContext: 'FeedItem' | 'PostThreadItem' | 'Post' | 'ImmersiveVideo'
  forceGoogleTranslate: boolean
}): React.ReactNode => {
  const {hasSession, currentAccount} = useSession()
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const langPrefs = useLanguagePrefs()
  const {mutateAsync: deletePostMutate} = usePostDeleteMutation()
  const {mutateAsync: pinPostMutate, isPending: isPinPending} =
    usePinnedPostMutation()
  const requireSignIn = useRequireAuth()
  const hiddenPosts = useHiddenPosts()
  const {hidePost} = useHiddenPostsApi()
  const feedFeedback = useFeedFeedbackContext()
  const openLink = useOpenLink()
  const {clearTranslation, translate, translationState} = useTranslate({
    key: post.uri,
    forceGoogleTranslate,
  })
  const navigation = useNavigation<NavigationProp>()
  const {mutedWordsDialogControl} = useGlobalDialogsControlContext()
  const blockPromptControl = useDialogControl()
  const reportDialogControl = useReportDialogControl()
  const deletePromptControl = useDialogControl()
  const hidePromptControl = useDialogControl()
  const postInteractionSettingsDialogControl = useDialogControl()
  const quotePostDetachConfirmControl = useDialogControl()
  const hideReplyConfirmControl = useDialogControl()
  const redraftPromptControl = useDialogControl()
  const {mutateAsync: toggleReplyVisibility} =
    useToggleReplyVisibilityMutation()

  const postUri = post.uri
  const postCid = post.cid
  const postAuthor = useProfileShadow(post.author)
  const quoteEmbed = useMemo(() => {
    if (!currentAccount || !post.embed) return
    return getMaybeDetachedQuoteEmbed({
      viewerDid: currentAccount.did,
      post,
    })
  }, [post, currentAccount])

  const rootUri = record.reply?.root?.uri || postUri
  const isReply = Boolean(record.reply)
  const [isThreadMuted, muteThread, unmuteThread] = useThreadMuteMutationQueue(
    post,
    rootUri,
  )
  const isPostHidden = hiddenPosts && hiddenPosts.includes(postUri)
  const isAuthor = postAuthor.did === currentAccount?.did
  const isRootPostAuthor = new AtUri(rootUri).host === currentAccount?.did
  const threadgateHiddenReplies = useMergedThreadgateHiddenReplies({
    threadgateRecord,
  })
  const isReplyHiddenByThreadgate = threadgateHiddenReplies.has(postUri)
  const isPinned = post.viewer?.pinned

  const {mutateAsync: toggleQuoteDetachment, isPending: isDetachPending} =
    useToggleQuoteDetachmentMutation()

  const [queueBlock] = useProfileBlockMutationQueue(postAuthor)
  const [queueMute, queueUnmute] = useProfileMuteMutationQueue(postAuthor)

  const prefetchPostInteractionSettings = usePrefetchPostInteractionSettings({
    postUri: post.uri,
    rootPostUri: rootUri,
  })

  const href = useMemo(() => {
    const urip = new AtUri(postUri)
    return makeProfileLink(postAuthor, 'post', urip.rkey)
  }, [postUri, postAuthor])

  const queryClient = useQueryClient()

  const onDeletePost = () => {
    deletePostMutate({uri: postUri}).then(
      () => {
        Toast.show(l({message: 'Post deleted', context: 'toast'}))

        const route = getCurrentRoute(navigation.getState())
        if (route.name === 'PostThread') {
          const params = route.params as CommonNavigatorParams['PostThread']
          if (
            currentAccount &&
            isAuthor &&
            (params.name === currentAccount.handle ||
              params.name === currentAccount.did)
          ) {
            const currentHref = makeProfileLink(postAuthor, 'post', params.rkey)
            if (currentHref === href && navigation.canGoBack()) {
              navigation.goBack()
            }
          }
        }
      },
      e => {
        logger.error('Failed to delete post', {message: e})
        Toast.show(l`Failed to delete post, please try again`, {
          type: 'error',
        })
      },
    )
  }

  const {openComposer} = useOpenComposer()
  const getPost = useGetPost()
  const onRedraftPost = () => {
    redraftPromptControl.open()
  }

  const onConfirmRedraft = async () => {
    const recordEmbed = record.embed
    let imageUris: ComposerOpts['imageUris']
    try {
      imageUris = await getRedraftImages(
        recordEmbed,
        post.embed,
        post.author.did,
      )
    } catch (error) {
      logger.error('Failed to restore redraft images', {safeMessage: error})
      Toast.show(l`Could not load images. Please try redrafting again.`, {
        type: 'error',
      })
      return
    }

    let quotePost: app.bsky.feed.defs.PostView | undefined

    if (post.embed?.$type === 'app.bsky.embed.record#view') {
      const embed = post.embed as AppBskyEmbedRecord.View
      if (
        AppBskyEmbedRecord.isViewRecord(embed.record) &&
        AppBskyFeedPost.isRecord(embed.record.value)
      ) {
        quotePost = {
          uri: embed.record.uri,
          cid: embed.record.cid,
          author: embed.record.author,
          record: embed.record.value,
          indexedAt: embed.record.indexedAt,
          embed: embed.record.embeds?.[0],
        } as app.bsky.feed.defs.PostView
      }
    } else if (post.embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
      const embed = post.embed as AppBskyEmbedRecordWithMedia.View
      if (
        AppBskyEmbedRecord.isViewRecord(embed.record.record) &&
        AppBskyFeedPost.isRecord(embed.record.record.value)
      ) {
        const quoted = embed.record.record
        quotePost = {
          uri: quoted.uri,
          cid: quoted.cid,
          author: quoted.author,
          record: quoted.value,
          indexedAt: quoted.indexedAt,
          embed: quoted.embeds?.[0],
        } as app.bsky.feed.defs.PostView
      }
    }

    let replyTo: ComposerOptsPostRef | undefined
    if (record.reply) {
      const parentRef = record.reply.parent || record.reply.root
      if (parentRef?.uri) {
        try {
          const parentPost = await getPost({uri: parentRef.uri})
          if (bsky.isType(app.bsky.feed.post.main, parentPost.record)) {
            replyTo = {
              uri: parentPost.uri,
              cid: parentPost.cid,
              text: parentPost.record.text || '',
              author: parentPost.author,
              embed: parentPost.embed,
              langs: parentPost.record.langs,
            }
          }
        } catch (e) {
          logger.warn('Failed to fetch parent post for redraft', {message: e})
        }
      }
    }

    let videoUri: ComposerOpts['videoUri']
    let recordVideo: AppBskyEmbedVideo.Main | undefined

    if (recordEmbed?.$type === 'app.bsky.embed.video') {
      recordVideo = recordEmbed as unknown as AppBskyEmbedVideo.Main
    } else if (recordEmbed?.$type === 'app.bsky.embed.recordWithMedia') {
      const media = (recordEmbed as AppBskyEmbedRecordWithMedia.Main).media
      if (media.$type === 'app.bsky.embed.video') {
        recordVideo = media as AppBskyEmbedVideo.Main
      }
    }

    if (post.embed?.$type === 'app.bsky.embed.video#view') {
      const embed = post.embed as AppBskyEmbedVideo.View
      if (recordVideo) {
        videoUri = {
          uri: embed.playlist || '',
          width: embed.aspectRatio?.width ?? 1000,
          height: embed.aspectRatio?.height ?? 1000,
          blobRef: recordVideo.video,
          altText: embed.alt || '',
        }
      }
    } else if (post.embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
      const embed = post.embed as AppBskyEmbedRecordWithMedia.View
      if (embed.media.$type === 'app.bsky.embed.video#view' && recordVideo) {
        const video = embed.media as AppBskyEmbedVideo.View
        videoUri = {
          uri: video.playlist || '',
          width: video.aspectRatio?.width ?? 1000,
          height: video.aspectRatio?.height ?? 1000,
          blobRef: recordVideo.video,
          altText: video.alt || '',
        }
      }
    }

    if (videoUri && recordVideo) {
      videoUri.ownerDid = post.author.did
      if (IS_NATIVE) {
        videoUri.originalCaptions =
          recordVideo.captions as unknown as app.bsky.embed.video.Caption[]
      } else if (recordVideo.captions?.length) {
        try {
          const pdsUrl = await resolvePdsServiceUrl(post.author.did)
          videoUri.captions = await Promise.all(
            (recordVideo.captions ?? []).map(async caption => {
              const uri = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
              uri.searchParams.set('did', post.author.did)
              uri.searchParams.set('cid', caption.file.ref.toString())
              const response = await fetch(uri)
              if (!response.ok) throw new Error('Could not load caption file')
              return {
                lang: caption.lang,
                file: new File(
                  [await response.blob()],
                  `caption-${caption.lang}.vtt`,
                  {type: 'text/vtt'},
                ),
              }
            }),
          )
        } catch (error) {
          logger.error('Failed to restore video captions', {safeMessage: error})
          Toast.show(
            l`Could not load video captions. Please try redrafting again.`,
            {type: 'error'},
          )
          return
        }
      }
    }

    openComposer({
      text: richTextToRedraftString(richText),
      tags: record.tags,
      imageUris,
      videoUri,
      onPost: (newUri, data) => {
        if (!newUri) return
        void (async () => {
          try {
            const published = data?.posts.find(item => item.uri === newUri)
            await completeRedraftedPost({
              queryClient,
              uri: postUri,
              replacement: bsky.isType(
                app.bsky.unspecced.defs.threadItemPost,
                published?.value,
              )
                ? published.value.post
                : undefined,
              getPost: () => getPost({uri: newUri}),
              deletePost: () => deletePostMutate({uri: postUri}),
            })
            const route = getCurrentRoute(navigation.getState())
            if (route.name === 'PostThread') {
              const params = route.params as CommonNavigatorParams['PostThread']
              if (
                (params.name === postAuthor.did ||
                  params.name === postAuthor.handle) &&
                makeProfileLink(postAuthor, 'post', params.rkey) === href
              ) {
                const {host, rkey} = new AtUri(newUri)
                navigation.replace('PostThread', {name: host, rkey})
              }
            }
          } catch (error) {
            logger.error('Failed to replace redrafted post', {
              safeMessage: error,
            })
            Toast.show(
              l`Your new post was published, but the original could not be replaced.`,
              {
                type: 'error',
              },
            )
          }
        })()
      },
      quote: quotePost,
      replyTo,
    })
  }

  const onToggleThreadMute = () => {
    try {
      if (isThreadMuted) {
        void unmuteThread()
        ax.metric('post:unmute', {
          uri: postUri,
          authorDid: postAuthor.did,
          logContext,
          feedDescriptor: feedFeedback.feedDescriptor,
        })
        Toast.show(l`You will now receive notifications for this thread`)
      } else {
        void muteThread()
        ax.metric('post:mute', {
          uri: postUri,
          authorDid: postAuthor.did,
          logContext,
          feedDescriptor: feedFeedback.feedDescriptor,
        })
        Toast.show(l`You will no longer receive notifications for this thread`)
      }
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        logger.error('Failed to toggle thread mute', {message: e})
        Toast.show(l`Failed to toggle thread mute, please try again`, {
          type: 'error',
        })
      }
    }
  }

  const onToggleWordsAndTagsMute = () => {
    ax.metric('postMenu:openMuteWordsDialog', {
      uri: postUri,
      authorDid: postAuthor.did,
      logContext,
      feedDescriptor: feedFeedback.feedDescriptor,
    })
    mutedWordsDialogControl.open()
  }

  const onCopyPostText = () => {
    const str = richTextToRedraftString(richText)

    void Clipboard.setStringAsync(str)
    Toast.show(l`Copied to clipboard`, {
      type: 'success',
    })
  }

  const onPressTranslate = () => {
    void translate({
      text: record.text,
      expectedTargetLanguage: langPrefs.primaryLanguage,
      possibleSourceLanguages: getPostLanguageTags(post),
    })
  }

  const onHidePost = () => {
    hidePost({uri: postUri})
    ax.metric('thread:click:hideReplyForMe', {})
  }

  const hideInPWI = !!postAuthor.labels?.find(
    label => label.val === '!no-unauthenticated',
  )

  const onPressShowMore = () => {
    feedFeedback.sendInteraction({
      event: 'app.bsky.feed.defs#requestMore',
      item: postUri,
      feedContext: postFeedContext,
      reqId: postReqId,
    })
    ax.metric('post:showMore', {
      uri: postUri,
      authorDid: postAuthor.did,
      logContext,
      feedDescriptor: feedFeedback.feedDescriptor,
    })
    Toast.show(l({message: 'Feedback sent to feed operator', context: 'toast'}))
  }

  const onPressShowLess = () => {
    feedFeedback.sendInteraction({
      event: 'app.bsky.feed.defs#requestLess',
      item: postUri,
      feedContext: postFeedContext,
      reqId: postReqId,
    })
    ax.metric('post:showLess', {
      uri: postUri,
      authorDid: postAuthor.did,
      logContext,
      feedDescriptor: feedFeedback.feedDescriptor,
    })
    if (onShowLess) {
      onShowLess({
        item: postUri,
        feedContext: postFeedContext,
      })
    } else {
      Toast.show(
        l({message: 'Feedback sent to feed operator', context: 'toast'}),
      )
    }
  }

  const onToggleQuotePostAttachment = async () => {
    if (!quoteEmbed) return

    const action = quoteEmbed.isDetached ? 'reattach' : 'detach'
    const isDetach = action === 'detach'

    try {
      await toggleQuoteDetachment({
        post,
        quoteUri: quoteEmbed.uri,
        action: quoteEmbed.isDetached ? 'reattach' : 'detach',
      })
      Toast.show(
        isDetach
          ? l`Quote post was successfully detached`
          : l`Quote post was re-attached`,
      )
    } catch (err) {
      const e = err as Error
      Toast.show(
        l({message: 'Updating quote attachment failed', context: 'toast'}),
      )
      logger.error(`Failed to ${action} quote`, {safeMessage: e.message})
    }
  }

  const canHidePostForMe = !isAuthor && !isPostHidden
  const canHideReplyForEveryone =
    !isAuthor && isRootPostAuthor && !isPostHidden && isReply
  const canDetachQuote = quoteEmbed && quoteEmbed.isOwnedByViewer

  const onToggleReplyVisibility = async () => {
    // TODO no threadgate?
    if (!canHideReplyForEveryone) return

    const action = isReplyHiddenByThreadgate ? 'show' : 'hide'
    const isHide = action === 'hide'

    try {
      await toggleReplyVisibility({
        postUri: rootUri,
        replyUri: postUri,
        action,
      })

      // Log metric only when hiding (not when showing)
      if (isHide) {
        ax.metric('thread:click:hideReplyForEveryone', {})
      }

      Toast.show(
        isHide
          ? l`Reply was successfully hidden`
          : l({message: 'Reply visibility updated', context: 'toast'}),
      )
    } catch (err) {
      const e = err as Error
      if (e instanceof MaxHiddenRepliesError) {
        Toast.show(
          plural(MAX_HIDDEN_REPLIES, {
            other: 'You can hide a maximum of # replies.',
          }),
        )
      } else if (e instanceof InvalidInteractionSettingsError) {
        Toast.show(
          l({message: 'Invalid interaction settings.', context: 'toast'}),
        )
      } else {
        Toast.show(
          l({
            message: 'Updating reply visibility failed',
            context: 'toast',
          }),
        )
        logger.error(`Failed to ${action} reply`, {safeMessage: e.message})
      }
    }
  }

  const onPressPin = () => {
    ax.metric(isPinned ? 'post:unpin' : 'post:pin', {})
    void pinPostMutate({
      postUri,
      postCid,
      action: isPinned ? 'unpin' : 'pin',
    })
  }

  const videoEmbed: AppBskyEmbedVideo.View | undefined = useMemo(() => {
    if (post.embed?.$type === 'app.bsky.embed.video#view')
      return post.embed as AppBskyEmbedVideo.View
    if (post.embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
      const embed = post.embed as AppBskyEmbedRecordWithMedia.View | undefined
      if (embed?.media.$type === 'app.bsky.embed.video#view')
        return embed?.media as AppBskyEmbedVideo.View
    }
    return undefined
  }, [post])

  const gifEmbed: AppBskyEmbedExternal.View | undefined = useMemo(() => {
    if (post.embed?.$type === 'app.bsky.embed.external#view')
      return post.embed as AppBskyEmbedExternal.View
    if (post.embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
      const embed = post.embed as AppBskyEmbedRecordWithMedia.View | undefined
      if (embed?.media.$type === 'app.bsky.embed.external#view')
        return embed?.media as AppBskyEmbedExternal.View
    }
    return undefined
  }, [post])

  const onPressDownloadVideo = async () => {
    if (!videoEmbed) return
    const did = post.author.did
    const cid = videoEmbed.cid
    if (!isDid(did)) return
    const pdsUrl = await resolvePdsServiceUrl(did)
    const uri = `${pdsUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`

    Toast.show(l({message: 'Downloading video...', context: 'toast'}))

    const success = await saveVideoToDevice({
      uri,
      downloadName: getPostMediaDownloadName(post),
    })

    Toast.show(
      success
        ? l({message: 'Video downloaded', context: 'toast'})
        : l({message: 'Failed to download video', context: 'toast'}),
      {type: success ? 'success' : 'error'},
    )
  }

  const onPressDownloadGif = async () => {
    if (!gifEmbed) return

    Toast.show(l({message: 'Downloading GIF...', context: 'toast'}))

    let success
    success = await saveVideoToDevice({
      uri: gifEmbed.external.uri,
      downloadName: getPostMediaDownloadName(post),
    })

    if (success)
      Toast.show(l({message: 'GIF downloaded', context: 'toast'}), {
        type: 'success',
      })
    else
      Toast.show(l({message: 'Failed to download GIF', context: 'toast'}), {
        type: 'error',
      })
  }

  const isEmbedGif = () => {
    if (!gifEmbed) return false
    // Janky workaround by checking if the domain is tenor.com
    const url = new URL(gifEmbed.external.uri)
    return url.host === 'media.tenor.com'
  }

  const onBlockAuthor = async () => {
    try {
      await queueBlock()
      Toast.show(l({message: 'Account blocked', context: 'toast'}))
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        logger.error('Failed to block account', {message: e})
        Toast.show(l`There was an issue! ${e.toString()}`, {
          type: 'error',
        })
      }
    }
    ax.metric('postMenu:blockAccount', {
      uri: postUri,
      authorDid: postAuthor.did,
      logContext,
      feedDescriptor: feedFeedback.feedDescriptor,
    })
  }

  const onMuteAuthor = async () => {
    if (postAuthor.viewer?.muted) {
      try {
        await queueUnmute()
        Toast.show(l({message: 'Account unmuted', context: 'toast'}))
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          logger.error('Failed to unmute account', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
      ax.metric('postMenu:unmuteAccount', {
        uri: postUri,
        authorDid: postAuthor.did,
        logContext,
        feedDescriptor: feedFeedback.feedDescriptor,
      })
    } else {
      try {
        await queueMute()
        Toast.show(l({message: 'Account muted', context: 'toast'}))
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          logger.error('Failed to mute account', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
      ax.metric('postMenu:muteAccount', {
        uri: postUri,
        authorDid: postAuthor.did,
        logContext,
        feedDescriptor: feedFeedback.feedDescriptor,
      })
    }
  }

  const onReportMisclassification = () => {
    const url = `https://docs.google.com/forms/d/e/1FAIpQLSd0QPqhNFksDQf1YyOos7r1ofCLvmrKAH1lU042TaS3GAZaWQ/viewform?entry.1756031717=${toShareUrl(
      href,
    )}`
    void openLink(url)
  }

  const onLabelReply = () => {
    const url = `https://docs.google.com/forms/d/e/1FAIpQLScWa03XbS_knVbSjnc4DENACN5A2YvBZjtjrpI1XdDbK7d3Ow/viewform?entry.1843100496=${toShareUrl(
      href,
    )}`
    void openLink(url)
  }

  const onSignIn = () => requireSignIn(() => {})

  const onPressHideTranslation = () => clearTranslation()

  const isDiscoverDebugUser =
    IS_INTERNAL ||
    DISCOVER_DEBUG_DIDS[currentAccount?.did || ''] ||
    ax.features.enabled(ax.features.DebugFeedContext)

  return (
    <>
      <Prompt.Basic
        control={redraftPromptControl}
        title={l`Redraft this post?`}
        description={l`This will delete the original post and open the composer with its content.`}
        onConfirm={onConfirmRedraft}
        confirmButtonCta={l`Redraft`}
        confirmButtonColor="primary"
      />
      <Menu.Outer>
        {isAuthor && (
          <>
            <Menu.Group>
              <Menu.Item
                testID="pinPostBtn"
                label={
                  isPinned ? l`Unpin from profile` : l`Pin to your profile`
                }
                disabled={isPinPending}
                onPress={onPressPin}>
                <Menu.ItemText>
                  {isPinned ? l`Unpin from profile` : l`Pin to your profile`}
                </Menu.ItemText>
                <Menu.ItemIcon
                  icon={isPinPending ? Loader : PinIcon}
                  position="right"
                />
              </Menu.Item>
              <Menu.Item
                testID="redraftPostBtn"
                label={l`Redraft`}
                onPress={onRedraftPost}>
                <Menu.ItemText>{l`Redraft`}</Menu.ItemText>
                <Menu.ItemIcon icon={Pen} position="right" />
              </Menu.Item>
            </Menu.Group>
            <Menu.Divider />
          </>
        )}

        {videoEmbed && (
          <>
            <Menu.Group>
              <Menu.Item
                testID="postDropdownDownloadVideoBtn"
                label={l`Download video`}
                onPress={() => void onPressDownloadVideo()}>
                <Menu.ItemText>{l`Download video`}</Menu.ItemText>
                <Menu.ItemIcon icon={Download} position="right" />
              </Menu.Item>
            </Menu.Group>
            <Menu.Divider />
          </>
        )}

        {isEmbedGif() && (
          <>
            <Menu.Group>
              <Menu.Item
                testID="postDropdownDownloadGifBtn"
                label={l`Download GIF`}
                onPress={onPressDownloadGif}>
                <Menu.ItemText>{l`Download GIF`}</Menu.ItemText>
                <Menu.ItemIcon icon={Download} position="right" />
              </Menu.Item>
            </Menu.Group>
            <Menu.Divider />
          </>
        )}

        <Menu.Group>
          {!hideInPWI || hasSession ? (
            <>
              {translationState.status === 'loading' ? (
                <Menu.Item
                  testID="postDropdownTranslateBtn"
                  label={l`Translating…`}
                  onPress={() => {}}>
                  <Menu.ItemText>{l`Translating…`}</Menu.ItemText>
                  <Menu.ItemIcon icon={Translate} position="right" />
                </Menu.Item>
              ) : translationState.status === 'success' ? (
                <Menu.Item
                  testID="postDropdownTranslateBtn"
                  label={l`Hide translation`}
                  onPress={onPressHideTranslation}>
                  <Menu.ItemText>{l`Hide translation`}</Menu.ItemText>
                  <Menu.ItemIcon icon={Translate} position="right" />
                </Menu.Item>
              ) : (
                <Menu.Item
                  testID="postDropdownTranslateBtn"
                  label={
                    forceGoogleTranslate
                      ? l`Open in Google Translate`
                      : l`Translate`
                  }
                  onPress={onPressTranslate}>
                  <Menu.ItemText>
                    {forceGoogleTranslate
                      ? l`Open in Google Translate`
                      : l`Translate`}
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={Translate} position="right" />
                </Menu.Item>
              )}

              <Menu.Item
                testID="postDropdownCopyTextBtn"
                label={l`Copy post text`}
                onPress={onCopyPostText}>
                <Menu.ItemText>{l`Copy post text`}</Menu.ItemText>
                <Menu.ItemIcon icon={ClipboardIcon} position="right" />
              </Menu.Item>
            </>
          ) : (
            <Menu.Item
              testID="postDropdownSignInBtn"
              label={l`Sign in to view post`}
              onPress={onSignIn}>
              <Menu.ItemText>{l`Sign in to view post`}</Menu.ItemText>
              <Menu.ItemIcon icon={Eye} position="right" />
            </Menu.Item>
          )}
        </Menu.Group>

        {hasSession && feedFeedback.enabled && (
          <>
            <Menu.Divider />
            <Menu.Group>
              <Menu.Item
                testID="postDropdownShowMoreBtn"
                label={l`Show more like this`}
                onPress={onPressShowMore}>
                <Menu.ItemText>{l`Show more like this`}</Menu.ItemText>
                <Menu.ItemIcon icon={EmojiSmile} position="right" />
              </Menu.Item>

              <Menu.Item
                testID="postDropdownShowLessBtn"
                label={l`Show less like this`}
                onPress={onPressShowLess}>
                <Menu.ItemText>{l`Show less like this`}</Menu.ItemText>
                <Menu.ItemIcon icon={EmojiSad} position="right" />
              </Menu.Item>
            </Menu.Group>
          </>
        )}

        {isDiscoverDebugUser && (
          <>
            <Menu.Divider />
            <Menu.Item
              testID="postDropdownReportMisclassificationBtn"
              label={l`Assign topic for algo`}
              onPress={onReportMisclassification}>
              <Menu.ItemText>{l`Assign topic for algo`}</Menu.ItemText>
              <Menu.ItemIcon icon={AtomIcon} position="right" />
            </Menu.Item>
            {isReply && (
              <Menu.Item
                testID="postDropdownLabelReplyBtn"
                label={l`Label reply for algo`}
                onPress={onLabelReply}>
                <Menu.ItemText>{l`Label reply for algo`}</Menu.ItemText>
                <Menu.ItemIcon icon={AtomIcon} position="right" />
              </Menu.Item>
            )}
          </>
        )}

        {hasSession && (
          <>
            <Menu.Divider />
            <Menu.Group>
              <Menu.Item
                testID="postDropdownMuteThreadBtn"
                label={isThreadMuted ? l`Unmute thread` : l`Mute thread`}
                onPress={onToggleThreadMute}>
                <Menu.ItemText>
                  {isThreadMuted ? l`Unmute thread` : l`Mute thread`}
                </Menu.ItemText>
                <Menu.ItemIcon
                  icon={isThreadMuted ? Unmute : Mute}
                  position="right"
                />
              </Menu.Item>

              <Menu.Item
                testID="postDropdownMuteWordsBtn"
                label={l`Mute words & tags`}
                onPress={onToggleWordsAndTagsMute}>
                <Menu.ItemText>{l`Mute words & tags`}</Menu.ItemText>
                <Menu.ItemIcon icon={Filter} position="right" />
              </Menu.Item>
            </Menu.Group>
          </>
        )}

        {hasSession &&
          (canHideReplyForEveryone || canDetachQuote || canHidePostForMe) && (
            <>
              <Menu.Divider />
              <Menu.Group>
                {canHidePostForMe && (
                  <Menu.Item
                    testID="postDropdownHideBtn"
                    label={isReply ? l`Hide reply for me` : l`Hide post for me`}
                    onPress={() => hidePromptControl.open()}>
                    <Menu.ItemText>
                      {isReply ? l`Hide reply for me` : l`Hide post for me`}
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={EyeSlash} position="right" />
                  </Menu.Item>
                )}
                {canHideReplyForEveryone && (
                  <Menu.Item
                    testID="postDropdownHideBtn"
                    label={
                      isReplyHiddenByThreadgate
                        ? l`Show reply for everyone`
                        : l`Hide reply for everyone`
                    }
                    onPress={
                      isReplyHiddenByThreadgate
                        ? onToggleReplyVisibility
                        : () => hideReplyConfirmControl.open()
                    }>
                    <Menu.ItemText>
                      {isReplyHiddenByThreadgate
                        ? l`Show reply for everyone`
                        : l`Hide reply for everyone`}
                    </Menu.ItemText>
                    <Menu.ItemIcon
                      icon={isReplyHiddenByThreadgate ? Eye : EyeSlash}
                      position="right"
                    />
                  </Menu.Item>
                )}

                {canDetachQuote && (
                  <Menu.Item
                    disabled={isDetachPending}
                    testID="postDropdownHideBtn"
                    label={
                      quoteEmbed.isDetached
                        ? l`Re-attach quote`
                        : l`Detach quote`
                    }
                    onPress={
                      quoteEmbed.isDetached
                        ? onToggleQuotePostAttachment
                        : () => quotePostDetachConfirmControl.open()
                    }>
                    <Menu.ItemText>
                      {quoteEmbed.isDetached
                        ? l`Re-attach quote`
                        : l`Detach quote`}
                    </Menu.ItemText>
                    <Menu.ItemIcon
                      icon={
                        isDetachPending
                          ? Loader
                          : quoteEmbed.isDetached
                            ? Eye
                            : EyeSlash
                      }
                      position="right"
                    />
                  </Menu.Item>
                )}
              </Menu.Group>
            </>
          )}

        {hasSession && (
          <>
            <Menu.Divider />
            <Menu.Group>
              {!isAuthor && (
                <>
                  <Menu.Item
                    testID="postDropdownMuteBtn"
                    label={
                      postAuthor.viewer?.muted
                        ? l`Unmute account`
                        : l`Mute account`
                    }
                    onPress={() => void onMuteAuthor()}>
                    <Menu.ItemText>
                      {postAuthor.viewer?.muted
                        ? l`Unmute account`
                        : l`Mute account`}
                    </Menu.ItemText>
                    <Menu.ItemIcon
                      icon={postAuthor.viewer?.muted ? UnmuteIcon : MuteIcon}
                      position="right"
                    />
                  </Menu.Item>

                  {!postAuthor.viewer?.blocking && (
                    <Menu.Item
                      testID="postDropdownBlockBtn"
                      label={l`Block account`}
                      onPress={() => blockPromptControl.open()}>
                      <Menu.ItemText>{l`Block account`}</Menu.ItemText>
                      <Menu.ItemIcon icon={PersonX} position="right" />
                    </Menu.Item>
                  )}

                  <Menu.Item
                    testID="postDropdownReportBtn"
                    label={l`Report post`}
                    onPress={() => reportDialogControl.open()}>
                    <Menu.ItemText>{l`Report post`}</Menu.ItemText>
                    <Menu.ItemIcon icon={Warning} position="right" />
                  </Menu.Item>
                </>
              )}

              {isAuthor && (
                <>
                  <Menu.Item
                    testID="postDropdownEditPostInteractions"
                    label={l`Edit interaction settings`}
                    onPress={() => postInteractionSettingsDialogControl.open()}
                    {...(isAuthor
                      ? Platform.select({
                          web: {
                            onHoverIn: prefetchPostInteractionSettings,
                          },
                          native: {
                            onPressIn: prefetchPostInteractionSettings,
                          },
                        })
                      : {})}>
                    <Menu.ItemText>
                      {l`Edit interaction settings`}
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={Gear} position="right" />
                  </Menu.Item>
                  <Menu.Item
                    testID="postDropdownDeleteBtn"
                    label={l`Delete post`}
                    onPress={() => deletePromptControl.open()}>
                    <Menu.ItemText>{l`Delete post`}</Menu.ItemText>
                    <Menu.ItemIcon icon={Trash} position="right" />
                  </Menu.Item>
                </>
              )}
            </Menu.Group>
          </>
        )}
      </Menu.Outer>
      <Prompt.Basic
        control={deletePromptControl}
        title={l`Delete this post?`}
        description={l`If you remove this post, you won't be able to recover it.`}
        onConfirm={onDeletePost}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
      />
      <Prompt.Basic
        control={hidePromptControl}
        title={isReply ? l`Hide this reply?` : l`Hide this post?`}
        description={l`This post will be hidden from feeds and threads. This cannot be undone.`}
        onConfirm={onHidePost}
        confirmButtonCta={l`Hide`}
      />
      <ReportDialog
        control={reportDialogControl}
        subject={{
          ...post,
          $type: 'app.bsky.feed.defs#postView',
        }}
        onAfterSubmit={() => {
          ax.metric('postMenu:reportPost', {
            uri: postUri,
            authorDid: postAuthor.did,
            logContext,
            feedDescriptor: feedFeedback.feedDescriptor,
          })
        }}
      />
      <PostInteractionSettingsDialog
        control={postInteractionSettingsDialogControl}
        postUri={post.uri}
        rootPostUri={rootUri}
        initialThreadgateView={post.threadgate}
      />
      <Prompt.Basic
        control={quotePostDetachConfirmControl}
        title={l`Detach quote post?`}
        description={l`This will remove your post from this quote post for all users, and replace it with a placeholder.`}
        onConfirm={() => void onToggleQuotePostAttachment()}
        confirmButtonCta={l`Yes, detach`}
      />
      <Prompt.Basic
        control={hideReplyConfirmControl}
        title={l`Hide this reply?`}
        description={l`This reply will be sorted into a hidden section at the bottom of your thread and will mute notifications for subsequent replies - both for yourself and others.`}
        onConfirm={() => void onToggleReplyVisibility()}
        confirmButtonCta={l`Yes, hide`}
      />
      <BlockDialog
        control={blockPromptControl}
        profile={postAuthor}
        onBlock={onBlockAuthor}
      />
    </>
  )
}
PostMenuItems = memo(PostMenuItems)
export {PostMenuItems}
