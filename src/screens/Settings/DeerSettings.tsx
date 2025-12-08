import {useState} from 'react'
import {View} from 'react-native'
import {isDid} from '@atproto/api'
import {type ProfileViewBasic} from '@atproto/api/dist/client/types/app/bsky/actor/defs'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {APPVIEW_DID_PROXY} from '#/lib/constants'
import {usePalette} from '#/lib/hooks/usePalette'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {type Gate} from '#/lib/statsig/gates'
import {
  resetDeerGateCache,
  useDangerousSetGate,
  useGatesCache,
} from '#/lib/statsig/statsig'
import {isWeb} from '#/platform/detection'
import * as persisted from '#/state/persisted'
import {useGoLinksEnabled, useSetGoLinksEnabled} from '#/state/preferences'
import {
  useConstellationInstance,
  useSetConstellationInstance,
} from '#/state/preferences/constellation-instance'
import {useCustomAppViewDid} from '#/state/preferences/custom-appview-did'
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
  useSetShowExternalShareButtons,
  useShowExternalShareButtons,
} from '#/state/preferences/external-share-buttons'
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
  useRenderMastodonHtml,
  useSetRenderMastodonHtml,
} from '#/state/preferences/render-mastodon-html'
import {
  useRepostCarouselEnabled,
  useSetRepostCarouselEnabled,
} from '#/state/preferences/repost-carousel-enabled'
import {
  useSetShowLinkInHandle,
  useShowLinkInHandle,
} from '#/state/preferences/show-link-in-handle.tsx'
import {useProfilesQuery} from '#/state/queries/profile'
import {findService, useDidDocument} from '#/state/queries/resolve-identity'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Atom_Stroke2_Corner0_Rounded as DeerIcon} from '#/components/icons/Atom'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {Eye_Stroke2_Corner0_Rounded as VisibilityIcon} from '#/components/icons/Eye'
import {Lab_Stroke2_Corner0_Rounded as BeakerIcon} from '#/components/icons/Lab'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRollerIcon} from '#/components/icons/PaintRoller'
import {RaisingHand4Finger_Stroke2_Corner0_Rounded as RaisingHandIcon} from '#/components/icons/RaisingHand'
import {Star_Stroke2_Corner0_Rounded as StarIcon} from '#/components/icons/Star'
import {Verified_Stroke2_Corner2_Rounded as VerifiedIcon} from '#/components/icons/Verified'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {SearchProfileCard} from '../Search/components/SearchProfileCard'
type Props = NativeStackScreenProps<CommonNavigatorParams>

function ConstellationInstanceDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {_} = useLingui()

  const [url, setUrl] = useState('')
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
      onClose={() => setUrl('')}>
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
          />

          <View style={isWeb && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={submit}
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

  const [did, setDid] = useState('')
  const [, setCustomAppViewDid] = useCustomAppViewDid()

  const doc = useDidDocument({did})
  const bskyAppViewService =
    doc.data && findService(doc.data, '#bsky_appview', 'BskyAppView')

  const submit = () => {
    if (did.length === 0) {
      setCustomAppViewDid(undefined)
      control.close()
      return
    }
    if (!bskyAppViewService?.serviceEndpoint) return
    setCustomAppViewDid(did)
    control.close()
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setDid('')}>
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

          <View style={isWeb && [a.flex_row, a.justify_end]}>
            <Button
              label={_(msg`Save`)}
              size="large"
              onPress={submit}
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

export function DeerSettingsScreen({}: Props) {
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

  const hideFeedsPromoTab = useHideFeedsPromoTab()
  const setHideFeedsPromoTab = useSetHideFeedsPromoTab()

  const disableViaRepostNotification = useDisableViaRepostNotification()
  const setDisableViaRepostNotification = useSetDisableViaRepostNotification()

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

  const renderMastodonHtml = useRenderMastodonHtml()
  const setRenderMastodonHtml = useSetRenderMastodonHtml()

  const disableVerifyEmailReminder = useDisableVerifyEmailReminder()
  const setDisableVerifyEmailReminder = useSetDisableVerifyEmailReminder()

  const constellationInstance = useConstellationInstance()
  const setConstellationInstanceControl = Dialog.useDialogControl()

  const setTrustedVerifiersDialogControl = Dialog.useDialogControl()

  const deerVerificationEnabled = useDeerVerificationEnabled()
  const setDeerVerificationEnabled = useSetDeerVerificationEnabled()

  const repostCarouselEnabled = useRepostCarouselEnabled()
  const setRepostCarouselEnabled = useSetRepostCarouselEnabled()

  const showLinkInHandle = useShowLinkInHandle()
  const setShowLinkInHandle = useSetShowLinkInHandle()

  const [gates, setGatesView] = useState(Object.fromEntries(useGatesCache()))
  const dangerousSetGate = useDangerousSetGate()
  const setGate = (gate: Gate, value: boolean) => {
    dangerousSetGate(gate, value)
    setGatesView({
      ...gates,
      [gate]: value,
    })
  }
  const [customAppViewDid] = useCustomAppViewDid()
  const setCustomAppViewDidControl = Dialog.useDialogControl()

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Experiments</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={DeerIcon} />
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
                  detatched quotes
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
                msg`Show "Open original skeet" and "Open skeet in PDSls" buttons`,
              )}
              value={showExternalShareButtons}
              onChange={value => setShowExternalShareButtons(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>
                  Show "Open original skeet" and "Open skeet in PDSls" buttons
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
                instance: {constellationInstance}
              </Trans>
            </Admonition>
          </SettingsList.Item>

          <SettingsList.Item>
            <SettingsList.ItemIcon icon={StarIcon} />
            <SettingsList.ItemText>
              <Trans>{`Custom AppView DID`}</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeButton
              label={customAppViewDid ? _(msg`Set`) : _(msg`Change`)}
              onPress={() => setCustomAppViewDidControl.open()}
            />
          </SettingsList.Item>
          <SettingsList.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Restart app after changing your AppView.
                {customAppViewDid && _(` Currently ${customAppViewDid}`)}
              </Trans>
            </Admonition>
          </SettingsList.Item>

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={PaintRollerIcon} />
            <SettingsList.ItemText>
              <Trans>Tweaks</Trans>
            </SettingsList.ItemText>

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

            <Toggle.Item
              name="repost_carousel"
              label={_(msg`Combine reskeets into a horizontal carousel`)}
              value={repostCarouselEnabled}
              onChange={value => setRepostCarouselEnabled(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Combine reskeets into a horizontal carousel</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>

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
                Images will be served as PNG instead of JPEG. Images will take
                longer to load and use more bandwidth.
              </Trans>
            </Admonition>

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
              label={_(msg`Disable "via reskeet" notifications`)}
              value={disableViaRepostNotification}
              onChange={value => setDisableViaRepostNotification(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable "via reskeet" notifications</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                Forcefully disables the notifications other people receive when
                you like/reskeet a skeet someone else has reskeeted for privacy.
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
              name="render_mastodon_html"
              label={_(msg`Render Mastodon HTML from bridged posts`)}
              value={renderMastodonHtml}
              onChange={value => setRenderMastodonHtml(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Render Mastodon HTML from bridged posts</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Admonition type="info" style={[a.flex_1]}>
              <Trans>
                When enabled, posts bridged from Mastodon will display their
                original HTML formatting instead of the plain text version.
              </Trans>
            </Admonition>

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
                PDS does not have email verification setup.\nThis does NOT give
                access to features locked behind email verification.
              </Trans>
            </Admonition>
          </SettingsList.Group>

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
              label={_(msg`Disable reskeets metrics`)}
              value={disableRepostsMetrics}
              onChange={value => setDisableRepostsMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable reskeets metrics</Trans>
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
              name="disable_posts_metrics"
              label={_(msg`Disable skeets metrics`)}
              value={disablePostsMetrics}
              onChange={value => setDisablePostsMetrics(value)}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Disable skeets metrics</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
          </SettingsList.Group>

          <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
            <SettingsList.ItemIcon icon={BeakerIcon} />
            <SettingsList.ItemText>
              <Trans>Gates</Trans>
            </SettingsList.ItemText>
            {Object.entries(gates).map(([gate, status]) => (
              <Toggle.Item
                key={gate}
                name={gate}
                label={gate}
                value={status}
                onChange={value => setGate(gate as Gate, value)}
                style={[a.w_full]}>
                <Toggle.LabelText style={[a.flex_1]}>{gate}</Toggle.LabelText>
                <Toggle.Platform />
              </Toggle.Item>
            ))}
            <SettingsList.BadgeButton
              label={_(msg`Reset gates`)}
              onPress={() => {
                resetDeerGateCache()
                setGatesView({})
              }}
            />
          </SettingsList.Group>

          <SettingsList.Item>
            <Admonition type="warning" style={[a.flex_1]}>
              <Trans>
                These settings might summon nasal demons! Restart the app after
                changing if anything breaks.
              </Trans>
            </Admonition>
          </SettingsList.Item>

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
      <TrustedVerifiersDialog control={setTrustedVerifiersDialogControl} />
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
