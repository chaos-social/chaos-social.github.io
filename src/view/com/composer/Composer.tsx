import {
  Fragment,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import {KeyboardAvoidingView} from 'react-native-keyboard-controller'
import {Circle as ProgressCircle} from 'react-native-progress'
import Animated, {
  type AnimatedRef,
  type AnimatedStyle,
  FadeIn,
  FadeOut,
  interpolateColor,
  LayoutAnimationConfig,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {scheduleOnUI} from 'react-native-worklets'
import * as FileSystem from 'expo-file-system'
import {EncodingType, readAsStringAsync} from 'expo-file-system/legacy'
import {type ImagePickerAsset} from 'expo-image-picker'
import {type AtpAgent} from '@atproto/api'
import {type Client, type UriString} from '@atproto/lex'
import {AtUri, type AtUriString} from '@atproto/syntax'
import {BottomSheetPortalProvider} from '@bsky.app/bottom-sheet'
import {type RichText} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useQueries, useQueryClient} from '@tanstack/react-query'

import {generateAltText} from '#/lib/ai/generateAltText'
import * as apilib from '#/lib/api/index'
import {EmbeddingDisabledError} from '#/lib/api/resolve'
import {useAppState} from '#/lib/appState'
import {retry} from '#/lib/async/retry'
import {until} from '#/lib/async/until'
import {
  MAX_ALT_TEXT,
  MAX_DRAFT_GRAPHEME_LENGTH,
  MAX_GRAPHEME_LENGTH,
  SUPPORTED_MIME_TYPES,
  type SupportedMimeTypes,
  VIDEO_MAX_DURATION_MS,
} from '#/lib/constants'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {createVideoTelemetry} from '#/lib/media/video/telemetry'
import {mimeToExt} from '#/lib/media/video/util'
import {useCallOnce} from '#/lib/once'
import {type NavigationProp} from '#/lib/routes/types'
import {getShapeStyle} from '#/lib/shapes'
import {cleanError} from '#/lib/strings/errors'
import {colors} from '#/lib/styles'
import {userStyle} from '#/lib/userstyles'
import {matchXrpcError} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {useDialogStateControlContext} from '#/state/dialogs'
import {emitPostCreated} from '#/state/events'
import {
  type ComposerImage,
  createComposerImage,
  pasteImage,
} from '#/state/gallery'
import {
  useForceAltTextEnabled,
  useRequireAltTextEnabled,
} from '#/state/preferences'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  fromPostLanguages,
  toPostLanguages,
  useLanguagePrefs,
  useLanguagePrefsApi,
} from '#/state/preferences/languages'
import {useOmitViaField} from '#/state/preferences/omit-via-field'
import {
  useAltTextAiConfig,
  useAltTextAiConfigured,
} from '#/state/preferences/openrouter'
import {useTidSuffix} from '#/state/preferences/tid-suffix'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {resolveLinkQueryOptions} from '#/state/queries/resolve-link'
import {
  threadgateViewToAllowUISetting,
  useThreadgateViewQuery,
} from '#/state/queries/threadgate'
import {
  useAppviewClient,
  useChatClient,
  usePdsClient,
  useSession,
} from '#/state/session'
import {useAgent, useSessionApi} from '#/state/session'
import {pdsAgent} from '#/state/session/agent'
import {
  buildAppviewClient,
  buildChatClient,
  buildPdsClient,
} from '#/state/session/clients'
import {isEphemeralAuthError} from '#/state/session/ephemeral-auth'
import {useComposerControls, useComposerState} from '#/state/shell/composer'
import {type ComposerOpts, type OnPostSuccessData} from '#/state/shell/composer'
import {saveRecovery} from '#/state/shell/composer/recovery'
import {CharProgress} from '#/view/com/composer/char-progress/CharProgress'
import {ComposerReplyTo} from '#/view/com/composer/ComposerReplyTo'
import {DraftsButton} from '#/view/com/composer/drafts/DraftsButton'
import {
  ExternalEmbedGif,
  ExternalEmbedLink,
} from '#/view/com/composer/ExternalEmbed'
import {ExternalEmbedRemoveBtn} from '#/view/com/composer/ExternalEmbedRemoveBtn'
import {GifAltTextDialog} from '#/view/com/composer/GifAltText'
import {LabelsBtn} from '#/view/com/composer/labels/LabelsBtn'
import {Gallery} from '#/view/com/composer/photos/Gallery'
import {OpenCameraBtn} from '#/view/com/composer/photos/OpenCameraBtn'
import {SelectGifBtn} from '#/view/com/composer/photos/SelectGifBtn'
import {SuggestedLanguage} from '#/view/com/composer/select-language/SuggestedLanguage'
import {TagsBtn} from '#/view/com/composer/tags/TagsBtn'
// TODO: Prevent naming components that coincide with RN primitives
// due to linting false positives
import {TextInput} from '#/view/com/composer/text-input/TextInput'
import {TextSyntaxHelp} from '#/view/com/composer/TextSyntaxHelp'
import {ThreadgateBtn} from '#/view/com/composer/threadgate/ThreadgateBtn'
import {SubtitleDialogBtn} from '#/view/com/composer/videos/SubtitleDialog'
import {VideoEmbedRedraft} from '#/view/com/composer/videos/VideoEmbedRedraft'
import {VideoPreview} from '#/view/com/composer/videos/VideoPreview'
import {VideoTranscodeProgress} from '#/view/com/composer/videos/VideoTranscodeProgress'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, native, useBreakpoints, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as EmojiPicker from '#/components/EmojiPicker'
import {EphemeralAccountSwitcher} from '#/components/EphemeralAccountSwitcher'
import {useEphemeralAccountError} from '#/components/hooks/useEphemeralAccountError'
import {
  ArrowBottom_Stroke2_Corner0_Rounded as ArrowDownIcon,
  ArrowTop_Stroke2_Corner0_Rounded as ArrowUpIcon,
} from '#/components/icons/Arrow'
import {CircleCheck_Stroke2_Corner0_Rounded as CircleCheckIcon} from '#/components/icons/CircleCheck'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfoIcon} from '#/components/icons/CircleInfo'
import {EmojiArc_Stroke2_Corner0_Rounded as EmojiSmileIcon} from '#/components/icons/Emoji'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {LazyQuoteEmbed} from '#/components/Post/Embed/LazyQuoteEmbed'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {
  IS_ANDROID,
  IS_IOS,
  IS_IPAD,
  IS_LIQUID_GLASS,
  IS_NATIVE,
  IS_WEB,
  IS_WEB_SAFARI,
} from '#/env'
import {type Gif} from '#/features/gifPicker/types'
import {app, chat} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {
  draftToComposerPosts,
  extractLocalRefs,
  type RestoredVideo,
} from './drafts/state/api'
import {
  loadDraftMedia,
  useCleanupPublishedDraftMutation,
  useSaveDraftMutation,
} from './drafts/state/queries'
import {type DraftSummary} from './drafts/state/schema'
import {revokeAllMediaUrls} from './drafts/state/storage'
import {PostLanguageSelect} from './select-language/PostLanguageSelect'
import {
  type AssetType,
  SelectMediaButton,
  type SelectMediaButtonProps,
} from './SelectMediaButton'
import {
  type ComposerAction,
  composerReducer,
  createComposerState,
  type EmbedDraft,
  MAX_GALLERY_IMAGES,
  type PostAction,
  type PostDraft,
  type ThreadDraft,
} from './state/composer'
import {prepareVideoForAccount} from './state/prepareVideoForAccount'
import {
  NO_VIDEO,
  type NoVideoState,
  processVideo,
  type VideoState,
} from './state/video'
import {videoProgressWithinPhase} from './state/videoProgress'
import {type TextInputRef} from './text-input/TextInput.types'
import {getVideoMetadata} from './videos/metadata'
import {clearThumbnailCache} from './videos/VideoTranscodeBackdrop'

type CancelRef = {
  onPressCancel: () => void
}

function applyGalleryCap(
  currentCount: number,
  incoming: ComposerImage[],
):
  | {status: 'full'}
  | {status: 'partial'; accepted: ComposerImage[]; dropped: number}
  | {status: 'ok'; accepted: ComposerImage[]} {
  const remaining = MAX_GALLERY_IMAGES - currentCount
  if (remaining <= 0) {
    return {status: 'full'}
  }
  if (incoming.length > remaining) {
    return {
      status: 'partial',
      accepted: incoming.slice(0, remaining),
      dropped: incoming.length - remaining,
    }
  }
  return {status: 'ok', accepted: incoming}
}

function useAddImagesWithCap(
  currentCount: number,
  dispatchPostAction: (action: PostAction) => void,
) {
  const {t: l} = useLingui()
  return useCallback(
    (next: ComposerImage[]) => {
      const result = applyGalleryCap(currentCount, next)
      if (result.status === 'full') {
        Toast.show(
          l({
            message: `You can only add up to ${plural(MAX_GALLERY_IMAGES, {
              other: '# images',
            })} per post`,
            comment:
              'Toast shown when the user tries to add more images but the post gallery is already at the cap',
          }),
          {type: 'warning'},
        )
        return
      }
      if (result.status === 'partial') {
        Toast.show(
          l({
            message: `Only ${result.accepted.length} of ${next.length} ${plural(next.length, {one: 'image', other: 'images'})} added; limit is ${MAX_GALLERY_IMAGES}`,
            comment:
              'Toast shown when adding images would exceed the post gallery cap; only the first N are kept',
          }),
          {type: 'warning'},
        )
      }
      dispatchPostAction({
        type: 'embed_add_images',
        images: result.accepted,
      })
    },
    [currentCount, dispatchPostAction, l],
  )
}

type Props = ComposerOpts
export const ComposePost = ({
  recoveredState,
  activeAccountDid: initialActiveAccountDid,
  openAccountSwitcher = false,
  replyTo: initialReplyTo,
  onPost,
  onPostSuccess,
  quote: initQuote,
  mention: initMention,
  text: initText,
  tags: initTags,
  imageUris: initImageUris,
  videoUri: initVideoUri,
  openGallery,
  logContext,
  cancelRef,
}: Props & {
  cancelRef?: RefObject<CancelRef | null>
}) => {
  const [replyTo, setReplyTo] = useState(initialReplyTo)
  const {accounts, currentAccount} = useSession()
  const t = useTheme()
  const ax = useAnalytics()
  const client = useAppviewClient()
  const chatClient = useChatClient()
  const pdsClient = usePdsClient()
  const sessionApi = useSessionApi()
  const queryClient = useQueryClient()
  const currentDid = currentAccount!.did
  const [activeAccountDid, setActiveAccountDid] = useState<string>(
    initialActiveAccountDid ?? currentDid,
  )

  useEffect(() => {
    setActiveAccountDid(initialActiveAccountDid ?? currentDid)
  }, [initialActiveAccountDid, currentDid])
  const {closeComposer} = useComposerControls()
  const isComposerOpen = !!useComposerState()
  const showEphemeralError = useEphemeralAccountError()
  const {t: l, i18n} = useLingui()
  const forceAltTextEnabled = useForceAltTextEnabled()
  const requireAltTextEnabled = useRequireAltTextEnabled()
  const omitViaField = useOmitViaField()
  const tidSuffix = useTidSuffix()

  const langPrefs = useLanguagePrefs()
  const setLangPrefs = useLanguagePrefsApi()
  const textInputRef = useRef<TextInputRef>(null)
  const discardPromptControl = Prompt.usePromptControl()
  const emptyPostsPromptControl = Prompt.usePromptControl()
  const missingAltTextPromptControl = Prompt.usePromptControl()
  const skipEmptyConfirmedRef = useRef(false)
  const missingAltTextConfirmedRef = useRef(false)
  const {mutateAsync: saveDraft, isPending: _isSavingDraft} =
    useSaveDraftMutation()
  const {mutate: cleanupPublishedDraft} = useCleanupPublishedDraftMutation()
  const {closeAllDialogs} = useDialogStateControlContext()
  const {data: preferences} = usePreferencesQuery()
  const navigation = useNavigation<NavigationProp>()

  const [isPublishing, setIsPublishing] = useState(false)
  const [publishingStage, setPublishingStage] = useState('')
  const [error, setError] = useState('')

  /**
   * Track when a draft was created so we can measure draft age in metrics.
   * Set when a draft is loaded via handleSelectDraft.
   */
  const [loadedDraftCreatedAt, setLoadedDraftCreatedAt] = useState<
    string | null
  >(null)

  /**
   * A manual selection or accepted suggestion applies only to this composer
   * session, without changing the primary language preference.
   */
  const [selectedPostLanguage, setSelectedPostLanguage] = useState<
    string | null
  >(null)

  /**
   * The language(s) of the post being replied to.
   */
  const [replyToLanguages, setReplyToLanguages] = useState<string[]>(
    replyTo?.langs || [],
  )

  const {data: replyThreadgateView, isFetched: isReplyThreadgateFetched} =
    useThreadgateViewQuery({
      postUri: replyTo?.uri,
    })
  const isReplyGatedPost = useMemo(() => {
    if (!replyTo) {
      return false
    }
    if (!isReplyThreadgateFetched) {
      return true
    }
    const settings = threadgateViewToAllowUISetting(
      replyThreadgateView ?? undefined,
    )
    return !(settings.length === 1 && settings[0].type === 'everybody')
  }, [replyTo, replyThreadgateView, isReplyThreadgateFetched])

  const accountSelectionVersion = useRef(0)
  const selectActiveAccount = async (did: string) => {
    const version = ++accountSelectionVersion.current
    const account = accounts.find(candidate => candidate.did === did)
    if (!account) return
    try {
      if (replyTo && isReplyGatedPost) {
        const agent = await sessionApi.createEphemeralAgent(account)
        const res = await agent.getPosts({uris: [replyTo.uri]})
        if (version !== accountSelectionVersion.current) return
        const target = res.data.posts[0]
        if (!target || target.viewer?.replyDisabled) {
          Toast.show(l`This account cannot reply to this post`, {
            type: 'warning',
          })
          return
        }
      }
      if (version === accountSelectionVersion.current) setActiveAccountDid(did)
    } catch (error) {
      if (version === accountSelectionVersion.current) {
        showEphemeralError(error, account, refreshed =>
          selectActiveAccount(refreshed.did),
        )
      }
    }
  }

  /**
   * Manual selections and accepted suggestions override the saved post language
   * default for this composition only.
   */
  const currentLanguages = useMemo(
    () =>
      selectedPostLanguage
        ? toPostLanguages(selectedPostLanguage)
        : toPostLanguages(langPrefs.postLanguage),
    [selectedPostLanguage, langPrefs.postLanguage],
  )

  /**
   * When the user selects a language from the composer language selector,
   * override the current selection and clear reply language suggestions.
   */
  const onSelectLanguage = (language: string) => {
    setSelectedPostLanguage(language)
    setReplyToLanguages([])
  }

  /**
   * Timestamp (ms) of the last honored nudge from language detection.
   * Used to rate-limit the pulse animation: we ignore back-to-back
   * nudges that arrive within NUDGE_COOLDOWN_MS. Consumers key an effect
   * on this value — it only changes when we actually want to re-pulse.
   */
  const [languageNudgeAt, setLanguageNudgeAt] = useState(0)
  const onLanguageNudge = () => {
    const now = Date.now()
    // ignore back-to-back nudges within 10s; only update state (and
    // therefore re-pulse) once the cooldown has elapsed
    setLanguageNudgeAt(prev => (now - prev > 10_000 ? now : prev))
  }

  const [composerState, composerDispatch] = useReducer(
    composerReducer,
    recoveredState ??
      createComposerState({
        initImageUris,
        initQuoteUri: initQuote?.uri,
        initText,
        initMention,
        initInteractionSettings: preferences?.postInteractionSettings,
        initVideoUri,
        initTags,
      }),
  )

  useLayoutEffect(() => {
    if (isComposerOpen) {
      saveRecovery(currentDid, {activeAccountDid, replyTo}, composerState)
    }
  }, [isComposerOpen, currentDid, activeAccountDid, replyTo, composerState])

  const thread = composerState.thread

  // Clear error when composer content changes, but only if all posts are
  // back within the character limit.
  const allPostsWithinLimit = thread.posts.every(
    post => post.richtext.graphemeLength <= MAX_DRAFT_GRAPHEME_LENGTH,
  )

  const activePost = thread.posts[composerState.activePostIndex]
  const nextPost: PostDraft | undefined =
    thread.posts[composerState.activePostIndex + 1]
  const canAddPost =
    !isEmptyPost(activePost) && (!nextPost || !isEmptyPost(nextPost))
  const dispatch = useCallback(
    (postAction: PostAction) => {
      composerDispatch({
        type: 'update_post',
        postId: activePost.id,
        postAction,
      })
    },
    [activePost.id],
  )

  const processSelectedAccountVideo = useCallback(
    async (
      asset: Parameters<typeof processVideo>[0],
      dispatchVideo: Parameters<typeof processVideo>[1],
      signal: AbortSignal,
      telemetry: Parameters<typeof processVideo>[6],
    ) => {
      let ephemeral: AtpAgent | undefined
      try {
        const account = accounts.find(
          account => account.did === activeAccountDid,
        )
        if (!account)
          throw new Error('The selected posting account is no longer signed in')
        const uploadClient =
          account.did === currentDid
            ? pdsClient
            : buildPdsClient(
                pdsAgent(
                  (ephemeral = await sessionApi.createEphemeralAgent(account)),
                ),
              )
        if (signal.aborted) return
        if (uploadClient.assertDid !== account.did) {
          throw new Error(
            'The video upload session does not match the selected account',
          )
        }
        await processVideo(
          asset,
          dispatchVideo,
          uploadClient,
          account.pdsUrl ?? account.service,
          signal,
          i18n,
          telemetry,
        )
      } catch (error) {
        const account = accounts.find(a => a.did === activeAccountDid)
        if (
          account &&
          account.did !== currentDid &&
          isEphemeralAuthError(error)
        ) {
          showEphemeralError(error, account, () =>
            processSelectedAccountVideo(
              asset,
              dispatchVideo,
              signal,
              telemetry,
            ),
          )
        }
        dispatchVideo({
          type: 'to_error',
          error: error instanceof Error ? error.message : String(error),
          signal,
        })
      } finally {
        if (
          ephemeral &&
          'dispose' in ephemeral &&
          typeof ephemeral.dispose === 'function'
        )
          (ephemeral.dispose as () => void)()
      }
    },
    [
      accounts,
      activeAccountDid,
      currentDid,
      pdsClient,
      sessionApi,
      i18n,
      showEphemeralError,
    ],
  )

  const selectVideo = useCallback(
    async (postId: string, asset: ImagePickerAsset) => {
      /*
       * Share-extension deeplinks deliver a video URI without duration, so
       * probe before we decide whether to compress. The picker and web paste
       * paths already populate duration upstream. GIFs must skip the probe:
       * they have no video track, so the iOS prober never resolves or rejects
       * and the await below would hang forever.
       */
      if (
        asset.duration == null &&
        IS_NATIVE &&
        asset.mimeType !== 'image/gif'
      ) {
        try {
          const probed = await getVideoMetadata(asset.uri, asset.mimeType)
          asset = {
            ...asset,
            mimeType: probed.mimeType ?? asset.mimeType,
            width: probed.width ?? asset.width,
            height: probed.height ?? asset.height,
            duration: probed.duration,
          }
        } catch (e) {
          logger.warn('selectVideo: duration probe failed', {safeMessage: e})
        }
      }

      const abortController = new AbortController()
      const telemetry = createVideoTelemetry({
        asset,
        signal: abortController.signal,
        metric: ax.metric,
      })
      telemetry.picked()
      composerDispatch({
        type: 'update_post',
        postId: postId,
        postAction: {
          type: 'embed_add_video',
          asset,
          abortController,
          telemetry,
        },
      })

      /*
       * Fail early on duration so we don't spend time compressing a video the
       * server would reject anyway.
       */
      if (asset.duration != null && asset.duration > VIDEO_MAX_DURATION_MS) {
        composerDispatch({
          type: 'update_post',
          postId: postId,
          postAction: {
            type: 'embed_update_video',
            videoAction: {
              type: 'to_error',
              error: l`Videos must be 10 minutes or less.`,
              signal: abortController.signal,
            },
          },
        })
        return
      }

      void processSelectedAccountVideo(
        asset,
        videoAction => {
          composerDispatch({
            type: 'update_post',
            postId: postId,
            postAction: {
              type: 'embed_update_video',
              videoAction,
            },
          })
        },
        abortController.signal,
        telemetry,
      )
    },
    [l, processSelectedAccountVideo, composerDispatch, ax.metric],
  )

  const onInitVideo = useNonReactiveCallback(() => {
    if (initVideoUri && !initVideoUri.blobRef) {
      void selectVideo(activePost.id, initVideoUri)
    }
  })

  useEffect(() => {
    onInitVideo()
  }, [onInitVideo])

  // Fire composer:open metric on mount
  useCallOnce(() => {
    ax.metric('composer:open', {
      logContext: logContext ?? 'Other',
      isReply: !!replyTo,
      hasQuote: !!initQuote,
      hasDraft: false,
    })
  })()

  const clearVideo = useCallback(
    (postId: string) => {
      composerDispatch({
        type: 'update_post',
        postId: postId,
        postAction: {
          type: 'embed_remove_video',
        },
      })
    },
    [composerDispatch],
  )

  const restoreVideo = useCallback(
    async (postId: string, videoInfo: RestoredVideo) => {
      try {
        logger.debug('restoring video from draft', {
          postId,
          videoUri: videoInfo.uri,
          altText: videoInfo.altText,
          captionCount: videoInfo.captions.length,
        })

        let asset: ImagePickerAsset

        if (IS_WEB) {
          // Web: Convert blob URL to a File, then get video metadata (returns data URL)
          const response = await fetch(videoInfo.uri)
          const blob = await response.blob()
          const file = new File([blob], 'restored-video', {
            type: videoInfo.mimeType,
          })
          asset = await getVideoMetadata(file)
        } else {
          let uri = videoInfo.uri
          if (IS_ANDROID) {
            // Android: expo-file-system double-encodes filenames with special chars.
            // The native metadata probe can't handle the double-encoded URI, so
            // copy it to a temp file with a simple name.
            const sourceFile = new FileSystem.File(videoInfo.uri)
            const tempFileName = `draft-video-${Date.now()}.${mimeToExt(videoInfo.mimeType)}`
            const tempFile = new FileSystem.File(
              FileSystem.Paths.cache,
              tempFileName,
            )
            await sourceFile.copy(tempFile)
            logger.debug('restoreVideo: copied to temp file', {
              source: videoInfo.uri,
              temp: tempFile.uri,
            })
            uri = tempFile.uri
          }
          asset = await getVideoMetadata(uri, videoInfo.mimeType)
        }

        // Start video processing using existing flow
        const abortController = new AbortController()
        const telemetry = createVideoTelemetry({
          asset,
          signal: abortController.signal,
          metric: ax.metric,
        })
        telemetry.picked()
        composerDispatch({
          type: 'update_post',
          postId,
          postAction: {
            type: 'embed_add_video',
            asset,
            abortController,
            telemetry,
          },
        })

        if (asset.duration != null && asset.duration > VIDEO_MAX_DURATION_MS) {
          composerDispatch({
            type: 'update_post',
            postId,
            postAction: {
              type: 'embed_update_video',
              videoAction: {
                type: 'to_error',
                error: l`Videos must be 10 minutes or less.`,
                signal: abortController.signal,
              },
            },
          })
          return
        }

        // Restore alt text immediately
        if (videoInfo.altText) {
          composerDispatch({
            type: 'update_post',
            postId,
            postAction: {
              type: 'embed_update_video',
              videoAction: {
                type: 'update_alt_text',
                altText: videoInfo.altText,
                signal: abortController.signal,
              },
            },
          })
        }

        // Restore captions (web only - captions use File objects)
        if (IS_WEB && videoInfo.captions.length > 0) {
          const captionTracks = videoInfo.captions.map(c => ({
            lang: c.lang,
            file: new File([c.content], `caption-${c.lang}.vtt`, {
              type: 'text/vtt',
            }),
          }))
          composerDispatch({
            type: 'update_post',
            postId,
            postAction: {
              type: 'embed_update_video',
              videoAction: {
                type: 'update_captions',
                updater: () => captionTracks,
                signal: abortController.signal,
              },
            },
          })
        }

        // Start video compression and upload
        void processSelectedAccountVideo(
          asset,
          videoAction => {
            composerDispatch({
              type: 'update_post',
              postId,
              postAction: {
                type: 'embed_update_video',
                videoAction,
              },
            })
          },
          abortController.signal,
          telemetry,
        )
      } catch (e) {
        logger.error('Failed to restore video from draft', {
          postId,
          error: e,
        })
      }
    },
    [l, processSelectedAccountVideo, composerDispatch, ax.metric],
  )

  const resumeRecoveredVideos = useNonReactiveCallback(() => {
    for (const post of recoveredState?.thread.posts ?? []) {
      const media = post.embed.media
      if (
        media?.type === 'video' &&
        media.video.status !== 'done' &&
        media.video.asset
      ) {
        void restoreVideo(post.id, {
          uri: media.video.asset.uri,
          mimeType: media.video.asset.mimeType ?? 'video/mp4',
          altText: media.video.altText,
          captions: [],
          localRefPath: '',
        })
      }
    }
  })
  useEffect(() => {
    resumeRecoveredVideos()
  }, [resumeRecoveredVideos])

  const handleSelectDraft = useCallback(
    async (draftSummary: DraftSummary) => {
      logger.debug('loading draft for editing', {
        draftId: draftSummary.id,
      })

      let restoredReplyTo: ComposerOpts['replyTo']
      const replyToUri = (draftSummary.draft as {replyToUri?: unknown})
        .replyToUri
      if (replyToUri !== undefined) {
        try {
          if (
            typeof replyToUri !== 'string' ||
            !replyToUri.startsWith('at://')
          ) {
            throw new Error('Invalid draft reply target')
          }
          const {posts} = await client.call(app.bsky.feed.getPosts, {
            uris: [replyToUri as AtUriString],
          })
          const target = posts[0]
          if (!target || !bsky.isType(app.bsky.feed.post, target.record)) {
            throw new Error('Draft reply target unavailable')
          }
          restoredReplyTo = {
            uri: target.uri,
            cid: target.cid,
            text: target.record.text,
            langs: target.record.langs,
            author: target.author,
            embed: target.embed,
          }
        } catch {
          setError(
            l`Could not load the post this draft replies to. Please try again later.`,
          )
          return
        }
      }

      // Load local media files for the draft
      const {loadedMedia} = await loadDraftMedia(draftSummary.draft)

      // Extract original localRefs for orphan detection on save
      const originalLocalRefs = extractLocalRefs(draftSummary.draft)

      logger.debug('draft loaded', {
        draftId: draftSummary.id,
        loadedMediaCount: loadedMedia.size,
        originalLocalRefCount: originalLocalRefs.size,
      })

      // Convert server draft to composer posts (videos returned separately)
      const {posts, restoredVideos} = await draftToComposerPosts(
        draftSummary.draft,
        loadedMedia,
      )

      setError('')
      setReplyTo(restoredReplyTo)
      setReplyToLanguages(restoredReplyTo?.langs ?? [])

      // Dispatch restore action (this also sets draftId in state)
      composerDispatch({
        type: 'restore_from_draft',
        draftId: draftSummary.id,
        posts,
        threadgateAllow: draftSummary.draft.threadgateAllow,
        postgateEmbeddingRules: draftSummary.draft.postgateEmbeddingRules,
        loadedMedia,
        originalLocalRefs,
      })

      // Track when the draft was created for metrics
      setLoadedDraftCreatedAt(draftSummary.createdAt)

      // Fire draft:load metric
      const draftPosts = draftSummary.posts
      const draftAgeMs = Date.now() - new Date(draftSummary.createdAt).getTime()
      ax.metric('draft:load', {
        draftAgeMs,
        hasText: draftPosts.some(p => p.text.trim().length > 0),
        hasImages: draftPosts.some(p => p.images && p.images.length > 0),
        hasVideo: draftPosts.some(p => !!p.video),
        hasGif: draftPosts.some(p => !!p.gif),
        postCount: draftPosts.length,
      })

      // Initiate video processing for any restored videos
      // This is async but we don't await - videos process in the background
      for (const [postIndex, videoInfo] of restoredVideos) {
        const postId = posts[postIndex].id
        void restoreVideo(postId, videoInfo)
      }
    },
    [composerDispatch, restoreVideo, ax, client, l],
  )

  const [publishOnUpload, setPublishOnUpload] = useState(false)

  const onClose = useCallback(() => {
    // HACKFIX: Android keyboard doesn't consistently dismiss IME
    // TODO: investigate the root cause and fix properly -sfn
    if (IS_ANDROID) {
      Keyboard.dismiss()
    }
    closeComposer()
    clearThumbnailCache(queryClient)
    revokeAllMediaUrls()
  }, [closeComposer, queryClient])

  const getDraftSaveError = useCallback(
    (e: unknown): string => {
      if (
        matchXrpcError(e, app.bsky.draft.createDraft) === 'DraftLimitReached'
      ) {
        return l`You've reached the maximum number of drafts`
      }
      return l`Failed to save draft`
    },
    [l],
  )

  const validateDraftTextOrError = useCallback((): boolean => {
    const tooLong = composerState.thread.posts.some(
      post => post.richtext.graphemeLength > MAX_DRAFT_GRAPHEME_LENGTH,
    )
    if (tooLong) {
      setError(
        l`One or more posts are too long to save as a draft. ${plural(MAX_DRAFT_GRAPHEME_LENGTH, {one: 'The maximum number of characters is # character.', other: 'The maximum number of characters is # characters.'})}`,
      )
      return false
    }
    return true
  }, [composerState.thread.posts, l])

  const handleSaveDraft = useCallback(async () => {
    setError('')
    if (!validateDraftTextOrError()) {
      return
    }
    const isNewDraft = !composerState.draftId
    try {
      const result = await saveDraft({
        composerState,
        existingDraftId: composerState.draftId,
        replyToUri: replyTo?.uri,
      })
      composerDispatch({type: 'mark_saved', draftId: result.draftId})

      // Fire draft:save metric
      const posts = composerState.thread.posts
      ax.metric('draft:save', {
        isNewDraft,
        hasText: posts.some(p => p.richtext.text.trim().length > 0),
        hasImages: posts.some(
          p =>
            p.embed.media?.type === 'images' ||
            p.embed.media?.type === 'gallery',
        ),
        hasVideo: posts.some(p => p.embed.media?.type === 'video'),
        hasGif: posts.some(p => p.embed.media?.type === 'gif'),
        hasQuote: posts.some(p => !!p.embed.quote),
        hasLink: posts.some(p => !!p.embed.link),
        postCount: posts.length,
        textLength: posts[0].richtext.text.length,
      })

      onClose()
    } catch (e) {
      logger.error('Failed to save draft', {error: e})
      setError(getDraftSaveError(e))
    }
  }, [
    saveDraft,
    replyTo,
    composerState,
    composerDispatch,
    onClose,
    ax,
    validateDraftTextOrError,
    getDraftSaveError,
  ])

  // Save without closing - for use by DraftsButton
  const saveCurrentDraft = useCallback(async (): Promise<{
    success: boolean
  }> => {
    setError('')
    if (!validateDraftTextOrError()) {
      return {success: false}
    }
    try {
      const result = await saveDraft({
        composerState,
        existingDraftId: composerState.draftId,
        replyToUri: replyTo?.uri,
      })
      composerDispatch({type: 'mark_saved', draftId: result.draftId})
      return {success: true}
    } catch (e) {
      setError(getDraftSaveError(e))
      return {success: false}
    }
  }, [
    saveDraft,
    replyTo,
    composerState,
    composerDispatch,
    validateDraftTextOrError,
    getDraftSaveError,
  ])

  // Handle discard action - fires metric and closes composer
  const handleDiscard = useCallback(() => {
    const posts = thread.posts
    const hasContent = posts.some(
      post =>
        post.richtext.text.trim().length > 0 ||
        post.embed.media ||
        post.embed.link,
    )
    ax.metric('draft:discard', {
      logContext: 'ComposerClose',
      hadContent: hasContent,
      textLength: posts[0].richtext.text.length,
    })
    onClose()
  }, [thread.posts, ax, onClose])

  // Check if composer is empty (no content to save)
  const isComposerEmpty = useMemo(() => {
    // Has multiple posts means it's not empty
    if (thread.posts.length > 1) return false

    const firstPost = thread.posts[0]
    // Has text
    if (firstPost.richtext.text.trim().length > 0) return false
    // Has media
    if (firstPost.embed.media) return false
    // Has quote
    if (firstPost.embed.quote) return false
    // Has link
    if (firstPost.embed.link) return false

    return true
  }, [thread.posts])

  // Clear the composer (discard current content)
  const handleClearComposer = useCallback(() => {
    setReplyTo(undefined)
    setReplyToLanguages([])
    composerDispatch({
      type: 'clear',
      initInteractionSettings: preferences?.postInteractionSettings,
    })
  }, [composerDispatch, preferences?.postInteractionSettings])

  const insets = useSafeAreaInsets()
  const viewStyles = useMemo(
    () => ({
      paddingTop: IS_ANDROID || IS_IPAD ? insets.top : 0,
      paddingBottom: insets.bottom,
    }),
    [insets.top, insets.bottom],
  )

  const onPressCancel = useCallback(() => {
    if (textInputRef.current?.maybeClosePopup()) {
      return
    }

    const hasContent = thread.posts.some(
      post =>
        post.shortenedGraphemeLength > 0 || post.embed.media || post.embed.link,
    )

    // Show discard prompt if there's content AND either:
    // - No draft is loaded (new composition)
    // - Draft is loaded but has been modified
    if (hasContent && (!composerState.draftId || composerState.isDirty)) {
      closeAllDialogs()
      Keyboard.dismiss()
      discardPromptControl.open()
    } else {
      onClose()
    }
  }, [
    thread,
    composerState.draftId,
    composerState.isDirty,
    closeAllDialogs,
    discardPromptControl,
    onClose,
  ])

  useImperativeHandle(cancelRef, () => ({onPressCancel}))

  // On Android, pressing Back should ask confirmation.
  useEffect(() => {
    if (!IS_ANDROID) {
      return
    }
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (closeAllDialogs()) {
          return true
        }
        onPressCancel()
        return true
      },
    )
    return () => {
      backHandler.remove()
    }
  }, [onPressCancel, closeAllDialogs])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- restored memoization
  const missingAltError = useMemo(() => {
    if (!requireAltTextEnabled && !forceAltTextEnabled) {
      return
    }

    let missingImages = 0
    let missingGifs = 0
    let missingVideos = 0

    for (const post of thread.posts) {
      const media = post.embed.media
      if (media?.type === 'images' || media?.type === 'gallery') {
        missingImages += media.images.filter(image => !image.alt).length
      } else if (media?.type === 'gif' && !media.alt) {
        missingGifs++
      } else if (
        media?.type === 'video' &&
        media.video.status !== 'error' &&
        !media.video.altText
      ) {
        missingVideos++
      }
    }

    const messages: string[] = []
    if (missingImages) {
      messages.push(
        l`${plural(missingImages, {
          one: 'One image is missing alt text.',
          other: '# images are missing alt text.',
        })}`,
      )
    }
    if (missingGifs) {
      messages.push(
        l`${plural(missingGifs, {
          one: 'One GIF is missing alt text.',
          other: '# GIFs are missing alt text.',
        })}`,
      )
    }
    if (missingVideos) {
      messages.push(
        l`${plural(missingVideos, {
          one: 'One video is missing alt text.',
          other: '# videos are missing alt text.',
        })}`,
      )
    }
    return messages.join(' ') || undefined
  }, [thread, requireAltTextEnabled, forceAltTextEnabled, l])

  // Subscribe to the resolve-link cache for any link URIs in the thread so we
  // can detect chat invites that resolved to no preview (revoked/expired) and
  // block publishing - otherwise the post would go out without the embed.
  const linkUris = thread.posts
    .filter(post => post.embed.link)
    .map(post => post.embed.link!.uri)
  const linkQueries = useQueries({
    queries: linkUris.map(uri => ({
      ...resolveLinkQueryOptions({appviewClient: client, chatClient}, uri),
      enabled: false,
    })),
  })
  const hasUnavailableChatInvite = linkQueries.some(
    q =>
      q.data?.type === 'chat-invite' &&
      !bsky.isType(chat.bsky.group.defs.joinLinkPreviewView, q.data.view),
  )

  const canPost =
    !(forceAltTextEnabled && missingAltError) &&
    !hasUnavailableChatInvite &&
    thread.posts.some(post => !isEmptyPost(post)) &&
    thread.posts.every(
      post =>
        isEmptyPost(post) ||
        (post.shortenedGraphemeLength <= MAX_GRAPHEME_LENGTH &&
          !(
            post.embed.media?.type === 'video' &&
            post.embed.media.video.status === 'error'
          )),
    )

  const getFilteredThread = useCallback((): {
    type: 'none' | 'trailing-only' | 'non-trailing'
    filteredThread: ThreadDraft
  } => {
    const nonEmptyPosts = thread.posts.filter(post => !isEmptyPost(post))

    if (nonEmptyPosts.length === thread.posts.length) {
      return {type: 'none', filteredThread: thread}
    }

    let lastNonEmptyIndex = -1
    for (let i = thread.posts.length - 1; i >= 0; i--) {
      if (!isEmptyPost(thread.posts[i])) {
        lastNonEmptyIndex = i
        break
      }
    }

    const hasNonTrailingEmpty = thread.posts.some(
      (post, i) => i < lastNonEmptyIndex && isEmptyPost(post),
    )

    const filteredThread: ThreadDraft = {...thread, posts: nonEmptyPosts}

    return {
      type: hasNonTrailingEmpty ? 'non-trailing' : 'trailing-only',
      filteredThread,
    }
  }, [thread])

  const onPressPublish = useCallback(async () => {
    if (isPublishing) {
      return
    }

    if (!canPost) {
      return
    }

    const {type: emptyType, filteredThread} = getFilteredThread()

    if (emptyType === 'non-trailing' && !skipEmptyConfirmedRef.current) {
      emptyPostsPromptControl.open()
      return
    }

    if (missingAltError && !missingAltTextConfirmedRef.current) {
      missingAltTextPromptControl.open()
      return
    }

    if (
      filteredThread.posts.some(
        post =>
          post.embed.media?.type === 'video' &&
          post.embed.media.video.asset &&
          post.embed.media.video.status !== 'done',
      )
    ) {
      setPublishOnUpload(true)
      return
    }

    skipEmptyConfirmedRef.current = false
    missingAltTextConfirmedRef.current = false
    setError('')
    setIsPublishing(true)

    let ephemeralAgent: AtpAgent | undefined
    let postUri: string | undefined
    let postSuccessData: OnPostSuccessData
    try {
      if (activeAccountDid && activeAccountDid !== currentAccount?.did) {
        const activeAccount = accounts.find(a => a.did === activeAccountDid)
        if (!activeAccount)
          throw new Error('The selected posting account is no longer signed in')
        if (activeAccount) {
          try {
            ephemeralAgent =
              await sessionApi.createEphemeralAgent(activeAccount)
          } catch (e) {
            logger.error(
              'Composer: failed to create ephemeral agent for account switch',
              {
                message: e instanceof Error ? e.message : String(e),
              },
            )
            setIsPublishing(false)
            showEphemeralError(e, activeAccount, () => onPressPublish())
            return
          }
        }
      }

      const postingAgent = ephemeralAgent ? pdsAgent(ephemeralAgent) : undefined
      const postingPdsClient = postingAgent
        ? buildPdsClient(postingAgent)
        : pdsClient
      if (postingPdsClient.assertDid !== activeAccountDid) {
        throw new Error(
          'The posting session does not match the selected account',
        )
      }
      const postingThread = {
        ...filteredThread,
        posts: await Promise.all(
          filteredThread.posts.map(async post => {
            const media = post.embed.media
            if (media?.type !== 'video' || media.video.status !== 'done')
              return post
            const account = accounts.find(
              account => account.did === activeAccountDid,
            )
            if (!account)
              throw new Error(
                'The selected posting account is no longer signed in',
              )
            const video = await prepareVideoForAccount(
              media.video,
              postingPdsClient,
              account.pdsUrl ?? account.service,
              currentDid,
              i18n,
            )
            return {
              ...post,
              embed: {
                ...post.embed,
                media: {
                  ...media,
                  video,
                },
              },
            }
          }),
        ),
      }
      logger.info(`composer: posting...`)
      postUri = (
        await apilib.post(queryClient, {
          thread: postingThread,
          replyTo: replyTo?.uri,
          onStateChange: setPublishingStage,
          langs: currentLanguages,
          appviewClient: postingAgent
            ? buildAppviewClient(postingAgent)
            : client,
          chatClient: postingAgent ? buildChatClient(postingAgent) : chatClient,
          pdsClient: postingPdsClient,
          omitViaField,
          tidSuffix,
        })
      ).uris[0]

      // Fire published event for every video that made it into the post.
      // The status guard upstream ensures each video.telemetry is present and
      // processing has completed by this point.
      for (const post of filteredThread.posts) {
        if (post.embed.media?.type === 'video') {
          const video = post.embed.media.video
          if ('telemetry' in video) {
            video.telemetry?.published()
          }
        }
      }

      /*
       * Wait for app view to have received the post(s). If this fails, it's
       * ok, because the post _was_ actually published above.
       */
      try {
        if (postUri) {
          logger.info(`composer: waiting for app view`)

          const posts = await retry(
            5,
            _e => true,
            async () => {
              const res = await client.call(
                app.bsky.unspecced.getPostThreadV2,
                {
                  anchor: postUri! as AtUriString,
                  above: false,
                  below: filteredThread.posts.length - 1,
                  branchingFactor: 1,
                },
              )
              if (res.thread.length !== filteredThread.posts.length) {
                throw new Error(`composer: app view is not ready`)
              }
              if (
                !res.thread.every(p =>
                  bsky.isType(app.bsky.unspecced.defs.threadItemPost, p.value),
                )
              ) {
                throw new Error(`composer: app view returned non-post items`)
              }
              return res.thread
            },
            1e3,
          )
          postSuccessData = {
            replyToUri: replyTo?.uri,
            posts,
          }
        }
      } catch (waitErr) {
        logger.info(`composer: waiting for app view failed`, {
          safeMessage: waitErr,
        })
      }
    } catch (e) {
      const account = accounts.find(a => a.did === activeAccountDid)
      if (
        account &&
        account.did !== currentAccount?.did &&
        isEphemeralAuthError(e)
      ) {
        showEphemeralError(e, account, () => onPressPublish())
      }
      logger.error(e instanceof Error ? e : String(e), {
        message: `Composer: create post failed`,
        hasImages: filteredThread.posts.some(
          p =>
            p.embed.media?.type === 'images' ||
            p.embed.media?.type === 'gallery',
        ),
      })

      let err = e instanceof Error ? cleanError(e.message) : String(e)
      if (
        e instanceof apilib.ReplyDeletedError ||
        err.includes('not locate record')
      ) {
        err = l`We're sorry! The post you are replying to has been deleted.`
      } else if (e instanceof EmbeddingDisabledError) {
        err = l`This post's author has disabled quote posts.`
      }
      setError(err)
      setIsPublishing(false)
      return
    } finally {
      if (ephemeralAgent && 'dispose' in ephemeralAgent) {
        // @ts-ignore
        ephemeralAgent.dispose()
      }

      if (postUri) {
        let index = 0
        for (let post of filteredThread.posts) {
          ax.metric('post:create', {
            imageCount:
              post.embed.media?.type === 'images' ||
              post.embed.media?.type === 'gallery'
                ? post.embed.media.images.length
                : 0,
            isReply: index > 0 || !!replyTo,
            isPartOfThread: filteredThread.posts.length > 1,
            hasLink: !!post.embed.link,
            hasQuote: !!post.embed.quote,
            langs: fromPostLanguages(currentLanguages),
            logContext: 'Composer',
          })
          index++
        }
      }
      if (filteredThread.posts.length > 1) {
        ax.metric('thread:create', {
          postCount: filteredThread.posts.length,
          isReply: !!replyTo,
        })
      }
      if (postUri) {
        for (const q of linkQueries) {
          const resolved = q.data
          if (
            resolved?.type === 'chat-invite' &&
            bsky.isType(chat.bsky.group.defs.joinLinkPreviewView, resolved.view)
          ) {
            ax.metric('groupchat:inviteLink:shared', {
              convoId: resolved.view.convoId,
              method: 'post',
            })
          }
        }
      }
    }
    if (postUri && !replyTo) {
      emitPostCreated()
    }
    // Clean up draft and its media after successful publish
    if (composerState.draftId && composerState.originalLocalRefs) {
      // Fire draft:post metric
      if (loadedDraftCreatedAt) {
        const draftAgeMs = Date.now() - new Date(loadedDraftCreatedAt).getTime()
        ax.metric('draft:post', {
          draftAgeMs,
          wasEdited: composerState.isDirty,
        })
      }

      logger.debug('post published, cleaning up draft', {
        draftId: composerState.draftId,
        mediaFileCount: composerState.originalLocalRefs.size,
      })
      cleanupPublishedDraft({
        draftId: composerState.draftId,
        originalLocalRefs: composerState.originalLocalRefs,
      })
    }
    setLangPrefs.savePostLanguageToHistory(fromPostLanguages(currentLanguages))
    if (initQuote) {
      // We want to wait for the quote count to update before we call `onPost`, which will refetch data
      void whenAppViewReady(client, initQuote.uri, res => {
        const anchor = res?.thread.at(0)
        if (
          bsky.isType(app.bsky.unspecced.defs.threadItemPost, anchor?.value) &&
          anchor.value.post.quoteCount !== initQuote.quoteCount
        ) {
          onPost?.(postUri, postSuccessData)
          onPostSuccess?.(postSuccessData)
          return true
        }
        return false
      })
    } else {
      onPost?.(postUri, postSuccessData)
      onPostSuccess?.(postSuccessData)
    }
    onClose()
    setTimeout(() => {
      Toast.show(
        <Toast.Outer>
          <Toast.Icon />
          <Toast.Text>
            {filteredThread.posts.length > 1
              ? l`Your posts were sent`
              : replyTo
                ? l`Your reply was sent`
                : l`Your post was sent`}
          </Toast.Text>
          {postUri && (
            <Toast.Action
              label={l`View post`}
              onPress={() => {
                const {host: name, rkey} = new AtUri(postUri)
                navigation.navigate('PostThread', {name, rkey})
              }}>
              <Trans context="Action to view the post the user just created">
                View
              </Trans>
            </Toast.Action>
          )}
        </Toast.Outer>,
        {type: 'success'},
      )
    }, 500)
  }, [
    l,
    ax,
    client,
    chatClient,
    pdsClient,
    canPost,
    isPublishing,
    currentLanguages,
    onClose,
    onPost,
    onPostSuccess,
    initQuote,
    replyTo,
    setPublishOnUpload,
    queryClient,
    navigation,
    composerState.draftId,
    composerState.originalLocalRefs,
    composerState.isDirty,
    cleanupPublishedDraft,
    loadedDraftCreatedAt,
    emptyPostsPromptControl,
    missingAltError,
    missingAltTextPromptControl,
    getFilteredThread,
    currentDid,
    i18n,
    linkQueries,
    setLangPrefs,
    accounts,
    activeAccountDid,
    currentAccount?.did,
    sessionApi,
    showEphemeralError,
  ])

  const handleConfirmSkipEmpty = () => {
    skipEmptyConfirmedRef.current = true
    void onPressPublish()
  }

  const handleConfirmMissingAltText = () => {
    missingAltTextConfirmedRef.current = true
    void onPressPublish()
  }

  // Preserves the referential identity passed to each post item.
  // Avoids re-rendering all posts on each keystroke.
  const onComposerPostPublish = useNonReactiveCallback(() => {
    void onPressPublish()
  })

  useEffect(() => {
    if (publishOnUpload) {
      let erroredVideos = 0
      let uploadingVideos = 0
      for (let post of thread.posts) {
        if (isEmptyPost(post)) continue
        if (post.embed.media?.type === 'video') {
          const video = post.embed.media.video
          if (video.status === 'error') {
            erroredVideos++
          } else if (video.status !== 'done') {
            uploadingVideos++
          }
        }
      }
      if (erroredVideos > 0) {
        setPublishOnUpload(false)
      } else if (uploadingVideos === 0) {
        setPublishOnUpload(false)
        void onPressPublish()
      }
    }
  }, [thread.posts, onPressPublish, publishOnUpload])

  // TODO: It might make more sense to display this error per-post.
  // Right now we're just displaying the first one.
  let erroredVideoPostId: string | undefined
  let erroredVideo: VideoState | NoVideoState = NO_VIDEO
  for (let i = 0; i < thread.posts.length; i++) {
    const post = thread.posts[i]
    if (
      post.embed.media?.type === 'video' &&
      post.embed.media.video.status === 'error'
    ) {
      erroredVideoPostId = post.id
      erroredVideo = post.embed.media.video
      break
    }
  }

  const scrollViewRef = useAnimatedRef<Animated.ScrollView>()
  useEffect(() => {
    if (composerState.mutableNeedsFocusActive) {
      composerState.mutableNeedsFocusActive = false
      // On Android, this risks getting the cursor stuck behind the keyboard.
      // Not worth it.
      if (!IS_ANDROID) {
        textInputRef.current?.focus()
      }
    }
  }, [composerState])

  useEffect(() => {
    // Safari ignores `overscroll-behavior`, so horizontal trackpad swipes over
    // the composer (e.g. on a quote post) can still trigger the browser's
    // back/forward navigation gesture. Suppress predominantly-horizontal wheel
    // events so the history-nav gesture never fires. Chrome and Firefox are
    // covered by the `overscrollBehaviorX: 'contain'` style on the ScrollView.
    if (!IS_WEB_SAFARI) return
    const el =
      scrollViewRef.current?.getScrollableNode() as unknown as HTMLElement | null
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, {passive: false})
    return () => el.removeEventListener('wheel', onWheel)
  }, [scrollViewRef])

  const isLastThreadedPost = thread.posts.length > 1 && nextPost === undefined
  const {
    scrollHandler,
    onScrollViewContentSizeChange,
    onScrollViewLayout,
    topBarAnimatedStyle,
    bottomBarAnimatedStyle,
  } = useScrollTracker({
    scrollViewRef,
    stickyBottom: isLastThreadedPost,
  })

  const keyboardVerticalOffset = useKeyboardVerticalOffset()

  const footer = (
    <>
      <SuggestedLanguage
        text={activePost.richtext.text}
        replyToLanguages={replyToLanguages}
        currentLanguages={currentLanguages}
        onAcceptSuggestedLanguage={setSelectedPostLanguage}
        onNudge={onLanguageNudge}
      />
      <ComposerPills
        isReply={!!replyTo}
        post={activePost}
        thread={composerState.thread}
        dispatch={composerDispatch}
        bottomBarAnimatedStyle={bottomBarAnimatedStyle}
      />
      <ComposerFooter
        post={activePost}
        dispatch={dispatch}
        showAddButton={canAddPost}
        onError={setError}
        onSelectVideo={selectVideo}
        onAddPost={() => {
          composerDispatch({
            type: 'add_post',
          })
        }}
        currentLanguages={currentLanguages}
        onSelectLanguage={onSelectLanguage}
        languageNudgeAt={languageNudgeAt}
        openGallery={openGallery}
        textInputRef={textInputRef}
      />
    </>
  )

  const IS_WEBFooterSticky = !IS_NATIVE && thread.posts.length > 1
  return (
    <BottomSheetPortalProvider>
      <KeyboardAvoidingView
        testID="composePostView"
        behavior={IS_IOS ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
        automaticOffset={IS_IPAD}
        style={[a.flex_1, userStyle('wsky-composer')]}>
        <View
          style={[a.flex_1, viewStyles]}
          aria-modal
          accessibilityViewIsModal>
          <ComposerTopBar
            canPost={canPost}
            isReply={!!replyTo}
            isPublishQueued={publishOnUpload}
            isPublishing={isPublishing}
            isThread={thread.posts.length > 1}
            publishingStage={publishingStage}
            topBarAnimatedStyle={topBarAnimatedStyle}
            onCancel={onPressCancel}
            onPublish={() => void onPressPublish()}
            onSelectDraft={draft => void handleSelectDraft(draft)}
            onSaveDraft={saveCurrentDraft}
            onDiscard={handleClearComposer}
            isEmpty={isComposerEmpty}
            isDirty={composerState.isDirty}
            isEditingDraft={!!composerState.draftId}
            canSaveDraft={allPostsWithinLimit}
            textLength={thread.posts[0].richtext.text.length}>
            {missingAltError && (
              <AltTextReminder
                error={missingAltError}
                thread={thread}
                dispatch={composerDispatch}
              />
            )}
            <ErrorBanner
              error={error}
              videoState={erroredVideo}
              clearError={() => setError('')}
              clearVideo={
                erroredVideoPostId
                  ? () => clearVideo(erroredVideoPostId)
                  : () => {}
              }
            />
          </ComposerTopBar>

          <Animated.ScrollView
            ref={scrollViewRef}
            onScroll={scrollHandler}
            contentContainerStyle={a.flex_grow}
            style={[
              a.flex_1,
              web({
                scrollbarGutter: 'stable',
                scrollbarColor: `${t.palette.contrast_200} transparent`,
                // Prevent horizontal trackpad swipes from triggering the
                // browser's back/forward overscroll-navigation gesture.
                // Handles Chrome and Firefox; Safari is handled separately
                // via a wheel listener since it ignores overscroll-behavior.
                overscrollBehaviorX: 'contain',
              }),
            ]}
            keyboardShouldPersistTaps="always"
            onContentSizeChange={onScrollViewContentSizeChange}
            onLayout={onScrollViewLayout}>
            {replyTo ? <ComposerReplyTo replyTo={replyTo} /> : undefined}
            {thread.posts.map((post, index) => (
              <Fragment key={post.id + (composerState.draftId ?? '')}>
                <ComposerPost
                  post={post}
                  dispatch={composerDispatch}
                  textInputRef={post.id === activePost.id ? textInputRef : null}
                  isFirstPost={index === 0}
                  isLastPost={index === thread.posts.length - 1}
                  isPartOfThread={thread.posts.length > 1}
                  isReply={index > 0 || !!replyTo}
                  isActive={post.id === activePost.id}
                  canRemovePost={thread.posts.length > 1}
                  canMovePostUp={index > 0}
                  canMovePostDown={index < thread.posts.length - 1}
                  canAddPost={post.id === activePost.id && canAddPost}
                  canRemoveQuote={index > 0 || !initQuote}
                  onSelectVideo={selectVideo}
                  onClearVideo={clearVideo}
                  onError={setError}
                  onPublish={onComposerPostPublish}
                  openAccountSwitcher={openAccountSwitcher && index === 0}
                  activeAccountDid={activeAccountDid}
                  setActiveAccountDid={did => {
                    void selectActiveAccount(did)
                  }}
                />
                {IS_WEBFooterSticky && post.id === activePost.id && (
                  <View style={styles.stickyFooterWeb}>{footer}</View>
                )}
              </Fragment>
            ))}
          </Animated.ScrollView>
          {!IS_WEBFooterSticky && footer}
        </View>

        <Prompt.Outer control={discardPromptControl}>
          <Prompt.Content>
            <Prompt.TitleText>
              {allPostsWithinLimit ? (
                composerState.draftId ? (
                  <Trans>Save changes?</Trans>
                ) : (
                  <Trans>Save draft?</Trans>
                )
              ) : (
                <Trans>Discard post?</Trans>
              )}
            </Prompt.TitleText>
            <Prompt.DescriptionText>
              {allPostsWithinLimit ? (
                composerState.draftId ? (
                  <Trans>
                    You have unsaved changes to this draft, would you like to
                    save them?
                  </Trans>
                ) : (
                  <Trans>
                    Would you like to save this as a draft to edit later?
                  </Trans>
                )
              ) : (
                <Trans>You can only save drafts up to 1000 characters.</Trans>
              )}
            </Prompt.DescriptionText>
          </Prompt.Content>
          <Prompt.Actions>
            {allPostsWithinLimit && (
              <Prompt.Action
                cta={composerState.draftId ? l`Save changes` : l`Save draft`}
                onPress={() => void handleSaveDraft()}
                color="primary"
              />
            )}
            <Prompt.Cancel cta={l`Keep editing`} />
            <Prompt.Action
              cta={l`Discard`}
              onPress={handleDiscard}
              color="negative_subtle"
            />
          </Prompt.Actions>
        </Prompt.Outer>

        <Prompt.Basic
          control={emptyPostsPromptControl}
          title={l`Skip empty posts?`}
          description={l`Your thread has empty posts that will be skipped. The remaining posts will be published as a thread.`}
          confirmButtonCta={l`Post anyway`}
          cancelButtonCta={l`Keep editing`}
          onConfirm={handleConfirmSkipEmpty}
        />
        <Prompt.Basic
          control={missingAltTextPromptControl}
          title={l`Post without alt text?`}
          description={missingAltError}
          confirmButtonCta={l`Post anyway`}
          cancelButtonCta={l`Add alt text`}
          onConfirm={handleConfirmMissingAltText}
        />
      </KeyboardAvoidingView>
    </BottomSheetPortalProvider>
  )
}

let ComposerPost = memo(function ComposerPost({
  post,
  dispatch,
  textInputRef,
  isActive,
  isReply,
  isFirstPost,
  isLastPost,
  isPartOfThread,
  canRemovePost,
  canMovePostUp,
  canMovePostDown,
  canAddPost,
  canRemoveQuote,
  onClearVideo,
  onSelectVideo,
  onError,
  onPublish,
  activeAccountDid,
  setActiveAccountDid,
  openAccountSwitcher,
}: {
  post: PostDraft
  dispatch: (action: ComposerAction) => void
  textInputRef: React.RefObject<TextInputRef | null> | null
  isActive: boolean
  isReply: boolean
  isFirstPost: boolean
  isLastPost: boolean
  isPartOfThread: boolean
  canRemovePost: boolean
  canMovePostUp: boolean
  canMovePostDown: boolean
  canAddPost: boolean
  canRemoveQuote: boolean
  onClearVideo: (postId: string) => void
  onSelectVideo: (
    postId: string,
    asset: ImagePickerAsset,
  ) => void | Promise<void>
  onError: (error: string) => void
  onPublish: (richtext: RichText) => void
  activeAccountDid: string
  openAccountSwitcher: boolean
  setActiveAccountDid: (did: string) => void
}) {
  const {t: l} = useLingui()
  const richtext = post.richtext
  const isTextOnly = !post.embed.link && !post.embed.quote && !post.embed.media
  const forceMinHeight = IS_WEB && isTextOnly && isActive
  const selectTextInputPlaceholder = isReply
    ? isFirstPost
      ? l`Write your reply`
      : l`Add another post`
    : l`Anything but skeet`
  const discardPromptControl = Prompt.usePromptControl()

  const enableSquareButtons = useEnableSquareButtons()

  const dispatchPost = useCallback(
    (action: PostAction) => {
      dispatch({
        type: 'update_post',
        postId: post.id,
        postAction: action,
      })
    },
    [dispatch, post.id],
  )
  const onAddPost = useCallback(() => {
    dispatch({type: 'add_post'})
  }, [dispatch])
  const onMovePost = useCallback(
    (direction: 'up' | 'down') => {
      dispatch({type: 'move_post', postId: post.id, direction})
    },
    [dispatch, post.id],
  )

  const postImagesCount =
    post.embed.media?.type === 'images' || post.embed.media?.type === 'gallery'
      ? post.embed.media.images.length
      : 0
  const onImageAdd = useAddImagesWithCap(postImagesCount, dispatchPost)

  const onNewLink = useCallback(
    (uri: string) => {
      dispatchPost({type: 'embed_add_uri', uri: uri as UriString})
    },
    [dispatchPost],
  )

  const onPhotoPasted = useCallback(
    async (uri: string) => {
      if (
        uri.startsWith('data:video/') ||
        (IS_WEB && uri.startsWith('data:image/gif'))
      ) {
        if (IS_NATIVE) return // web only
        const [mimeType] = uri.slice('data:'.length).split(';')
        if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeTypes)) {
          Toast.show(l`Unsupported video type: ${mimeType}`, {
            type: 'error',
          })
          return
        }
        const name = `pasted.${mimeToExt(mimeType)}`
        const file = await fetch(uri)
          .then(res => res.blob())
          .then(blob => new File([blob], name, {type: mimeType}))
        void onSelectVideo(post.id, await getVideoMetadata(file))
      } else {
        const res = await pasteImage(uri)
        onImageAdd([res])
      }
    },
    [post.id, onSelectVideo, onImageAdd, l],
  )

  useHideKeyboardOnBackground()

  return (
    <View
      // Keep focused inputs attached while active-state opacity changes.
      collapsable={false}
      style={[
        a.mx_lg,
        a.mb_sm,
        !isActive && isLastPost && a.mb_lg,
        !isActive && styles.inactivePost,
        isTextOnly && isLastPost && IS_NATIVE && a.flex_grow,
      ]}>
      <View style={[a.flex_row, IS_NATIVE && a.flex_1]}>
        <EphemeralAccountSwitcher
          defaultOpen={openAccountSwitcher}
          selectedDid={activeAccountDid}
          title={l`Post from account`}
          onSelectAccount={account => setActiveAccountDid(account.did)}
          renderTrigger={({currentProfile, triggerProps}) => (
            <Button
              label={triggerProps.accessibilityLabel}
              {...triggerProps}
              style={[
                a.transition_color,
                getShapeStyle(
                  enableSquareButtons,
                  a.rounded_sm,
                  a.rounded_full,
                ),
                a.self_start,
              ]}>
              <UserAvatar
                avatar={currentProfile?.avatar}
                size={42}
                type={currentProfile?.associated?.labeler ? 'labeler' : 'user'}
                style={[a.mt_xs]}
              />
            </Button>
          )}
        />
        <TextInput
          ref={textInputRef}
          style={[a.pt_xs]}
          richtext={richtext}
          placeholder={selectTextInputPlaceholder}
          autoFocus={isActive}
          webForceMinHeight={forceMinHeight}
          // To avoid overlap with the close button:
          hasRightPadding={isPartOfThread}
          isActive={isActive}
          setRichText={rt => {
            dispatchPost({type: 'update_richtext', richtext: rt})
          }}
          onFocus={() => {
            dispatch({
              type: 'focus_post',
              postId: post.id,
            })
          }}
          onPhotoPasted={uri => void onPhotoPasted(uri)}
          onNewLink={onNewLink}
          onError={onError}
          onPressPublish={onPublish}
          canAddPost={canAddPost}
          canMovePostUp={canMovePostUp}
          canMovePostDown={canMovePostDown}
          onBackspaceEmpty={() => {
            if (!canRemovePost || isFirstPost || !isEmptyPost(post)) {
              return false
            }
            dispatch({type: 'remove_post', postId: post.id})
            return true
          }}
          onAddPost={onAddPost}
          onMovePost={onMovePost}
          onFocusPost={direction =>
            dispatch({type: 'focus_adjacent_post', direction})
          }
          accessible={true}
          accessibilityLabel={l`Write post`}
          accessibilityHint={l`Compose posts up to ${plural(
            MAX_GRAPHEME_LENGTH || 0,
            {
              other: '# characters',
            },
          )} in length`}
        />
      </View>

      {canRemovePost && isActive && (
        <>
          <View style={[a.absolute, styles.postControls]}>
            {canMovePostUp && (
              <Button
                label={l`Move post up`}
                accessibilityHint={l`Shortcut: Alt plus Shift plus Up Arrow`}
                size="small"
                color="secondary"
                variant="ghost"
                shape={enableSquareButtons ? 'square' : 'round'}
                style={styles.movePostUp}
                onPress={() => {
                  dispatch({
                    type: 'move_post',
                    postId: post.id,
                    direction: 'up',
                  })
                }}>
                <ButtonIcon icon={ArrowUpIcon} />
              </Button>
            )}
            <Button
              label={l`Delete post`}
              size="small"
              color="secondary"
              variant="ghost"
              shape={enableSquareButtons ? 'square' : 'round'}
              onPress={() => {
                if (
                  post.shortenedGraphemeLength > 0 ||
                  post.embed.media ||
                  post.embed.link ||
                  post.embed.quote
                ) {
                  discardPromptControl.open()
                } else {
                  dispatch({
                    type: 'remove_post',
                    postId: post.id,
                  })
                }
              }}>
              <ButtonIcon icon={XIcon} />
            </Button>
            {canMovePostDown && (
              <Button
                label={l`Move post down`}
                accessibilityHint={l`Shortcut: Alt plus Shift plus Down Arrow`}
                size="small"
                color="secondary"
                variant="ghost"
                shape={enableSquareButtons ? 'square' : 'round'}
                style={styles.movePostDown}
                onPress={() => {
                  dispatch({
                    type: 'move_post',
                    postId: post.id,
                    direction: 'down',
                  })
                }}>
                <ButtonIcon icon={ArrowDownIcon} />
              </Button>
            )}
          </View>
          <Prompt.Basic
            control={discardPromptControl}
            title={l`Discard post?`}
            description={l`Are you sure you'd like to discard this post?`}
            onConfirm={() => {
              dispatch({
                type: 'remove_post',
                postId: post.id,
              })
            }}
            confirmButtonCta={l`Discard`}
            confirmButtonColor="negative"
          />
        </>
      )}

      <ComposerEmbeds
        canRemoveQuote={canRemoveQuote}
        embed={post.embed}
        dispatch={dispatchPost}
        clearVideo={() => onClearVideo(post.id)}
        isActivePost={isActive}
      />
    </View>
  )
})

function ComposerTopBar({
  canPost,
  isReply,
  isPublishQueued,
  isPublishing,
  isThread,
  publishingStage,
  onCancel,
  onPublish,
  onSelectDraft,
  onSaveDraft,
  onDiscard,
  isEmpty,
  isDirty,
  isEditingDraft,
  canSaveDraft,
  textLength,
  topBarAnimatedStyle,
  children,
}: {
  isPublishing: boolean
  publishingStage: string
  canPost: boolean
  isReply: boolean
  isPublishQueued: boolean
  isThread: boolean
  onCancel: () => void
  onPublish: () => void
  onSelectDraft: (draft: DraftSummary) => void
  onSaveDraft: () => Promise<{success: boolean}>
  onDiscard: () => void
  isEmpty: boolean
  isDirty: boolean
  isEditingDraft: boolean
  canSaveDraft: boolean
  textLength: number
  topBarAnimatedStyle: AnimatedStyle<ViewStyle>
  children?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <Animated.View
      style={[topBarAnimatedStyle, userStyle('wsky-composer__topbar')]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_xs,
          IS_LIQUID_GLASS ? [a.px_lg, a.pt_lg, a.pb_md] : [a.p_sm],
        ]}>
        <Button
          label={l`Cancel`}
          variant="ghost"
          color="primary"
          shape="default"
          size="small"
          style={[{paddingLeft: 7, paddingRight: 7}]}
          hoverStyle={[a.bg_transparent, {opacity: 0.5}]}
          onPress={onCancel}
          accessibilityHint={l`Closes post composer and discards post draft`}>
          <ButtonText style={[a.text_md]} maxFontSizeMultiplier={2}>
            <Trans>Cancel</Trans>
          </ButtonText>
        </Button>
        <TextSyntaxHelp />
        <View style={a.flex_1} />
        {isPublishing ? (
          <>
            <Text style={[t.atoms.text_contrast_medium]}>
              {publishingStage}
            </Text>
            <View style={styles.postBtn}>
              <ActivityIndicator color={t.palette.primary_500} />
            </View>
          </>
        ) : (
          <>
            <DraftsButton
              onSelectDraft={onSelectDraft}
              onSaveDraft={onSaveDraft}
              onDiscard={onDiscard}
              isEmpty={isEmpty}
              isDirty={isDirty}
              isEditingDraft={isEditingDraft}
              canSaveDraft={canSaveDraft}
              textLength={textLength}
            />
            <Button
              testID="composerPublishBtn"
              label={
                isReply
                  ? isThread
                    ? l({
                        message: 'Publish replies',
                        comment:
                          'Accessibility label for button to publish multiple replies in a thread',
                      })
                    : l({
                        message: 'Publish reply',
                        comment:
                          'Accessibility label for button to publish a single reply',
                      })
                  : isThread
                    ? l({
                        message: 'Publish posts',
                        comment:
                          'Accessibility label for button to publish multiple posts in a thread',
                      })
                    : l({
                        message: 'Publish post',
                        comment:
                          'Accessibility label for button to publish a single post',
                      })
              }
              color="primary"
              size="small"
              onPress={onPublish}
              disabled={!canPost || isPublishQueued}>
              <ButtonText style={[a.text_md]} maxFontSizeMultiplier={2}>
                {isReply ? (
                  <Trans context="action">Reply</Trans>
                ) : isThread ? (
                  <Trans context="action">Post All</Trans>
                ) : (
                  <Trans context="action">Post</Trans>
                )}
              </ButtonText>
            </Button>
          </>
        )}
      </View>
      {children}
    </Animated.View>
  )
}

function AltTextReminder({
  error,
  thread,
  dispatch,
}: {
  error: string
  thread: ThreadDraft
  dispatch: (action: ComposerAction) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const aiConfigured = useAltTextAiConfigured()
  const aiConfig = useAltTextAiConfig()
  const [isGenerating, setIsGenerating] = useState(false)

  const hasImagesWithoutAlt = useMemo(() => {
    for (const post of thread.posts) {
      const media = post.embed.media
      if (media?.type === 'images' && media.images.some(img => !img.alt)) {
        return true
      }
    }
    return false
  }, [thread])

  const handleGenerateAltText = useCallback(async () => {
    if (!aiConfig) return

    setIsGenerating(true)

    try {
      for (const post of thread.posts) {
        const media = post.embed.media
        if (media?.type === 'images') {
          for (const image of media.images) {
            if (!image.alt) {
              try {
                const imagePath = (image.transformed ?? image.source).path

                let base64: string
                let mimeType: string

                if (IS_WEB) {
                  const response = await fetch(imagePath)
                  const blob = await response.blob()
                  mimeType = blob.type || 'image/jpeg'
                  const arrayBuffer = await blob.arrayBuffer()
                  const uint8Array = new Uint8Array(arrayBuffer)
                  let binary = ''
                  for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i])
                  }
                  base64 = btoa(binary)
                } else {
                  const base64Result = await readAsStringAsync(imagePath, {
                    encoding: EncodingType.Base64,
                  })
                  base64 = base64Result
                  const pathParts = imagePath.split('.')
                  const ext = pathParts[pathParts.length - 1]?.toLowerCase()
                  mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
                }

                const generated = await generateAltText(
                  aiConfig,
                  base64,
                  mimeType,
                )

                dispatch({
                  type: 'update_post',
                  postId: post.id,
                  postAction: {
                    type: 'embed_update_image',
                    image: {
                      ...image,
                      alt: generated.slice(0, MAX_ALT_TEXT),
                    },
                  },
                })
              } catch (err) {
                logger.error('Failed to generate alt text for image', {
                  error: err,
                })
              }
            }
          }
        }
      }
    } finally {
      setIsGenerating(false)
    }
  }, [agent, aiConfig, thread, dispatch])

  return (
    <Admonition type="warning" style={[a.mt_2xs, a.mb_sm, a.mx_lg]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
        <Text style={[a.flex_1]}>{error}</Text>
        {aiConfigured && hasImagesWithoutAlt && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l`Generate alt text`}
            accessibilityHint={l`Automatically generate alt text for images in this post using the configured AI provider.`}
            onPress={() => void handleGenerateAltText()}
            disabled={isGenerating}>
            {isGenerating ? (
              <ActivityIndicator size="small" color={t.palette.primary_500} />
            ) : (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Generate alt text</Trans>
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </Admonition>
  )
}

function ComposerEmbeds({
  embed,
  dispatch,
  clearVideo,
  canRemoveQuote,
  isActivePost,
}: {
  embed: EmbedDraft
  dispatch: (action: PostAction) => void
  clearVideo: () => void
  canRemoveQuote: boolean
  isActivePost: boolean
}) {
  const video = embed.media?.type === 'video' ? embed.media.video : null
  return (
    <>
      {(embed.media?.type === 'images' || embed.media?.type === 'gallery') && (
        <Gallery images={embed.media.images} dispatch={dispatch} />
      )}

      {embed.media?.type === 'gif' && (
        <View style={[a.relative, a.mt_lg]} key={embed.media.gif.url}>
          <ExternalEmbedGif
            gif={embed.media.gif}
            onRemove={() => dispatch({type: 'embed_remove_gif'})}
          />
          <GifAltTextDialog
            gif={embed.media.gif}
            altText={embed.media.alt ?? ''}
            onSubmit={(altText: string) => {
              dispatch({type: 'embed_update_gif', alt: altText})
            }}
          />
        </View>
      )}

      {!embed.media && embed.link && (
        <View style={[a.relative, a.mt_lg]} key={embed.link.uri}>
          <ExternalEmbedLink
            uri={embed.link.uri}
            hasQuote={!!embed.quote}
            onRemove={() => dispatch({type: 'embed_remove_link'})}
          />
        </View>
      )}

      <LayoutAnimationConfig skipExiting>
        {video && (
          <Animated.View
            style={[a.w_full, a.mt_lg]}
            entering={native(ZoomIn)}
            exiting={native(ZoomOut)}>
            {video.asset &&
              (video.status === 'compressing' ? (
                <VideoTranscodeProgress
                  asset={video.asset}
                  progress={videoProgressWithinPhase(
                    'compressing',
                    video.progress,
                  )}
                  clear={clearVideo}
                />
              ) : video.video ? (
                <VideoPreview
                  asset={video.asset}
                  video={video.video}
                  isActivePost={isActivePost}
                  clear={clearVideo}
                />
              ) : null)}
            {!video.asset &&
              video.status === 'done' &&
              'playlistUri' in video && (
                <View style={[a.relative, a.mt_lg]}>
                  <VideoEmbedRedraft
                    blobRef={video.pendingPublish.blobRef}
                    playlistUri={video.playlistUri}
                    aspectRatio={video.redraftDimensions}
                    onRemove={clearVideo}
                  />
                </View>
              )}
            <SubtitleDialogBtn
              defaultAltText={video.altText}
              saveAltText={altText =>
                dispatch({
                  type: 'embed_update_video',
                  videoAction: {
                    type: 'update_alt_text',
                    altText,
                    signal: video.abortController.signal,
                  },
                })
              }
              captions={video.captions}
              // oxlint-disable-next-line typescript/no-explicit-any -- existing composer video API
              setCaptions={(updater: (captions: any[]) => any[]) => {
                dispatch({
                  type: 'embed_update_video',
                  videoAction: {
                    type: 'update_captions',
                    updater,
                    signal: video.abortController.signal,
                  },
                })
              }}
            />
          </Animated.View>
        )}
      </LayoutAnimationConfig>
      {embed.quote?.uri ? (
        <View
          style={[a.pb_sm, video ? [a.pt_md] : [a.pt_xl], IS_WEB && [a.pb_md]]}>
          <View style={[a.relative]}>
            <LazyQuoteEmbed uri={embed.quote.uri} linkDisabled />
            {canRemoveQuote && (
              <ExternalEmbedRemoveBtn
                onRemove={() => dispatch({type: 'embed_remove_quote'})}
                style={{top: 16}}
              />
            )}
          </View>
        </View>
      ) : null}
    </>
  )
}

function ComposerPills({
  isReply,
  thread,
  post,
  dispatch,
  bottomBarAnimatedStyle,
}: {
  isReply: boolean
  thread: ThreadDraft
  post: PostDraft
  dispatch: (action: ComposerAction) => void
  bottomBarAnimatedStyle: AnimatedStyle<ViewStyle>
}) {
  const t = useTheme()
  const media = post.embed.media
  const hasMedia =
    media?.type === 'images' ||
    media?.type === 'gallery' ||
    media?.type === 'gif' ||
    media?.type === 'video'
  const hasLink = !!post.embed.link

  return (
    <Animated.View
      style={[a.flex_row, a.p_sm, t.atoms.bg, bottomBarAnimatedStyle]}>
      <ScrollView
        contentContainerStyle={[a.gap_sm]}
        horizontal={true}
        bounces={false}
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}>
        {
          <ThreadgateBtn
            isReply={isReply}
            postgate={thread.postgate}
            onChangePostgate={nextPostgate => {
              dispatch({type: 'update_postgate', postgate: nextPostgate})
            }}
            threadgateAllowUISettings={thread.threadgate}
            onChangeThreadgateAllowUISettings={nextThreadgate => {
              dispatch({
                type: 'update_threadgate',
                threadgate: nextThreadgate,
              })
            }}
            style={bottomBarAnimatedStyle}
          />
        }
        <TagsBtn
          tags={post.tags}
          onChange={nextTags => {
            dispatch({
              type: 'update_post',
              postId: post.id,
              postAction: {
                type: 'update_tags',
                tags: nextTags,
              },
            })
          }}
        />
        {hasMedia || hasLink ? (
          <LabelsBtn
            labels={post.labels}
            onChange={nextLabels => {
              dispatch({
                type: 'update_post',
                postId: post.id,
                postAction: {
                  type: 'update_labels',
                  labels: nextLabels,
                },
              })
            }}
          />
        ) : null}
      </ScrollView>
    </Animated.View>
  )
}

function ComposerFooter({
  post,
  dispatch,
  showAddButton,
  onSelectVideo,
  onAddPost,
  currentLanguages,
  onSelectLanguage,
  languageNudgeAt,
  openGallery,
  textInputRef,
}: {
  post: PostDraft
  dispatch: (action: PostAction) => void
  showAddButton: boolean
  onError: (error: string) => void
  onSelectVideo: (
    postId: string,
    asset: ImagePickerAsset,
  ) => void | Promise<void>
  onAddPost: () => void
  currentLanguages: string[]
  onSelectLanguage: (language: string) => void
  languageNudgeAt: number
  openGallery?: boolean
  textInputRef: React.RefObject<TextInputRef | null>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtPhone} = useBreakpoints()
  /*
   * Once we've allowed a certain type of asset to be selected, we don't allow
   * other types of media to be selected.
   */
  const [selectedAssetsType, setSelectedAssetsType] = useState<
    AssetType | undefined
  >(undefined)

  const media = post.embed.media
  const images =
    media?.type === 'images' || media?.type === 'gallery' ? media.images : []
  const video = media?.type === 'video' ? media.video : null
  const isMaxImages = images.length >= MAX_GALLERY_IMAGES
  const isMaxVideos = !!video
  let selectedAssetsCount = 0
  let isMediaSelectionDisabled = false

  const enableSquareButtons = useEnableSquareButtons()

  if (media?.type === 'images' || media?.type === 'gallery') {
    isMediaSelectionDisabled = isMaxImages
    selectedAssetsCount = images.length
  } else if (media?.type === 'video') {
    isMediaSelectionDisabled = isMaxVideos
    selectedAssetsCount = 1
  } else {
    isMediaSelectionDisabled = !!media
  }

  const onImageAdd = useAddImagesWithCap(images.length, dispatch)

  const onSelectGif = useCallback(
    (gif: Gif) => {
      dispatch({type: 'embed_add_gif', gif})
    },
    [dispatch],
  )

  /*
   * Reset if the user clears any selected media
   */
  if (selectedAssetsType !== undefined && !media) {
    setSelectedAssetsType(undefined)
  }

  const onSelectAssets = useCallback<SelectMediaButtonProps['onSelectAssets']>(
    async ({type, assets, errors}) => {
      setSelectedAssetsType(type)

      if (assets.length) {
        if (type === 'image') {
          const selectedImages: ComposerImage[] = []

          await Promise.all(
            assets.map(async image => {
              const composerImage = await createComposerImage({
                path: image.uri,
                width: image.width,
                height: image.height,
                mime: image.mimeType!,
              })
              selectedImages.push(composerImage)
            }),
          ).catch(e => {
            logger.error(`createComposerImage failed`, {
              safeMessage: e instanceof Error ? e.message : String(e),
            })
          })

          onImageAdd(selectedImages)
        } else if (type === 'video') {
          void onSelectVideo(post.id, assets[0])
        } else if (type === 'gif') {
          void onSelectVideo(post.id, assets[0])
        }
      }

      errors.map(error => {
        Toast.show(error, {
          type: 'warning',
        })
      })
    },
    [post.id, onSelectVideo, onImageAdd],
  )

  return (
    <View
      style={[
        a.flex_row,
        a.py_xs,
        {paddingLeft: 7, paddingRight: 16},
        a.align_center,
        a.border_t,
        t.atoms.bg,
        t.atoms.border_contrast_medium,
        a.justify_between,
      ]}>
      <View style={[a.flex_row, a.align_center]}>
        <LayoutAnimationConfig skipEntering skipExiting>
          {video && video.status !== 'done' ? (
            <VideoUploadToolbar state={video} />
          ) : (
            <ToolbarWrapper style={[a.flex_row, a.align_center, a.gap_xs]}>
              <SelectMediaButton
                disabled={isMediaSelectionDisabled}
                allowedAssetTypes={selectedAssetsType}
                selectedAssetsCount={selectedAssetsCount}
                onSelectAssets={onSelectAssets}
                autoOpen={openGallery}
              />
              <OpenCameraBtn
                disabled={
                  media?.type === 'images' || media?.type === 'gallery'
                    ? isMaxImages
                    : !!media
                }
                onAdd={onImageAdd}
              />
              <SelectGifBtn onSelectGif={onSelectGif} disabled={!!media} />
              {IS_WEB && gtPhone ? (
                <EmojiPicker.Root nextFocusRef={textInputRef}>
                  <EmojiPicker.Trigger label={l`Open emoji picker`}>
                    {({props}) => (
                      <Button
                        style={a.p_sm}
                        label={props.accessibilityLabel}
                        variant="ghost"
                        shape={enableSquareButtons ? 'square' : 'round'}
                        color="primary"
                        {...props}>
                        <EmojiSmileIcon size="lg" />
                      </Button>
                    )}
                  </EmojiPicker.Trigger>
                  <EmojiPicker.Picker />
                </EmojiPicker.Root>
              ) : null}
            </ToolbarWrapper>
          )}
        </LayoutAnimationConfig>
      </View>
      <View style={[a.flex_row, a.align_center, a.justify_between]}>
        {showAddButton && (
          <Button
            label={l`Add another post to thread`}
            accessibilityHint={l`Shortcut: Alt plus Enter`}
            onPress={onAddPost}
            style={[a.p_sm]}
            variant="ghost"
            shape={enableSquareButtons ? 'square' : 'round'}
            color="primary">
            <PlusIcon size="lg" />
          </Button>
        )}
        <View style={[a.flex_row, a.align_center]}>
          <PostLanguageSelect
            currentLanguages={currentLanguages}
            onSelectLanguage={onSelectLanguage}
            nudgeAt={languageNudgeAt}
          />
        </View>
        <CharProgress
          count={post.shortenedGraphemeLength}
          style={{width: 65}}
        />
      </View>
    </View>
  )
}

export function useComposerCancelRef() {
  return useRef<CancelRef>(null)
}

function useScrollTracker({
  scrollViewRef,
  stickyBottom,
}: {
  scrollViewRef: AnimatedRef<Animated.ScrollView>
  stickyBottom: boolean
}) {
  const t = useTheme()
  const contentOffset = useSharedValue(0)
  const scrollViewHeight = useSharedValue(Infinity)
  const contentHeight = useSharedValue(0)

  const hasScrolledToTop = useDerivedValue(() =>
    withTiming(contentOffset.get() === 0 ? 1 : 0),
  )

  const hasScrolledToBottom = useDerivedValue(() =>
    withTiming(
      contentHeight.get() - contentOffset.get() - 5 <= scrollViewHeight.get()
        ? 1
        : 0,
    ),
  )

  const showHideBottomBorder = useCallback(
    ({
      newContentHeight,
      newContentOffset,
      newScrollViewHeight,
    }: {
      newContentHeight?: number
      newContentOffset?: number
      newScrollViewHeight?: number
    }) => {
      'worklet'
      if (typeof newContentHeight === 'number')
        contentHeight.set(Math.floor(newContentHeight))
      if (typeof newContentOffset === 'number')
        contentOffset.set(Math.floor(newContentOffset))
      if (typeof newScrollViewHeight === 'number')
        scrollViewHeight.set(Math.floor(newScrollViewHeight))
    },
    [contentHeight, contentOffset, scrollViewHeight],
  )

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      'worklet'
      showHideBottomBorder({
        newContentOffset: event.contentOffset.y,
        newContentHeight: event.contentSize.height,
        newScrollViewHeight: event.layoutMeasurement.height,
      })
    },
  })

  const onScrollViewContentSizeChangeUIThread = useCallback(
    (newContentHeight: number) => {
      'worklet'
      const oldContentHeight = contentHeight.get()
      let shouldScrollToBottom = false
      if (stickyBottom && newContentHeight > oldContentHeight) {
        const isFairlyCloseToBottom =
          oldContentHeight - contentOffset.get() - 100 <= scrollViewHeight.get()
        if (isFairlyCloseToBottom) {
          shouldScrollToBottom = true
        }
      }
      showHideBottomBorder({newContentHeight})
      if (shouldScrollToBottom) {
        scrollTo(scrollViewRef, 0, newContentHeight, true)
      }
    },
    [
      showHideBottomBorder,
      scrollViewRef,
      contentHeight,
      stickyBottom,
      contentOffset,
      scrollViewHeight,
    ],
  )

  const onScrollViewContentSizeChange = useCallback(
    (_width: number, height: number) => {
      scheduleOnUI(onScrollViewContentSizeChangeUIThread, height)
    },
    [onScrollViewContentSizeChangeUIThread],
  )

  const onScrollViewLayout = useCallback(
    (evt: LayoutChangeEvent) => {
      showHideBottomBorder({
        newScrollViewHeight: evt.nativeEvent.layout.height,
      })
    },
    [showHideBottomBorder],
  )

  const topBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: interpolateColor(
        hasScrolledToTop.get(),
        [0, 1],
        [t.atoms.border_contrast_medium.borderColor, 'transparent'],
      ),
    }
  })
  const bottomBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: interpolateColor(
        hasScrolledToBottom.get(),
        [0, 1],
        [t.atoms.border_contrast_medium.borderColor, 'transparent'],
      ),
    }
  })

  return {
    scrollHandler,
    onScrollViewContentSizeChange,
    onScrollViewLayout,
    topBarAnimatedStyle,
    bottomBarAnimatedStyle,
  }
}

function useKeyboardVerticalOffset() {
  const insets = useSafeAreaInsets()

  // the keyboardavoidingview has bottom padding to avoid being obscured by the safe area when keyboard is closed.
  // however, this leads to a gap when the keyboard is open. we account for that by subtracting the bottom inset when open.
  let keyboardVerticalOffset = insets.bottom * -1

  // iPad sheets measure their own position via automaticOffset.
  if (IS_IPAD) return keyboardVerticalOffset

  // iOS requires a bit of extra offset to account for the native sheet not being at the top of the screen
  if (IS_IOS) {
    // they ditched the gap behaviour on 26
    if (IS_LIQUID_GLASS) {
      keyboardVerticalOffset += insets.top
    }

    // iPhone SE
    else if (insets.top === 20) {
      keyboardVerticalOffset += 40
    }

    // all other iPhones on <26
    else {
      keyboardVerticalOffset += insets.top + 10
    }
  }

  return keyboardVerticalOffset
}

async function whenAppViewReady(
  client: Client,
  uri: string,
  fn: (
    res: app.bsky.unspecced.getPostThreadV2.$OutputBody | undefined,
    err: unknown,
  ) => boolean,
) {
  await until(
    5, // 5 tries
    1e3, // 1s delay between tries
    fn,
    () =>
      client.call(app.bsky.unspecced.getPostThreadV2, {
        anchor: uri as AtUriString,
        above: false,
        below: 0,
        branchingFactor: 0,
      }),
  )
}

function isEmptyPost(post: PostDraft) {
  return (
    post.richtext.text.trim().length === 0 &&
    !post.embed.media &&
    !post.embed.link &&
    !post.embed.quote
  )
}

function useHideKeyboardOnBackground() {
  const appState = useAppState()

  useEffect(() => {
    if (IS_IOS) {
      if (appState === 'inactive') {
        Keyboard.dismiss()
      }
    }
  }, [appState])
}

const styles = StyleSheet.create({
  postBtn: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginLeft: 12,
  },
  stickyFooterWeb: web({
    position: 'sticky',
    bottom: 0,
  }),
  postControls: {
    top: 0,
    right: 0,
  },
  movePostUp: {
    position: 'absolute',
    top: -33,
  },
  movePostDown: {
    position: 'absolute',
    top: 33,
  },
  errorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red1,
    borderRadius: 6,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  reminderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  errorIcon: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.red4,
    color: colors.red4,
    borderRadius: 30,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  inactivePost: {
    opacity: 0.5,
  },
  addExtLinkBtn: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 10,
    marginBottom: 4,
  },
})

function ErrorBanner({
  error: standardError,
  videoState,
  clearError,
  clearVideo,
}: {
  error: string
  videoState: VideoState | NoVideoState
  clearError: () => void
  clearVideo: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  const enableSquareButtons = useEnableSquareButtons()

  const videoError =
    videoState.status === 'error' ? videoState.error : undefined
  const error = standardError || videoError

  const onClearError = () => {
    if (standardError) {
      clearError()
    } else {
      clearVideo()
    }
  }

  if (!error) return null

  return (
    <Animated.View
      style={[a.px_lg, a.pb_sm]}
      entering={FadeIn}
      exiting={FadeOut}>
      <View
        style={[
          a.px_md,
          a.py_sm,
          a.gap_xs,
          a.rounded_sm,
          t.atoms.bg_contrast_25,
        ]}>
        <View style={[a.relative, a.flex_row, a.gap_sm, {paddingRight: 48}]}>
          <CircleInfoIcon fill={t.palette.negative_400} />
          <Text style={[a.flex_1, a.leading_snug, {paddingTop: 1}]}>
            {error}
          </Text>
          <Button
            label={l`Dismiss error`}
            size="tiny"
            color="secondary"
            variant="ghost"
            shape={enableSquareButtons ? 'square' : 'round'}
            style={[a.absolute, {top: 0, right: 0}]}
            onPress={onClearError}>
            <ButtonIcon icon={XIcon} />
          </Button>
        </View>
        {videoError && videoState.jobId && (
          <Text
            style={[
              {paddingLeft: 28},
              a.text_xs,
              a.font_semi_bold,
              a.leading_snug,
              t.atoms.text_contrast_low,
            ]}>
            <Trans>Job ID: {videoState.jobId}</Trans>
          </Text>
        )}
      </View>
    </Animated.View>
  )
}

function ToolbarWrapper({
  style,
  children,
}: {
  style: StyleProp<ViewStyle>
  children: ReactNode
}) {
  if (IS_WEB) return children
  return (
    <Animated.View
      style={style}
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(400)}>
      {children}
    </Animated.View>
  )
}

function VideoUploadToolbar({state}: {state: VideoState}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const progress = state.progress
  let wheelProgress = progress

  let text = ''

  const isGif = state.video?.mimeType === 'image/gif'

  switch (state.status) {
    case 'compressing':
      if (isGif) {
        text = l`Compressing GIF...`
      } else {
        text = l`Compressing video...`
      }
      break
    case 'uploading':
      if (isGif) {
        text = l`Uploading GIF...`
      } else {
        text = l`Uploading video...`
      }
      break
    case 'processing':
      if (isGif) {
        text = l`Processing GIF...`
      } else {
        text = l`Processing video...`
      }
      break
    case 'error':
      text = l`Error`
      wheelProgress = 1
      break
    case 'done':
      if (isGif) {
        text = l`GIF uploaded`
      } else {
        text = l`Video uploaded`
      }
      break
  }

  return (
    <ToolbarWrapper style={[a.flex_row, a.align_center, {paddingVertical: 5}]}>
      {state.status === 'done' ? (
        <Animated.View
          entering={ZoomIn.duration(300)}
          style={[a.align_center, a.justify_center, {height: 30, width: 30}]}>
          <CircleCheckIcon size="lg" fill={t.palette.primary_500} />
        </Animated.View>
      ) : (
        <ProgressCircle
          size={30}
          borderWidth={1}
          borderColor={t.atoms.border_contrast_low.borderColor}
          color={
            state.status === 'error'
              ? t.palette.negative_500
              : t.palette.primary_500
          }
          progress={wheelProgress}
        />
      )}
      <Text style={[a.font_semi_bold, a.ml_sm]}>{text}</Text>
    </ToolbarWrapper>
  )
}
