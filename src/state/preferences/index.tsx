import {Provider as AltTextRequiredProvider} from './alt-text-required'
import {Provider as AutoLikeOnRepostProvider} from './auto-like-on-repost'
import {Provider as AutoplayProvider} from './autoplay'
import {Provider as ConstellationProvider} from './constellation-enabled'
import {Provider as ConstellationInstanceProvider} from './constellation-instance'
import {Provider as DeerVerificationProvider} from './deer-verification'
import {Provider as DirectFetchRecordsProvider} from './direct-fetch-records'
import {Provider as DisableComposerPromptProvider} from './disable-composer-prompt'
import {Provider as DisableFollowedByMetricsProvider} from './disable-followed-by-metrics'
import {Provider as DisableFollowersMetricsProvider} from './disable-followers-metrics'
import {Provider as DisableFollowingMetricsProvider} from './disable-following-metrics'
import {Provider as DisableHapticsProvider} from './disable-haptics'
import {Provider as DisableLikesMetricsProvider} from './disable-likes-metrics'
import {Provider as DisablePostsMetricsProvider} from './disable-posts-metrics'
import {Provider as DisableQuotesMetricsProvider} from './disable-quotes-metrics'
import {Provider as DisableReplyMetricsProvider} from './disable-reply-metrics'
import {Provider as DisableRepostsMetricsProvider} from './disable-reposts-metrics'
import {Provider as DisableSavesMetricsProvider} from './disable-saves-metrics'
import {Provider as DisableVerifyEmailReminderProvider} from './disable-verify-email-reminder'
import {Provider as DisableViaRepostNotificationProvider} from './disable-via-repost-notification'
import {Provider as DiscoverContextEnabledProvider} from './discover-context-enabled'
import {Provider as EnableSquareAvatarsProvider} from './enable-square-avatars'
import {Provider as EnableSquareButtonsProvider} from './enable-square-buttons'
import {Provider as ExternalEmbedsProvider} from './external-embeds-prefs'
import {Provider as ExternalShareButtonsProvider} from './external-share-buttons'
import {Provider as FaviconServiceProvider} from './favicon-service'
import {Provider as GoLinksProvider} from './go-links-enabled'
import {Provider as HiddenPostsProvider} from './hidden-posts'
import {Provider as HideFeedsPromoTabProvider} from './hide-feeds-promo-tab'
import {Provider as HideSimilarAccountsRecommProvider} from './hide-similar-accounts-recommendations'
import {Provider as HideUnreplyablePostsProvider} from './hide-unreplyable-posts'
import {Provider as HighQualityImagesProvider} from './high-quality-images'
import {Provider as ImageCdnHostProvider} from './image-cdn-host'
import {Provider as InAppBrowserProvider} from './in-app-browser'
import {Provider as KawaiiProvider} from './kawaii'
import {Provider as LanguagesProvider} from './languages'
import {Provider as LargeAltBadgeProvider} from './large-alt-badge'
import {Provider as NoAppLabelersProvider} from './no-app-labelers'
import {Provider as NoDiscoverProvider} from './no-discover-fallback'
import {Provider as OpenRouterProvider} from './openrouter'
import {Provider as PdsLabelProvider} from './pds-label'
import {Provider as PlcDirectoryProvider} from './plc-directory'
import {Provider as PostNameReplacementProvider} from './post-name-replacement.tsx'
import {Provider as RepostCarouselProvider} from './repost-carousel-enabled'
import {Provider as ShowFollowsYouBadgeProvider} from './show-follows-you-badge'
import {Provider as ShowLinkInHandleProvider} from './show-link-in-handle'
import {Provider as ShowLinkInHandleOnlyOnWorkingLinksProvider} from './show-link-in-handle-only-on-working-links'
import {Provider as SubtitlesProvider} from './subtitles'
import {Provider as TranslationServicePreferenceProvider} from './translation-service-preference'
import {Provider as TrendingSettingsProvider} from './trending'
import {Provider as UseHandleInLinksProvider} from './use-handle-in-links'
import {Provider as UsedStarterPacksProvider} from './used-starter-packs'

export {
  useRequireAltTextEnabled,
  useSetRequireAltTextEnabled,
} from './alt-text-required'
export {useAutoplayDisabled, useSetAutoplayDisabled} from './autoplay'
export {
  useDisableComposerPrompt,
  useSetDisableComposerPrompt,
} from './disable-composer-prompt'
export {useHapticsDisabled, useSetHapticsDisabled} from './disable-haptics'
export {
  useDiscoverContextEnabled,
  useSetDiscoverContextEnabled,
} from './discover-context-enabled'
export {
  useExternalEmbedsPrefs,
  useSetExternalEmbedPref,
} from './external-embeds-prefs'
export {useFaviconService, useSetFaviconService} from './favicon-service'
export {useGoLinksEnabled, useSetGoLinksEnabled} from './go-links-enabled'
export {useHiddenPosts, useHiddenPostsApi} from './hidden-posts'
export {
  useHideFeedsPromoTab,
  useSetHideFeedsPromoTab,
} from './hide-feeds-promo-tab'
export {useImageCdnHost, useSetImageCdnHost} from './image-cdn-host'
export {useLabelDefinitions} from './label-defs'
export {useLanguagePrefs, useLanguagePrefsApi} from './languages'
export {
  useOpenRouterApiKey,
  useOpenRouterConfigured,
  useOpenRouterModel,
  useSetOpenRouterApiKey,
  useSetOpenRouterModel,
} from './openrouter'
export {
  readPlcDirectory,
  usePlcDirectory,
  useSetPlcDirectory,
} from './plc-directory'
export {useSetSubtitlesEnabled, useSubtitlesEnabled} from './subtitles'
export {
  useSetTranslationServicePreference,
  useTranslationServicePreference,
} from './translation-service-preference'

export function Provider({children}: React.PropsWithChildren<{}>) {
  return (
    <LanguagesProvider>
      <AltTextRequiredProvider>
        <AutoLikeOnRepostProvider>
          <ExternalShareButtonsProvider>
            <GoLinksProvider>
              <NoAppLabelersProvider>
                <DirectFetchRecordsProvider>
                  <ConstellationProvider>
                    <ConstellationInstanceProvider>
                      <DeerVerificationProvider>
                        <FaviconServiceProvider>
                          <PdsLabelProvider>
                            <NoDiscoverProvider>
                              <ShowLinkInHandleProvider>
                                <ShowLinkInHandleOnlyOnWorkingLinksProvider>
                                  <UseHandleInLinksProvider>
                                    <LargeAltBadgeProvider>
                                      <ExternalEmbedsProvider>
                                        <HiddenPostsProvider>
                                          <HighQualityImagesProvider>
                                            <ImageCdnHostProvider>
                                              <PlcDirectoryProvider>
                                                <InAppBrowserProvider>
                                                  <DisableHapticsProvider>
                                                    <AutoplayProvider>
                                                      <UsedStarterPacksProvider>
                                                        <SubtitlesProvider>
                                                          <TrendingSettingsProvider>
                                                            <RepostCarouselProvider>
                                                              <KawaiiProvider>
                                                                <HideFeedsPromoTabProvider>
                                                                  <DisableViaRepostNotificationProvider>
                                                                    <DisableLikesMetricsProvider>
                                                                      <DisableRepostsMetricsProvider>
                                                                        <DisableQuotesMetricsProvider>
                                                                          <DisableSavesMetricsProvider>
                                                                            <DisableReplyMetricsProvider>
                                                                              <DisableFollowersMetricsProvider>
                                                                                <DisableFollowingMetricsProvider>
                                                                                  <DisableFollowedByMetricsProvider>
                                                                                    <DisablePostsMetricsProvider>
                                                                                      <ShowFollowsYouBadgeProvider>
                                                                                        <HideSimilarAccountsRecommProvider>
                                                                                          <HideUnreplyablePostsProvider>
                                                                                            <EnableSquareAvatarsProvider>
                                                                                              <EnableSquareButtonsProvider>
                                                                                                <PostNameReplacementProvider>
                                                                                                  <DisableVerifyEmailReminderProvider>
                                                                                                    <TranslationServicePreferenceProvider>
                                                                                                      <OpenRouterProvider>
                                                                                                        <DisableComposerPromptProvider>
                                                                                                          <DiscoverContextEnabledProvider>
                                                                                                            {
                                                                                                              children
                                                                                                            }
                                                                                                          </DiscoverContextEnabledProvider>
                                                                                                        </DisableComposerPromptProvider>
                                                                                                      </OpenRouterProvider>
                                                                                                    </TranslationServicePreferenceProvider>
                                                                                                  </DisableVerifyEmailReminderProvider>
                                                                                                </PostNameReplacementProvider>
                                                                                              </EnableSquareButtonsProvider>
                                                                                            </EnableSquareAvatarsProvider>
                                                                                          </HideUnreplyablePostsProvider>
                                                                                        </HideSimilarAccountsRecommProvider>
                                                                                      </ShowFollowsYouBadgeProvider>
                                                                                    </DisablePostsMetricsProvider>
                                                                                  </DisableFollowedByMetricsProvider>
                                                                                </DisableFollowingMetricsProvider>
                                                                              </DisableFollowersMetricsProvider>
                                                                            </DisableReplyMetricsProvider>
                                                                          </DisableSavesMetricsProvider>
                                                                        </DisableQuotesMetricsProvider>
                                                                      </DisableRepostsMetricsProvider>
                                                                    </DisableLikesMetricsProvider>
                                                                  </DisableViaRepostNotificationProvider>
                                                                </HideFeedsPromoTabProvider>
                                                              </KawaiiProvider>
                                                            </RepostCarouselProvider>
                                                          </TrendingSettingsProvider>
                                                        </SubtitlesProvider>
                                                      </UsedStarterPacksProvider>
                                                    </AutoplayProvider>
                                                  </DisableHapticsProvider>
                                                </InAppBrowserProvider>
                                              </PlcDirectoryProvider>
                                            </ImageCdnHostProvider>
                                          </HighQualityImagesProvider>
                                        </HiddenPostsProvider>
                                      </ExternalEmbedsProvider>
                                    </LargeAltBadgeProvider>
                                  </UseHandleInLinksProvider>
                                </ShowLinkInHandleOnlyOnWorkingLinksProvider>
                              </ShowLinkInHandleProvider>
                            </NoDiscoverProvider>
                          </PdsLabelProvider>
                        </FaviconServiceProvider>
                      </DeerVerificationProvider>
                    </ConstellationInstanceProvider>
                  </ConstellationProvider>
                </DirectFetchRecordsProvider>
              </NoAppLabelersProvider>
            </GoLinksProvider>
          </ExternalShareButtonsProvider>
        </AutoLikeOnRepostProvider>
      </AltTextRequiredProvider>
    </LanguagesProvider>
  )
}
