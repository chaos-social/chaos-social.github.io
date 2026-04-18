import {useState} from 'react'
import {View} from 'react-native'
import {isDid} from '@atproto/api'
import {type ProfileViewBasic} from '@atproto/api/dist/client/types/app/bsky/actor/defs'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  APPVIEW_DID_PROXY,
  DEFAULT_ALT_TEXT_AI_MODEL,
  DEFAULT_ALT_TEXT_AI_PROMPT,
} from '#/lib/constants'
import {usePalette} from '#/lib/hooks/usePalette'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {dynamicActivate} from '#/locale/i18n'
import {dynamicActivate as dynamicActivateWeb} from '#/locale/i18n.web'
import {type AppLanguage} from '#/locale/languages'
import * as persisted from '#/state/persisted'
import {useGoLinksEnabled, useSetGoLinksEnabled} from '#/state/preferences'
import {
  useConstellationInstance,
  useSetConstellationInstance,
} from '#/state/preferences/constellation-instance'
import {
  useCustomAppViewDid,
  useSetCustomAppViewDid,
} from '#/state/preferences/custom-appview-did'
import {
  useDeerVerificationEnabled,
  useDeerVerificationTrusted,
  useSetDeerVerificationEnabled,
} from '#/state/preferences/deer-verification'
import {
  useDirectFetchRecords,
  useSetDirectFetchRecords,
} from '#/state/preferences/direct-fetch-records'
import {
  useDisableComposerPrompt,
  useSetDisableComposerPrompt,
} from '#/state/preferences/disable-composer-prompt'
import {
  useDisableFollowedByMetrics,
  useSetDisableFollowedByMetrics,
} from '#/state/preferences/disable-followed-by-metrics'
import {
  useDisableFollowersMetrics,
  useSetDisableFollowersMetrics,
} from '#/state/preferences/disable-followers-metrics'
import {
  useDisableFollowingMetrics,
  useSetDisableFollowingMetrics,
} from '#/state/preferences/disable-following-metrics'
import {
  useDisableLikesMetrics,
  useSetDisableLikesMetrics,
} from '#/state/preferences/disable-likes-metrics'
import {
  useDisablePostsMetrics,
  useSetDisablePostsMetrics,
} from '#/state/preferences/disable-posts-metrics'
import {
  useDisableQuotesMetrics,
  useSetDisableQuotesMetrics,
} from '#/state/preferences/disable-quotes-metrics'
import {
  useDisableReplyMetrics,
  useSetDisableReplyMetrics,
} from '#/state/preferences/disable-reply-metrics'
import {
  useDisableRepostsMetrics,
  useSetDisableRepostsMetrics,
} from '#/state/preferences/disable-reposts-metrics'
import {
  useDisableSavesMetrics,
  useSetDisableSavesMetrics,
} from '#/state/preferences/disable-saves-metrics'
import {
  useDisableVerifyEmailReminder,
  useSetDisableVerifyEmailReminder,
} from '#/state/preferences/disable-verify-email-reminder'
import {
  useDisableViaRepostNotification,
  useSetDisableViaRepostNotification,
} from '#/state/preferences/disable-via-repost-notification'
import {
  useDiscoverContextEnabled,
  useSetDiscoverContextEnabled,
} from '#/state/preferences/discover-context-enabled'
import {
  useSetShowExternalShareButtons,
  useShowExternalShareButtons,
} from '#/state/preferences/external-share-buttons'
import {
  useFaviconService,
  useSetFaviconService,
} from '#/state/preferences/favicon-service'
import {
  useHideFeedsPromoTab,
  useSetHideFeedsPromoTab,
} from '#/state/preferences/hide-feeds-promo-tab'
import {
  useHideSimilarAccountsRecomm,
  useSetHideSimilarAccountsRecomm,
} from '#/state/preferences/hide-similar-accounts-recommendations'
import {
  useHideUnreplyablePosts,
  useSetHideUnreplyablePosts,
} from '#/state/preferences/hide-unreplyable-posts'
import {
  useHighQualityImages,
  useSetHighQualityImages,
} from '#/state/preferences/high-quality-images'
import {
  useImageCdnHost,
  useSetImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {
  useNoAppLabelers,
  useSetNoAppLabelers,
} from '#/state/preferences/no-app-labelers'
import {
  useNoDiscoverFallback,
  useSetNoDiscoverFallback,
} from '#/state/preferences/no-discover-fallback'
import {
  useOpenRouterApiKey,
  useOpenRouterConfigured,
  useOpenRouterModel,
  useOpenRouterPrompt,
  useSetOpenRouterApiKey,
  useSetOpenRouterModel,
  useSetOpenRouterPrompt,
} from '#/state/preferences/openrouter'
import {
  usePdsLabelEnabled,
  usePdsLabelHideBskyPds,
  useSetPdsLabelEnabled,
  useSetPdsLabelHideBskyPds,
} from '#/state/preferences/pds-label'
import {
  usePlcDirectory,
  useSetPlcDirectory,
} from '#/state/preferences/plc-directory'
import {
  usePostReplacement,
  useSetPostReplacement,
} from '#/state/preferences/post-name-replacement'
import {
  useRepostCarouselEnabled,
  useSetRepostCarouselEnabled,
} from '#/state/preferences/repost-carousel-enabled'
import {
  useSetShowFollowsYouBadge,
  useShowFollowsYouBadge,
} from '#/state/preferences/show-follows-you-badge'
import {
  useSetShowLinkInHandle,
  useShowLinkInHandle,
} from '#/state/preferences/show-link-in-handle.tsx'
import {
  useSetShowLinkInHandleOnlyOnWorkingLinks,
  useShowLinkInHandleOnlyOnWorkingLinks,
} from '#/state/preferences/show-link-in-handle-only-on-working-links'
import {
  useLibreTranslateInstance,
  useSetLibreTranslateInstance,
  useSetTranslationServicePreference,
  useTranslationServicePreference,
} from '#/state/preferences/translation-service-preference'
import {
  useHandleInLinks,
  useSetHandleInLinks,
} from '#/state/preferences/use-handle-in-links'
import {useProfilesQuery} from '#/state/queries/profile'
import {findService, useDidDocument} from '#/state/queries/resolve-identity'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Atom_Stroke2_Corner0_Rounded as AtomIcon} from '#/components/icons/Atom'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {Eye_Stroke2_Corner0_Rounded as VisibilityIcon} from '#/components/icons/Eye'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {Lab_Stroke2_Corner0_Rounded as BeakerIcon} from '#/components/icons/Lab'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRollerIcon} from '#/components/icons/PaintRoller'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {RaisingHand4Finger_Stroke2_Corner0_Rounded as RaisingHandIcon} from '#/components/icons/RaisingHand'
import {Star_Stroke2_Corner0_Rounded as StarIcon} from '#/components/icons/Star'
import {Verified_Stroke2_Corner2_Rounded as VerifiedIcon} from '#/components/icons/Verified'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {
  useAutoLikeOnRepost,
  useSetAutoLikeOnRepost,
} from '../../state/preferences/auto-like-on-repost.tsx'
import {SearchProfileCard} from '../Search/components/SearchProfileCard'

type Props = NativeStackScreenProps<CommonNavigatorParams>

function ConstellationInstanceDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const constellationInstance = useConstellationInstance()
  const [url, setUrl] = useState(constellationInstance ?? '')
  const setConstellationInstance = useSetConstellationInstance()

  const submit = () => {
    setConstellationInstance(url)
    control.close()
  }

  const shouldDisable = () => {
    try {
      return !new URL(url).hostname.includes('.')
    } catch (e) {
      return true
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setUrl(constellationInstance ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Constellations instance URL`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Constellations instance URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={value => {
              setUrl(value)
            }}
            placeholder={persisted.defaults.constellationInstance}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Input the url of the constellations instance to use`,
            )}
            defaultValue={constellationInstance}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary"
              disabled={shouldDisable()}>
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function CustomAppViewDidDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const [customAppViewDid] = useCustomAppViewDid()
  const [did, setDid] = useState(customAppViewDid ?? '')
  const setCustomAppViewDid = useSetCustomAppViewDid()

  const doc = useDidDocument({did})
  const bskyAppViewService =
    doc.data && findService(doc.data, '#bsky_appview', 'BskyAppView')

  const submit = () => {
    if (did.length === 0) {
      control.close(() => {
        setCustomAppViewDid(undefined)
      })
      return
    }
    if (!bskyAppViewService?.serviceEndpoint) return
    control.close(() => {
      setCustomAppViewDid(did)
    })
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setDid(customAppViewDid ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Custom AppView Proxy DID`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Custom AppView Proxy DID</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={value => {
              setDid(value)
            }}
            placeholder={
              APPVIEW_DID_PROXY?.substring(0, APPVIEW_DID_PROXY.indexOf('#')) ||
              `did:web:api.bsky.app`
            }
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Input the DID of the AppView to proxy requests through`,
            )}
            isInvalid={
              !!did && !bskyAppViewService?.serviceEndpoint && !doc.isLoading
            }
            defaultValue={customAppViewDid ?? ''}
          />

          {did && !isDid(did) && (
            <View>
              <ErrorMessage message={_(msg`must enter a DID`)} />
            </View>
          )}

          {did && (did.includes('#') || did.includes('?')) && (
            <View>
              <ErrorMessage message={_(msg`don't include the service id`)} />
            </View>
          )}

          {doc.isError && (
            <View>
              <ErrorMessage
                message={
                  doc.error.message || _(msg`document resolution failure`)
                }
              />
            </View>
          )}

          {doc.data &&
            !bskyAppViewService &&
            (doc.data as {message?: string}).message && (
              <View>
                <ErrorMessage
                  message={(doc.data as {message: string}).message}
                />
              </View>
            )}

          {doc.data && !bskyAppViewService && (
            <View>
              <ErrorMessage
                message={_(msg`document doesn't contain #bsky_appview service`)}
              />
            </View>
          )}

          {bskyAppViewService && (
            <Text style={[a.text_sm, a.leading_snug]}>
              {JSON.stringify(bskyAppViewService, null, 2)}
            </Text>
          )}

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color={did.length > 0 ? 'primary' : 'secondary'}
              disabled={
                did.length !== 0 && !bskyAppViewService?.serviceEndpoint
              }>
              <ButtonText>
                {did.length > 0 ? <Trans>Save</Trans> : <Trans>Reset</Trans>}
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function FaviconServiceDialog({control}: {control: Dialog.DialogControlProps}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const faviconService = useFaviconService()
  const [url, setUrl] = useState(faviconService ?? '')
  const [inputVersion, setInputVersion] = useState(0)
  const setFaviconService = useSetFaviconService()

  const updateInputValue = (nextUrl: string) => {
    setUrl(nextUrl)
    setInputVersion(v => v + 1)
  }

  const submit = () => {
    setFaviconService(url.trim())
    control.close()
  }

  const shouldDisable = () => {
    return url.length > 0 && !url.includes('(pds)')
  }

  const presets = [
    'https://twenty-icons.com/(pds)',
    'https://favicon.im/(pds)?larger=true&throw-error-on-404=true',
  ]

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => updateInputValue(faviconService ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Favicon Service URL`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Favicon Service URL</Trans>
          </Text>
          <Text style={[a.text_sm, {color: pal.colors.textLight}]}>
            <Trans>
              (pds) is replaced with the domain of an account's host.
            </Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            key={`favicon-service-input-${inputVersion}`}
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={value => setUrl(value)}
            placeholder={persisted.defaults.faviconService}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Enter the favicon service URL with (pds) as placeholder`,
            )}
            defaultValue={url}
          />

          <View style={[a.flex_row, a.flex_wrap, a.mb_xs]}>
            {presets.map(preset => (
              <Button
                key={preset}
                variant="ghost"
                color="primary"
                label={preset}
                style={[a.px_sm, a.py_xs, a.rounded_sm, a.gap_sm]}
                onPress={() => updateInputValue(preset)}>
                <ButtonText>{preset}</ButtonText>
              </Button>
            ))}
          </View>

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary"
              disabled={shouldDisable()}>
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function LibreTranslateInstanceDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const libreTranslateInstance = useLibreTranslateInstance()
  const [url, setUrl] = useState(libreTranslateInstance ?? '')
  const setLibreTranslateInstance = useSetLibreTranslateInstance()

  const submit = () => {
    setLibreTranslateInstance(url)
    control.close()
  }

  const shouldDisable = () => {
    try {
      return !new URL(url).hostname.includes('.')
    } catch (e) {
      return true
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setUrl(libreTranslateInstance ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`LibreTranslate instance URL`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>LibreTranslate instance URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={value => {
              setUrl(value)
            }}
            placeholder={persisted.defaults.libreTranslateInstance}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Input the url of the LibreTranslate instance to use`,
            )}
            defaultValue={libreTranslateInstance}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary"
              disabled={shouldDisable()}>
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function ImageCdnHostDialog({control}: {control: Dialog.DialogControlProps}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const imageCdnHost = useImageCdnHost()
  const [url, setUrl] = useState(imageCdnHost ?? '')
  const setImageCdnHost = useSetImageCdnHost()

  const submit = () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      control.close(() => {
        setImageCdnHost(undefined)
      })
      return
    }

    control.close(() => {
      try {
        setImageCdnHost(new URL(trimmedUrl).origin)
      } catch {
        setImageCdnHost(trimmedUrl)
      }
    })
  }

  const isReset = url.trim().length === 0

  const shouldDisable = () => {
    if (isReset) return false

    try {
      return !new URL(url).hostname.includes('.')
    } catch (e) {
      return true
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setUrl(imageCdnHost ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Image CDN URL`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Image CDN URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={value => {
              setUrl(value)
            }}
            placeholder={persisted.defaults.imageCdnHost}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(msg`Input the URL of the image CDN to use`)}
            defaultValue={imageCdnHost}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={isReset ? _(msg`Reset`) : _(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color={isReset ? 'secondary' : 'primary'}
              disabled={shouldDisable()}>
              <ButtonText>
                {isReset ? <Trans>Reset</Trans> : <Trans>Save</Trans>}
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function PlcDirectoryDialog({control}: {control: Dialog.DialogControlProps}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const plcDirectory = usePlcDirectory()
  const [url, setUrl] = useState(plcDirectory ?? '')
  const setPlcDirectory = useSetPlcDirectory()

  const submit = () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      control.close(() => {
        setPlcDirectory(undefined)
      })
      return
    }

    control.close(() => {
      try {
        setPlcDirectory(new URL(trimmedUrl).origin)
      } catch {
        setPlcDirectory(trimmedUrl)
      }
    })
  }

  const isReset = url.trim().length === 0

  const shouldDisable = () => {
    if (isReset) return false

    try {
      const nextUrl = new URL(url)
      return nextUrl.protocol !== 'https:' && nextUrl.protocol !== 'http:'
    } catch {
      return true
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setUrl(plcDirectory ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`PLC Directory URL`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>PLC Directory URL</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Text input field"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={value => {
              setUrl(value)
            }}
            placeholder={persisted.defaults.plcDirectory}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Input the URL of the PLC directory to use`,
            )}
            defaultValue={plcDirectory}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={isReset ? _(msg`Reset`) : _(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color={isReset ? 'secondary' : 'primary'}
              disabled={shouldDisable()}>
              <ButtonText>
                {isReset ? <Trans>Reset</Trans> : <Trans>Save</Trans>}
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
function PostReplacementDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_, i18n} = useLingui()

  const postReplacement = usePostReplacement()
  const setPostReplacement = useSetPostReplacement()

  const [singular, setSingular] = useState(postReplacement.postName)
  const [plural, setPlural] = useState(postReplacement.postsName)
  const [pluralManuallyEdited, setPluralManuallyEdited] = useState(false)

  const submit = async () => {
    setPostReplacement({
      enabled: singular.trim().toLowerCase() !== 'post',
      postName: singular,
      postsName: plural,
    })

    // Force reload the i18n messages to apply the replacement immediately
    const locale = i18n.locale
    await (IS_WEB
      ? dynamicActivateWeb(locale as AppLanguage)
      : dynamicActivate(locale as AppLanguage))

    control.close()
  }

  const handleSingularChange = (value: string) => {
    setSingular(value)
    if (!pluralManuallyEdited) {
      setPlural(value + 's')
    }
  }

  const handlePluralChange = (value: string) => {
    setPlural(value)
    setPluralManuallyEdited(true)
  }

  const handlePresetSelect = (singularForm: string, pluralForm: string) => {
    setSingular(singularForm)
    setPlural(pluralForm)
    setPluralManuallyEdited(false)
  }

  const shouldDisable = () => {
    return !singular.trim() || !plural.trim()
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => {
        setSingular(postReplacement.postName)
        setPlural(postReplacement.postsName)
        setPluralManuallyEdited(false)
      }}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Custom post phrase`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Custom post phrase</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Singular form"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={handleSingularChange}
            placeholder="skeet"
            placeholderTextColor={pal.colors.textLight}
            accessibilityHint={_(msg`Input the singular form (e.g., "skeet")`)}
            value={singular}
          />

          <View style={[a.flex_row, a.flex_wrap, a.mb_xs]}>
            {[
              {singular: 'post', plural: 'posts'},
              {singular: 'skeet', plural: 'skeets'},
              {singular: 'note', plural: 'notes'},
              {singular: 'woot', plural: 'woots'},
              {singular: 'toot', plural: 'toots'},
              {singular: 'silly', plural: 'sillies'},
            ].map(preset => (
              <Button
                key={preset.singular}
                variant="ghost"
                color="primary"
                label={preset.singular}
                style={[a.px_sm, a.py_xs, a.rounded_sm, a.gap_sm]}
                onPress={() =>
                  handlePresetSelect(preset.singular, preset.plural)
                }>
                <ButtonText>{preset.singular}</ButtonText>
              </Button>
            ))}
          </View>

          <Dialog.Input
            label="Plural form"
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={handlePluralChange}
            placeholder="skeets"
            placeholderTextColor={pal.colors.textLight}
            accessibilityHint={_(msg`Input the plural form (e.g., "skeets")`)}
            value={plural}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary"
              disabled={shouldDisable()}>
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function TrustedVerifiersDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const {_} = useLingui()

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Trusted Verifiers`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Trusted Verifiers</Trans>
          </Text>
        </View>

        <TrustedVerifiers />

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

const TrustedVerifiers = (): React.ReactNode => {
  const trusted = useDeerVerificationTrusted()
  const moderationOpts = useModerationOpts()

  const results = useProfilesQuery({
    handles: Array.from(trusted),
  })

  const {gtMobile} = useBreakpoints()

  return (
    results.data &&
    moderationOpts !== undefined && (
      <View style={[gtMobile ? a.pl_md : a.pl_sm, a.pb_sm]}>
        {results.data.profiles.map(profile => (
          <SearchProfileCard
            key={profile.did}
            profile={profile as ProfileViewBasic}
            moderationOpts={moderationOpts}
          />
        ))}
      </View>
    )
  )
}

function OpenRouterApiKeyDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const apiKey = useOpenRouterApiKey()
  const [value, setValue] = useState(apiKey ?? '')
  const setApiKey = useSetOpenRouterApiKey()

  const submit = () => {
    setApiKey(value.trim() || undefined)
    control.close()
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setValue(apiKey ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`OpenRouter API Key`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>OpenRouter API Key</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="API Key"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={setValue}
            placeholder="sk-or-..."
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Enter your OpenRouter API key for AI alt text generation`,
            )}
            defaultValue={apiKey ?? ''}
            secureTextEntry
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary">
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function OpenRouterModelDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const model = useOpenRouterModel()
  const [value, setValue] = useState(model ?? '')
  const setModel = useSetOpenRouterModel()

  const submit = () => {
    setModel(value.trim() || undefined)
    control.close()
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setValue(model ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`OpenRouter Model`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>OpenRouter Model</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Model"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={setValue}
            placeholder={DEFAULT_ALT_TEXT_AI_MODEL}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={_(
              msg`Enter the model ID to use for alt text generation`,
            )}
            defaultValue={model ?? ''}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary">
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function OpenRouterPromptDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const prompt = useOpenRouterPrompt()
  const [value, setValue] = useState(prompt ?? '')
  const setPrompt = useSetOpenRouterPrompt()

  const submit = () => {
    setPrompt(value.trim() || undefined)
    control.close()
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setValue(prompt ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Alt Text Prompt`)}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Alt Text Prompt</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label="Prompt"
            multiline
            numberOfLines={6}
            style={[
              styles.textInput,
              pal.border,
              pal.text,
              {minHeight: 120, textAlignVertical: 'top'},
            ]}
            onChangeText={setValue}
            placeholder={DEFAULT_ALT_TEXT_AI_PROMPT}
            placeholderTextColor={pal.colors.textLight}
            accessibilityHint={_(
              msg`Enter a custom prompt for AI alt text generation`,
            )}
            defaultValue={prompt ?? ''}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary">
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

export function RunesSettingsScreen({}: Props) {
  const {_} = useLingui()

  const goLinksEnabled = useGoLinksEnabled()
  const setGoLinksEnabled = useSetGoLinksEnabled()

  const directFetchRecords = useDirectFetchRecords()
  const setDirectFetchRecords = useSetDirectFetchRecords()

  const showExternalShareButtons = useShowExternalShareButtons()
  const setShowExternalShareButtons = useSetShowExternalShareButtons()

  const noAppLabelers = useNoAppLabelers()
  const setNoAppLabelers = useSetNoAppLabelers()

  const noDiscoverFallback = useNoDiscoverFallback()
  const setNoDiscoverFallback = useSetNoDiscoverFallback()

  const highQualityImages = useHighQualityImages()
  const setHighQualityImages = useSetHighQualityImages()
  const imageCdnHost = useImageCdnHost()
  const plcDirectory = usePlcDirectory()

  const hideFeedsPromoTab = useHideFeedsPromoTab()
  const setHideFeedsPromoTab = useSetHideFeedsPromoTab()

  const disableViaRepostNotification = useDisableViaRepostNotification()
  const setDisableViaRepostNotification = useSetDisableViaRepostNotification()

  const disableComposerPrompt = useDisableComposerPrompt()
  const setDisableComposerPrompt = useSetDisableComposerPrompt()

  const discoverContextEnabled = useDiscoverContextEnabled()
  const setDiscoverContextEnabled = useSetDiscoverContextEnabled()

  const disableLikesMetrics = useDisableLikesMetrics()
  const setDisableLikesMetrics = useSetDisableLikesMetrics()

  const disableRepostsMetrics = useDisableRepostsMetrics()
  const setDisableRepostsMetrics = useSetDisableRepostsMetrics()

  const disableQuotesMetrics = useDisableQuotesMetrics()
  const setDisableQuotesMetrics = useSetDisableQuotesMetrics()

  const disableSavesMetrics = useDisableSavesMetrics()
  const setDisableSavesMetrics = useSetDisableSavesMetrics()

  const disableReplyMetrics = useDisableReplyMetrics()
  const setDisableReplyMetrics = useSetDisableReplyMetrics()

  const disableFollowersMetrics = useDisableFollowersMetrics()
  const setDisableFollowersMetrics = useSetDisableFollowersMetrics()

  const disableFollowingMetrics = useDisableFollowingMetrics()
  const setDisableFollowingMetrics = useSetDisableFollowingMetrics()

  const disableFollowedByMetrics = useDisableFollowedByMetrics()
  const setDisableFollowedByMetrics = useSetDisableFollowedByMetrics()

  const disablePostsMetrics = useDisablePostsMetrics()
  const setDisablePostsMetrics = useSetDisablePostsMetrics()

  const hideSimilarAccountsRecomm = useHideSimilarAccountsRecomm()
  const setHideSimilarAccountsRecomm = useSetHideSimilarAccountsRecomm()

  const hideUnreplyablePosts = useHideUnreplyablePosts()
  const setHideUnreplyablePosts = useSetHideUnreplyablePosts()

  const disableVerifyEmailReminder = useDisableVerifyEmailReminder()
  const setDisableVerifyEmailReminder = useSetDisableVerifyEmailReminder()

  const constellationInstance = useConstellationInstance()
  const setConstellationInstanceControl = Dialog.useDialogControl()

  const setTrustedVerifiersDialogControl = Dialog.useDialogControl()

  const deerVerificationEnabled = useDeerVerificationEnabled()
  const setDeerVerificationEnabled = useSetDeerVerificationEnabled()

  const pdsLabelEnabled = usePdsLabelEnabled()
  const setPdsLabelEnabled = useSetPdsLabelEnabled()
  const pdsLabelHideBskyPds = usePdsLabelHideBskyPds()
  const setPdsLabelHideBskyPds = useSetPdsLabelHideBskyPds()

  const repostCarouselEnabled = useRepostCarouselEnabled()
  const setRepostCarouselEnabled = useSetRepostCarouselEnabled()

  const showFollowsYouBadge = useShowFollowsYouBadge()
  const setShowFollowsYouBadge = useSetShowFollowsYouBadge()

  const showLinkInHandle = useShowLinkInHandle()
  const setShowLinkInHandle = useSetShowLinkInHandle()
  const showLinkInHandleOnlyOnWorkingLinks =
    useShowLinkInHandleOnlyOnWorkingLinks()
  const setShowLinkInHandleOnlyOnWorkingLinks =
    useSetShowLinkInHandleOnlyOnWorkingLinks()

  const handleInLinks = useHandleInLinks()
  const setHandleInLinks = useSetHandleInLinks()

  const translationServicePreference = useTranslationServicePreference()
  const setTranslationServicePreference = useSetTranslationServicePreference()

  const setLibreTranslateInstanceControl = Dialog.useDialogControl()

  const setImageCdnHostControl = Dialog.useDialogControl()

  const setPlcDirectoryControl = Dialog.useDialogControl()

  const setPostReplacementDialogControl = Dialog.useDialogControl()

  const setOpenRouterApiKeyControl = Dialog.useDialogControl()
  const openRouterModel = useOpenRouterModel()
  const setOpenRouterModelControl = Dialog.useDialogControl()
  const setOpenRouterPromptControl = Dialog.useDialogControl()
  const openRouterConfigured = useOpenRouterConfigured()

  const autoLikeOnRepost = useAutoLikeOnRepost()
  const setAutoLikeOnRepost = useSetAutoLikeOnRepost()

  const [customAppViewDid] = useCustomAppViewDid()
  const setCustomAppViewDidControl = Dialog.useDialogControl()

  const setFaviconServiceControl = Dialog.useDialogControl()

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Runes</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={AtomIcon} />
            <SettingsList.ItemText>
              <Trans>Redirects</Trans>
            </SettingsList.ItemText>
            <Toggle.Item
              name="use_go_links"
              label={_(msg`Redirect through go.bsky.app`)}
              value={goLinksEnabled ?? false}
              onChange={value => setGoLinksEnabled(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Redirect through go.bsky.app</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Toggle.Item
              name="use_handle_in_links"
              label={_(
                msg`Use handles in profile links instead of DIDs (requires restart)`,
              )}
              value={handleInLinks ?? false}
              onChange={value => setHandleInLinks(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Use handles in profile links instead of DIDs</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={VisibilityIcon} />
            <SettingsList.ItemText>
              <Trans>Visibility</Trans>
            </SettingsList.ItemText>
            <Toggle.Item
              name="direct_fetch_records"
              label={_(
                msg`Fetch records directly from PDS to see through quote blocks`,
              )}
              value={directFetchRecords}
              onChange={value => setDirectFetchRecords(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  Fetch records directly from PDS to see contents of blocked and
                  detached quotes
                </Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={ChainLinkIcon} />
            <SettingsList.ItemText>
              <Trans>Bridging and Fediverse</Trans>
            </SettingsList.ItemText>
            <Toggle.Item
              name="external_share_buttons"
              label={_(
                msg`Show "Open original post" and "Open post in PDSls" buttons`,
              )}
              value={showExternalShareButtons}
              onChange={value => setShowExternalShareButtons(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  Show "Open original post" and "Open post in PDSls" buttons
                </Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={VerifiedIcon} />
            <SettingsList.ItemText>
              <Trans>Verification</Trans>
            </SettingsList.ItemText>
            <Toggle.Item
              name="custom_verifications"
              label={_(
                msg`Select your own set of trusted verifiers, and operate as a verifier`,
              )}
              value={deerVerificationEnabled}
              onChange={value => setDeerVerificationEnabled(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  Select your own set of trusted verifiers, and operate as a
                  verifier
                </Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Item>
            <Admonition type="warning" style={[a.flex_1]}>
              <Trans>
                May slow down the client or fail to find all labels. Revoke and
                grant trust in the meatball menu on a profile.{' '}
                {deerVerificationEnabled
                  ? 'You currently'
                  : 'If enabled, you would'}{' '}
                trust the following verifiers:
              </Trans>
            </Admonition>
          </SettingsList.Item>

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={VerifiedIcon} />
            <SettingsList.ItemText>
              <Trans>{`Trusted Verifiers`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={_(msg`View`)}
              onPress={() => setTrustedVerifiersDialogControl.open()}
            />
          </SettingsList.Item>

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={StarIcon} />
            <SettingsList.ItemText>
              <Trans>{`Constellation Instance`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={_(msg`Change`)}
              onPress={() => setConstellationInstanceControl.open()}
            />
          </SettingsList.Item>
          <SettingsList.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Constellation is used to supplement AppView responses for custom
                verifications and nuclear block bypass, via backlinks. Current
                instance:\u00A0
                <InlineLinkText
                  to={constellationInstance}
                  label={constellationInstance}>
                  {constellationInstance}
                </InlineLinkText>
              </Trans>
            </Admonition>
          </SettingsList.Item>

          <SettingsList.Divider />

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={PencilIcon} />
            <SettingsList.ItemText>
              <Trans>{`Custom post phrase`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={_(msg`Change`)}
              onPress={() => setPostReplacementDialogControl.open()}
            />
          </SettingsList.Item>

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={PaintRollerIcon} />
            <SettingsList.ItemText>
              <Trans>Tweaks</Trans>
            </SettingsList.ItemText>
            <Toggle.Item
              name="pds_label_badge"
              label={_(
                msg`Show a PDS badge next to the display name on profiles`,
              )}
              value={pdsLabelEnabled}
              onChange={value => setPdsLabelEnabled(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  Show a PDS badge next to the display name on profiles
                </Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            {pdsLabelEnabled && (
              <Toggle.Item
                name="pds_label_hide_bsky"
                label={_(msg`Hide PDS badge for Bluesky-hosted accounts`)}
                value={pdsLabelHideBskyPds}
                onChange={value => setPdsLabelHideBskyPds(value)}
                style={[a.w_full]}>
                <Toggle.LabelText style={[a.flex_1]}>
                  <Trans>Hide PDS badge for Bluesky-hosted accounts</Trans>
                </Toggle.LabelText>
                <Toggle.Platform />
              </Toggle.Item>
            )}

            <Toggle.Item
              name="repost_carousel"
              label={_(msg`Combine reposts into a horizontal carousel`)}
              value={repostCarouselEnabled}
              onChange={value => setRepostCarouselEnabled(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Combine reposts into a horizontal carousel</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="show_link_in_handle"
              label={_(
                msg`On non-bsky.social handles, show a link to that URL`,
              )}
              value={showLinkInHandle}
              onChange={value => setShowLinkInHandle(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  On non-bsky.social handles, show a link to that URL
                </Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            {showLinkInHandle && (
              <Toggle.Item
                name="show_link_in_handle_only_on_working_links"
                label={_(msg`Only show URL on handles with working links`)}
                value={showLinkInHandleOnlyOnWorkingLinks}
                onChange={value => setShowLinkInHandleOnlyOnWorkingLinks(value)}
                style={[a.w_full]}>
                <Toggle.LabelText style={[a.flex_1]}>
                  <Trans>Only show URL on handles with working links</Trans>
                </Toggle.LabelText>
                <Toggle.Platform />
              </Toggle.Item>
            )}

            <Toggle.Item
              name="no_discover_fallback"
              label={_(msg`Do not fall back to discover feed`)}
              value={noDiscoverFallback}
              onChange={value => setNoDiscoverFallback(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Do not fall back to discover feed</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="high_quality_images"
              label={_(msg`Display images in higher quality`)}
              value={highQualityImages}
              onChange={value => setHighQualityImages(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Display images in higher quality</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Images will be served as PNG instead of WEBP. Images will take
                longer to load and use more bandwidth.
              </Trans>
            </Admonition>
            <Toggle.Item
              name="auto_like_on_repost"
              label={_(msg`Auto-like what you repost`)}
              value={autoLikeOnRepost}
              onChange={value => setAutoLikeOnRepost(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Auto-like what you repost</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Toggle.Item
              name="hide_feeds_promo_tab"
              label={_(msg`Hide "Feeds ✨" tab when only one feed is selected`)}
              value={hideFeedsPromoTab}
              onChange={value => setHideFeedsPromoTab(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  Hide "Feeds ✨" tab when only one feed is selected
                </Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_via_repost_notification"
              label={_(msg`Disable via repost notifications`)}
              value={disableViaRepostNotification}
              onChange={value => setDisableViaRepostNotification(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable via repost notifications</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Forcefully disables the notifications other people receive when
                you like/repost a post someone else has reposted for privacy.
              </Trans>
            </Admonition>

            <Toggle.Item
              name="hide_similar_accounts_recommendations"
              label={_(msg`Hide similar accounts recommendations`)}
              value={hideSimilarAccountsRecomm}
              onChange={value => setHideSimilarAccountsRecomm(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Hide similar accounts recommendations</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="hide_unreplyable_posts"
              label={_(msg`Hide posts that cannot be replied to from feeds`)}
              value={hideUnreplyablePosts}
              onChange={value => setHideUnreplyablePosts(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Hide posts that cannot be replied to from feeds</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Hides posts from feeds where replies are disabled (e.g. due to
                postgates or other restrictions). Does not affect thread views.
              </Trans>
            </Admonition>

            <Toggle.Item
              name="disable_composer_prompt"
              label={_(msg`Disable composer prompt`)}
              value={disableComposerPrompt}
              onChange={value => setDisableComposerPrompt(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable composer prompt</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_verify_email_reminder"
              label={_(msg`Disable verify email reminder`)}
              value={disableVerifyEmailReminder}
              onChange={value => setDisableVerifyEmailReminder(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable verify email reminder</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Admonition type="warning" style={[a.flex_1]}>
              <Trans>
                This only gets rid of the reminder on app launch, useful if your
                PDS does not have email verification setup.\u00A0 This does NOT
                give access to features locked behind email verification.
              </Trans>
            </Admonition>

            <Toggle.Item
              name="discover_context"
              label={_(msg`Show debug context for posts in Discover feed`)}
              value={discoverContextEnabled}
              onChange={value => setDiscoverContextEnabled(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Show debug context for posts in Discover feed</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          {pdsLabelEnabled && (
            <SettingsList.Item>
              <SettingsList.ItemIcon icon={StarIcon} />
              <SettingsList.ItemText>
                <Trans>Favicon service</Trans>
              </SettingsList.ItemText>
              <SettingsList.BadgeButton
                label={_(msg`Change`)}
                onPress={() => setFaviconServiceControl.open()}
              />
            </SettingsList.Item>
          )}

          <SettingsList.Divider />

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>Post Translation Provider</Trans>
            </SettingsList.ItemText>

            <Toggle.Item
              name="service_google"
              label={_(msg`Use Google Translate`)}
              value={translationServicePreference === 'google'}
              onChange={() => setTranslationServicePreference('google')}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Use Google Translate</Trans>
              </Toggle.LabelText>
              <Toggle.Radio />
            </Toggle.Item>

            <Toggle.Item
              name="service_kagi"
              label={_(msg`Use Kagi Translate`)}
              value={translationServicePreference === 'kagi'}
              onChange={() => setTranslationServicePreference('kagi')}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Use Kagi Translate</Trans>
              </Toggle.LabelText>
              <Toggle.Radio />
            </Toggle.Item>

            <Toggle.Item
              name="service_papago"
              label={_(msg`Use Naver Papago`)}
              value={translationServicePreference === 'papago'}
              onChange={() => setTranslationServicePreference('papago')}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Use Naver Papago</Trans>
              </Toggle.LabelText>
              <Toggle.Radio />
            </Toggle.Item>

            <Toggle.Item
              name="service_libreTranslate"
              label={_(msg`Use LibreTranslate`)}
              value={translationServicePreference === 'libreTranslate'}
              onChange={() => setTranslationServicePreference('libreTranslate')}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Use LibreTranslate</Trans>
              </Toggle.LabelText>
              <Toggle.Radio />
            </Toggle.Item>
          </SettingsList.Group>

          {translationServicePreference === 'libreTranslate' && (
            <SettingsList.Item>
              <SettingsList.ItemIcon icon={EarthIcon} />
              <SettingsList.ItemText>
                <Trans>{`LibreTranslate Instance`}</Trans>
              </SettingsList.ItemText>
              <SettingsList.BadgeButton
                label={_(msg`Change`)}
                onPress={() => setLibreTranslateInstanceControl.open()}
              />
            </SettingsList.Item>
          )}

          <SettingsList.Divider />

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={BeakerIcon} />
            <SettingsList.ItemText>
              <Trans>OpenRouter API Key</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={openRouterConfigured ? _(msg`Change`) : _(msg`Set`)}
              onPress={() => setOpenRouterApiKeyControl.open()}
            />
          </SettingsList.Item>

          <SettingsList.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Set your OpenRouter API key to enable AI-powered alt text
                generation for images in the composer. Get an API key at{' '}
                <InlineLinkText
                  to="https://openrouter.ai"
                  label="openrouter.ai">
                  openrouter.ai
                </InlineLinkText>
              </Trans>
            </Admonition>
          </SettingsList.Item>

          {openRouterConfigured && (
            <SettingsList.Item>
              <SettingsList.ItemIcon icon={BeakerIcon} />
              <SettingsList.ItemText>
                <Trans>{`OpenRouter Model`}</Trans>
              </SettingsList.ItemText>
              <SettingsList.BadgeButton
                label={_(msg`Change`)}
                onPress={() => setOpenRouterModelControl.open()}
              />
            </SettingsList.Item>
          )}

          {openRouterConfigured && (
            <SettingsList.Item>
              <Admonition type="info" style={[a.flex_1]}>
                <Trans>
                  Current model: {openRouterModel ?? DEFAULT_ALT_TEXT_AI_MODEL}.{' '}
                  <InlineLinkText
                    to="https://openrouter.ai/models?fmt=cards&input_modalities=image&order=most-popular"
                    label="openrouter.ai">
                    Search models
                  </InlineLinkText>
                </Trans>
              </Admonition>
            </SettingsList.Item>
          )}

          {openRouterConfigured && (
            <SettingsList.Item>
              <SettingsList.ItemIcon icon={BeakerIcon} />
              <SettingsList.ItemText>
                <Trans>Alt Text Prompt</Trans>
              </SettingsList.ItemText>
              <SettingsList.BadgeButton
                label={_(msg`Change`)}
                onPress={() => setOpenRouterPromptControl.open()}
              />
            </SettingsList.Item>
          )}

          {openRouterConfigured && (
            <SettingsList.Item>
              <Admonition type="info" style={[a.flex_1]}>
                <Trans>
                  Customize the prompt sent to the AI model when generating alt
                  text. Leave empty to use the default prompt.
                </Trans>
              </Admonition>
            </SettingsList.Item>
          )}

          <SettingsList.Divider />

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={VisibilityIcon} />
            <SettingsList.ItemText>
              <Trans>Metrics</Trans>
            </SettingsList.ItemText>

            <Toggle.Item
              name="disable_likes_metrics"
              label={_(msg`Disable likes metrics`)}
              value={disableLikesMetrics}
              onChange={value => setDisableLikesMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable likes metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_reposts_metrics"
              label={_(msg`Disable reposts metrics`)}
              value={disableRepostsMetrics}
              onChange={value => setDisableRepostsMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable reposts metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_quotes_metrics"
              label={_(msg`Disable quotes metrics`)}
              value={disableQuotesMetrics}
              onChange={value => setDisableQuotesMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable quotes metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_saves_metrics"
              label={_(msg`Disable saves metrics`)}
              value={disableSavesMetrics}
              onChange={value => setDisableSavesMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable saves metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_reply_metrics"
              label={_(msg`Disable reply metrics`)}
              value={disableReplyMetrics}
              onChange={value => setDisableReplyMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable reply metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_followers_metrics"
              label={_(msg`Disable followers metrics`)}
              value={disableFollowersMetrics}
              onChange={value => setDisableFollowersMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable followers metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_following_metrics"
              label={_(msg`Disable following metrics`)}
              value={disableFollowingMetrics}
              onChange={value => setDisableFollowingMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable following metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_followed_by_metrics"
              label={_(msg`Disable "followed by" metrics`)}
              value={disableFollowedByMetrics}
              onChange={value => setDisableFollowedByMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable "followed by" metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="show_follows_you_badge"
              label={_(msg`Show "Follows you" badge`)}
              value={showFollowsYouBadge}
              onChange={value => setShowFollowsYouBadge(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Show "Follows you" badge</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

            <Toggle.Item
              name="disable_posts_metrics"
              label={_(msg`Disable post counts metrics`)}
              value={disablePostsMetrics}
              onChange={value => setDisablePostsMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable post counts metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Divider />

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>{`Image CDN`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={_(msg`Change`)}
              onPress={() => setImageCdnHostControl.open()}
            />
          </SettingsList.Item>
          <SettingsList.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Override the CDN host for all images. Current: 
                <InlineLinkText to={imageCdnHost} label={imageCdnHost}>
                  {imageCdnHost}
                </InlineLinkText>
              </Trans>
            </Admonition>
          </SettingsList.Item>

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>{`PLC Directory`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={_(msg`Change`)}
              onPress={() => setPlcDirectoryControl.open()}
            />
          </SettingsList.Item>
          <SettingsList.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Override the PLC directory used to resolve DIDs. Current: 
                <InlineLinkText to={plcDirectory} label={plcDirectory}>
                  {plcDirectory}
                </InlineLinkText>
              </Trans>
            </Admonition>
          </SettingsList.Item>

          <SettingsList.Divider />

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={StarIcon} />
            <SettingsList.ItemText>
              <Trans>{`Custom AppView DID`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={customAppViewDid ? _(msg`Change`) : _(msg`Set`)}
              onPress={() => setCustomAppViewDidControl.open()}
            />
          </SettingsList.Item>

          <SettingsList.Divider />

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={RaisingHandIcon} />
            <SettingsList.ItemText>
              <Trans>Labelers</Trans>
            </SettingsList.ItemText>
            <Toggle.Item
              name="no_app_labelers"
              label={_(msg`Do not declare any app labelers`)}
              value={noAppLabelers}
              onChange={value => setNoAppLabelers(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Do not declare any default app labelers</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Item>
            <Admonition type="warning" style={[a.flex_1]}>
              <Trans>Restart the app after changing this setting.</Trans>
            </Admonition>
          </SettingsList.Item>
          <SettingsList.Item>
            <Admonition type="tip" style={[a.flex_1]}>
              <Trans>
                Some App Views will default to using an app labeler if you have
                no labelers, so consider subscribing to at least one labeler if
                you have issues.
              </Trans>
            </Admonition>
          </SettingsList.Item>
          <SettingsList.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                App labelers are mandatory top-level labelers that can perform
                "takedowns". This setting does not influence geolocation-based
                labelers.
              </Trans>
            </Admonition>
          </SettingsList.Item>
        </SettingsList.Container>
      </Layout.Content>
      <ConstellationInstanceDialog control={setConstellationInstanceControl} />
      <CustomAppViewDidDialog control={setCustomAppViewDidControl} />
      <FaviconServiceDialog control={setFaviconServiceControl} />
      <TrustedVerifiersDialog control={setTrustedVerifiersDialogControl} />
      <LibreTranslateInstanceDialog
        control={setLibreTranslateInstanceControl}
      />
      <ImageCdnHostDialog control={setImageCdnHostControl} />
      <PlcDirectoryDialog control={setPlcDirectoryControl} />
      <PostReplacementDialog control={setPostReplacementDialogControl} />
      <OpenRouterApiKeyDialog control={setOpenRouterApiKeyControl} />
      <OpenRouterModelDialog control={setOpenRouterModelControl} />
      <OpenRouterPromptDialog control={setOpenRouterPromptControl} />
    </Layout.Screen>
  )
}

const styles = {
  textInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
}
