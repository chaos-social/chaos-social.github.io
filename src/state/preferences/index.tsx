import {type PropsWithChildren} from 'react'

import {Provider as AlsoLikedCollapseByDefaultProvider} from './also-liked-collapse-by-default'
import {Provider as AlsoLikedFeedProvider} from './also-liked-feed-enabled'
import {Provider as AltTextRequiredProvider} from './alt-text-required'
import {Provider as AtprotoExplorerProvider} from './atproto-explorer'
import {Provider as AutoCompactAccountSwitcherProvider} from './auto-compact-account-switcher'
import {Provider as AutoLikeOnRepostProvider} from './auto-like-on-repost'
import {Provider as AutoplayProvider} from './autoplay'
import {Provider as CompactAccountSwitcherProvider} from './compact-account-switcher'
import {Provider as CompactPostsProvider} from './compact-posts'
import {Provider as ConfirmFollowProvider} from './confirm-follow'
import {Provider as ConstellationProvider} from './constellation-enabled'
import {Provider as ConstellationInstanceProvider} from './constellation-instance'
import {Provider as DeerVerificationProvider} from './deer-verification'
import {Provider as DirectFetchRecordsProvider} from './direct-fetch-records'
import {Provider as DisableComposerPromptProvider} from './disable-composer-prompt'
import {Provider as DisableHapticsProvider} from './disable-haptics'
import {Provider as DisableInfiniteScrollProvider} from './disable-infinite-scroll'
import {Provider as DisableTopOfFeedButtonProvider} from './disable-top-of-feed-button'
import {Provider as DisableVerifyEmailReminderProvider} from './disable-verify-email-reminder'
import {Provider as DisableViaRepostNotificationProvider} from './disable-via-repost-notification'
import {Provider as DiscoverContextEnabledProvider} from './discover-context-enabled'
import {Provider as DownloadFormatProvider} from './download-format'
import {Provider as EnableSquareAvatarsProvider} from './enable-square-avatars'
import {Provider as EnableSquareButtonsProvider} from './enable-square-buttons'
import {Provider as ExternalEmbedsProvider} from './external-embeds-prefs'
import {Provider as FaviconServiceProvider} from './favicon-service'
import {Provider as FullsizeFormatProvider} from './fullsize-format'
import {Provider as GoLinksProvider} from './go-links-enabled'
import {Provider as HiddenPostsProvider} from './hidden-posts'
import {Provider as HideDisplayNamesProvider} from './hide-display-names'
import {Provider as HideFeedsPromoTabProvider} from './hide-feeds-promo-tab'
import {Provider as HideQuotesOfBlockedAccountsProvider} from './hide-quotes-of-blocked-accounts'
import {Provider as HideScaryFollowButtonsProvider} from './hide-scary-follow-buttons.tsx'
import {Provider as HideSimilarAccountsRecommProvider} from './hide-similar-accounts-recommendations'
import {Provider as HideUnreplyablePostsProvider} from './hide-unreplyable-posts'
import {Provider as IgnoredAppLabelersProvider} from './ignored-app-labelers'
import {Provider as ImageCdnHostProvider} from './image-cdn-host'
import {Provider as InAppBrowserProvider} from './in-app-browser'
import {Provider as KawaiiProvider} from './kawaii'
import {Provider as LanguagesProvider} from './languages'
import {Provider as LargeAltBadgeProvider} from './large-alt-badge'
import {Provider as LoadSmallPNGsProvider} from './load-small-pngs'
import {MetricsDisplayPreferencesProvider} from './metrics-display-preference'
import {Provider as NoDiscoverProvider} from './no-discover-fallback'
import {Provider as NotoColorEmojiProvider} from './noto-color-emoji'
import {Provider as OmitViaFieldProvider} from './omit-via-field'
import {Provider as OpenRouterProvider} from './openrouter'
import {Provider as PasteToLinkEnabledProvider} from './paste-to-link-enabled'
import {Provider as PdsLabelProvider} from './pds-label'
import {Provider as PlcDirectoryProvider} from './plc-directory'
import {Provider as PostNameReplacementProvider} from './post-name-replacement.tsx'
import {Provider as ReplyIconIndicatorsProvider} from './reply-icon-indicators'
import {Provider as RepostCarouselProvider} from './repost-carousel-enabled'
import {Provider as SettingsSyncProvider} from './settings-sync'
import {Provider as ShowAvatarFollowButtonProvider} from './show-avatar-follow-button'
import {Provider as ShowFollowedByOnOwnProfileProvider} from './show-followed-by-on-own-profile'
import {Provider as ShowFollowsYouBadgeProvider} from './show-follows-you-badge'
import {Provider as ShowGermDmButtonProvider} from './show-germ-dm-button'
import {Provider as ShowLinkInHandleProvider} from './show-link-in-handle'
import {Provider as ShowLinkInHandleOnlyOnWorkingLinksProvider} from './show-link-in-handle-only-on-working-links'
import {Provider as ShowPostTagsProvider} from './show-post-tags'
import {Provider as ShowStandardLabelerProfileProvider} from './show-standard-labeler-profile'
import {Provider as ShowViaClientProvider} from './show-via-client'
import {Provider as SixSevenCelebrationProvider} from './six-seven-celebration'
import {Provider as SlingshotInstanceProvider} from './slingshot-instance'
import {Provider as SubtitlesProvider} from './subtitles'
import {Provider as ThumbnailFormatProvider} from './thumbnail-format'
import {Provider as TidSuffixProvider} from './tid-suffix'
import {Provider as TranslationServicePreferenceProvider} from './translation-service-preference'
import {Provider as TrendingSettingsProvider} from './trending'
import {Provider as UseHandleInLinksProvider} from './use-handle-in-links'
import {Provider as UsedStarterPacksProvider} from './used-starter-packs'

export {
  useAlsoLikedCollapseByDefault,
  useSetAlsoLikedCollapseByDefault,
} from './also-liked-collapse-by-default'
export {
  useAlsoLikedFeedEnabled,
  useSetAlsoLikedFeedEnabled,
} from './also-liked-feed-enabled'
export {
  useForceAltTextEnabled,
  useRequireAltTextEnabled,
  useSetForceAltTextEnabled,
  useSetRequireAltTextEnabled,
} from './alt-text-required'
export {useAutoplayDisabled, useSetAutoplayDisabled} from './autoplay'
export {useCompactPosts, useSetCompactPosts} from './compact-posts'
export {useConfirmFollow, useSetConfirmFollow} from './confirm-follow'
export {
  useDisableComposerPrompt,
  useSetDisableComposerPrompt,
} from './disable-composer-prompt'
export {useHapticsDisabled, useSetHapticsDisabled} from './disable-haptics'
export {
  useDisableTopOfFeedButton,
  useSetDisableTopOfFeedButton,
} from './disable-top-of-feed-button'
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
export {useHideDisplayNames, useSetHideDisplayNames} from './hide-display-names'
export {
  useHideFeedsPromoTab,
  useSetHideFeedsPromoTab,
} from './hide-feeds-promo-tab'
export {
  useHideScaryFollowButtons,
  useSetHideScaryFollowButtons,
} from './hide-scary-follow-buttons'
export {useImageCdnHost, useSetImageCdnHost} from './image-cdn-host'
export {useLabelDefinitions} from './label-defs'
export {useLanguagePrefs, useLanguagePrefsApi} from './languages'
export {useOmitViaField, useSetOmitViaField} from './omit-via-field'
export {
  useOpenRouterApiKey,
  useOpenRouterConfigured,
  useOpenRouterModel,
  useSetOpenRouterApiKey,
  useSetOpenRouterModel,
} from './openrouter'
export {
  usePasteToLinkEnabled,
  useSetPasteToLinkEnabled,
} from './paste-to-link-enabled'
export {
  readPlcDirectory,
  usePlcDirectory,
  useSetPlcDirectory,
} from './plc-directory'
export {
  useReplyIconIndicators,
  useSetReplyIconIndicators,
} from './reply-icon-indicators'
export {
  useSetSettingsSyncEnabled,
  useSettingsSyncEnabled,
} from './settings-sync'
export {
  useSetShowAvatarFollowButton,
  useShowAvatarFollowButton,
} from './show-avatar-follow-button'
export {
  useSetShowGermDmButton,
  useShowGermDmButton,
} from './show-germ-dm-button'
export {useSetShowPostTags, useShowPostTags} from './show-post-tags'
export {
  useSetShowStandardLabelerProfile,
  useShowStandardLabelerProfile,
} from './show-standard-labeler-profile'
export {useSetSubtitlesEnabled, useSubtitlesEnabled} from './subtitles'
export {useSetTidSuffix, useTidSuffix} from './tid-suffix'
export {
  useSetTranslationServicePreference,
  useTranslationServicePreference,
} from './translation-service-preference'

export function Provider({children}: PropsWithChildren<{}>) {
  return (
    <SettingsSyncProvider>
      <LanguagesProvider>
        <AltTextRequiredProvider>
          <AutoLikeOnRepostProvider>
            <AtprotoExplorerProvider>
              <GoLinksProvider>
                <IgnoredAppLabelersProvider>
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
                                            <FullsizeFormatProvider>
                                              <DownloadFormatProvider>
                                                <ImageCdnHostProvider>
                                                  <PlcDirectoryProvider>
                                                    <InAppBrowserProvider>
                                                      <DisableHapticsProvider>
                                                        <AutoplayProvider>
                                                          <UsedStarterPacksProvider>
                                                            <SubtitlesProvider>
                                                              <ThumbnailFormatProvider>
                                                                <LoadSmallPNGsProvider>
                                                                  <TrendingSettingsProvider>
                                                                    <RepostCarouselProvider>
                                                                      <AlsoLikedFeedProvider>
                                                                        <AlsoLikedCollapseByDefaultProvider>
                                                                          <KawaiiProvider>
                                                                            <HideFeedsPromoTabProvider>
                                                                              <DisableViaRepostNotificationProvider>
                                                                                <MetricsDisplayPreferencesProvider>
                                                                                  <ShowFollowsYouBadgeProvider>
                                                                                    <ShowFollowedByOnOwnProfileProvider>
                                                                                      <ShowAvatarFollowButtonProvider>
                                                                                        <ShowGermDmButtonProvider>
                                                                                          <ShowStandardLabelerProfileProvider>
                                                                                            <HideSimilarAccountsRecommProvider>
                                                                                              <HideScaryFollowButtonsProvider>
                                                                                                <ConfirmFollowProvider>
                                                                                                  <HideUnreplyablePostsProvider>
                                                                                                    <CompactPostsProvider>
                                                                                                      <EnableSquareAvatarsProvider>
                                                                                                        <EnableSquareButtonsProvider>
                                                                                                          <AutoCompactAccountSwitcherProvider>
                                                                                                            <CompactAccountSwitcherProvider>
                                                                                                              <ShowViaClientProvider>
                                                                                                                <HideDisplayNamesProvider>
                                                                                                                  <SixSevenCelebrationProvider>
                                                                                                                    <PostNameReplacementProvider>
                                                                                                                      <DisableVerifyEmailReminderProvider>
                                                                                                                        <TranslationServicePreferenceProvider>
                                                                                                                          <OpenRouterProvider>
                                                                                                                            <DisableComposerPromptProvider>
                                                                                                                              <DisableTopOfFeedButtonProvider>
                                                                                                                                <DiscoverContextEnabledProvider>
                                                                                                                                  <OmitViaFieldProvider>
                                                                                                                                    <TidSuffixProvider>
                                                                                                                                      <SlingshotInstanceProvider>
                                                                                                                                        <DisableInfiniteScrollProvider>
                                                                                                                                          <HideQuotesOfBlockedAccountsProvider>
                                                                                                                                            <ReplyIconIndicatorsProvider>
                                                                                                                                              <ShowPostTagsProvider>
                                                                                                                                                <NotoColorEmojiProvider>
                                                                                                                                                  <PasteToLinkEnabledProvider>
                                                                                                                                                    {
                                                                                                                                                      children
                                                                                                                                                    }
                                                                                                                                                  </PasteToLinkEnabledProvider>
                                                                                                                                                </NotoColorEmojiProvider>
                                                                                                                                              </ShowPostTagsProvider>
                                                                                                                                            </ReplyIconIndicatorsProvider>
                                                                                                                                          </HideQuotesOfBlockedAccountsProvider>
                                                                                                                                        </DisableInfiniteScrollProvider>
                                                                                                                                      </SlingshotInstanceProvider>
                                                                                                                                    </TidSuffixProvider>
                                                                                                                                  </OmitViaFieldProvider>
                                                                                                                                </DiscoverContextEnabledProvider>
                                                                                                                              </DisableTopOfFeedButtonProvider>
                                                                                                                            </DisableComposerPromptProvider>
                                                                                                                          </OpenRouterProvider>
                                                                                                                        </TranslationServicePreferenceProvider>
                                                                                                                      </DisableVerifyEmailReminderProvider>
                                                                                                                    </PostNameReplacementProvider>
                                                                                                                  </SixSevenCelebrationProvider>
                                                                                                                </HideDisplayNamesProvider>
                                                                                                              </ShowViaClientProvider>
                                                                                                            </CompactAccountSwitcherProvider>
                                                                                                          </AutoCompactAccountSwitcherProvider>
                                                                                                        </EnableSquareButtonsProvider>
                                                                                                      </EnableSquareAvatarsProvider>
                                                                                                    </CompactPostsProvider>
                                                                                                  </HideUnreplyablePostsProvider>
                                                                                                </ConfirmFollowProvider>
                                                                                              </HideScaryFollowButtonsProvider>
                                                                                            </HideSimilarAccountsRecommProvider>
                                                                                          </ShowStandardLabelerProfileProvider>
                                                                                        </ShowGermDmButtonProvider>
                                                                                      </ShowAvatarFollowButtonProvider>
                                                                                    </ShowFollowedByOnOwnProfileProvider>
                                                                                  </ShowFollowsYouBadgeProvider>
                                                                                </MetricsDisplayPreferencesProvider>
                                                                              </DisableViaRepostNotificationProvider>
                                                                            </HideFeedsPromoTabProvider>
                                                                          </KawaiiProvider>
                                                                        </AlsoLikedCollapseByDefaultProvider>
                                                                      </AlsoLikedFeedProvider>
                                                                    </RepostCarouselProvider>
                                                                  </TrendingSettingsProvider>
                                                                </LoadSmallPNGsProvider>
                                                              </ThumbnailFormatProvider>
                                                            </SubtitlesProvider>
                                                          </UsedStarterPacksProvider>
                                                        </AutoplayProvider>
                                                      </DisableHapticsProvider>
                                                    </InAppBrowserProvider>
                                                  </PlcDirectoryProvider>
                                                </ImageCdnHostProvider>
                                              </DownloadFormatProvider>
                                            </FullsizeFormatProvider>
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
                </IgnoredAppLabelersProvider>
              </GoLinksProvider>
            </AtprotoExplorerProvider>
          </AutoLikeOnRepostProvider>
        </AltTextRequiredProvider>
      </LanguagesProvider>
    </SettingsSyncProvider>
  )
}
