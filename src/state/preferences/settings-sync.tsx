import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {type PropsWithChildren} from 'react'

import * as persisted from '#/state/persisted'
import {type Schema} from '#/state/persisted/schema'
import {PLATFORM_SYNCED_PREFS_KEYS} from '#/state/preferences/platform-synced-prefs'

// ---------------------------------------------------------------------------
// Synced keys allowlist
// ---------------------------------------------------------------------------
// Everything the storage manifest will include. Deliberately excludes:
//   session, invites, reminders, onboarding, pdsAddressHistory,
//   hasCheckedForStarterPack, mutedThreads (deprecated),
//   lastSelectedHomeFeed (deprecated UI state),
//   settingsSyncEnabled, settingsSyncDraftId, settingsSyncBaselines,
//   settingsSyncSkipNextPull
//   (the mechanism, not the content)

/** Theme-related keys; omitted from push/pull when syncTheme is false. */
export const THEME_PREFS_KEYS = [
  'colorMode',
  'darkTheme',
  'colorScheme',
  'hue',
  'material3Accent',
  'material3Style',
  'activeTheme',
] as const satisfies readonly (keyof Schema)[]

export const SYNCED_PREFS_KEYS = [
  'languagePrefs',
  'requireAltTextEnabled',
  'forceAltTextEnabled',
  'largeAltBadgeEnabled',
  'externalEmbeds',
  'hiddenPosts',
  'useInAppBrowser',
  'disableHaptics',
  'disableAutoplay',
  'kawaii',
  'subtitlesEnabled',
  'goLinksEnabled',
  'constellationEnabled',
  'directFetchRecords',
  'ignoredAppLabelers',
  'noDiscoverFallback',
  'repostCarouselEnabled',
  'alsoLikedFeedEnabled',
  'constellationInstance',
  'constellationInstanceCustom',
  'slingshotInstance',
  'slingshotInstanceCustom',
  'showLinkInHandle',
  'showLinkInHandleOnlyOnWorkingLinks',
  'hideFeedsPromoTab',
  'disableViaRepostNotification',
  'disableComposerPrompt',
  'disableInfiniteScroll',
  'disableTopOfFeedButton',
  'showAvatarFollowButton',
  'likesMetricsDisplay',
  'repostsMetricsDisplay',
  'quotesMetricsDisplay',
  'savesMetricsDisplay',
  'replyMetricsDisplay',
  'followersMetricsDisplay',
  'followingMetricsDisplay',
  'followedByMetricsDisplay',
  'postsMetricsDisplay',
  'notificationDotDisplay',
  'notificationsTabBadgeDisplay',
  'chatsTabBadgeDisplay',
  'showFollowsYouBadge',
  'showFollowedByOnOwnProfile',
  'hideSimilarAccountsRecomm',
  'hideScaryFollowButtons',
  'showGermDmButton',
  'showStandardLabelerProfile',
  'confirmFollow',
  'showPostTags',
  'discoverContextEnabled',
  'compactPosts',
  'enableSquareAvatars',
  'enableSquareButtons',
  ...PLATFORM_SYNCED_PREFS_KEYS,
  'useCompactAccountSwitcher',
  'autoCompactAccountSwitcher',
  'disableVerifyEmailReminder',
  'showViaClient',
  'hideDisplayNames',
  'replyIconIndicators',
  'sixSevenCelebration',
  'deerVerification',
  'thumbnailFormat',
  'fullsizeFormat',
  'downloadFormat',
  'loadAsPngs',
  'imageCdnHost',
  'imageCdnHostCustom',
  'plcDirectory',
  'plcDirectoryCustom',
  'hideUnreplyablePosts',
  'hideQuotesOfBlockedAccounts',
  'pdsLabel',
  'faviconService',
  'postReplacement',
  'atprotoExplorer',
  'translationServicePreference',
  'libreTranslateInstance',
  'autoTranslatePosts',
  'mymemoryEmail',
  'tagSearchInstance',
  'openRouterApiKey',
  'openRouterModel',
  'openRouterPrompt',
  'altTextAiProvider',
  'openAiCompatibleApiKey',
  'openAiCompatibleBaseUrl',
  'openAiCompatibleModel',
  'useHandleInLinks',
  'trendingTopicCount',
  'trendingDisabled',
  'trendingVideoDisabled',
  'autoLikeOnRepost',
  'omitViaField',
  'tidSuffix',
  'syncOpenRouterApiKey',
  'syncTheme',
] as const satisfies readonly (keyof Schema)[]

export type SyncedPrefsKey = (typeof SYNCED_PREFS_KEYS)[number]

const THEME_PREFS_KEY_SET = new Set<string>(THEME_PREFS_KEYS)

/**
 * Whether theme prefs should be included in the current push/pull.
 * Defaults to true when unset.
 */
export function shouldSyncTheme(): boolean {
  return persisted.get('syncTheme') !== false
}

/**
 * Keys to include for a push/pull given the current opt-in flags.
 */
export function getActiveSyncedPrefsKeys(): SyncedPrefsKey[] {
  const syncApiKey = persisted.get('syncOpenRouterApiKey')
  const includeTheme = shouldSyncTheme()
  return SYNCED_PREFS_KEYS.filter(key => {
    if (
      (key === 'openRouterApiKey' || key === 'openAiCompatibleApiKey') &&
      !syncApiKey
    ) {
      return false
    }
    if (!includeTheme && THEME_PREFS_KEY_SET.has(key)) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type StateContext = boolean
type SetContext = (v: boolean) => void

const stateContext = createContext<StateContext>(
  Boolean(persisted.defaults.settingsSyncEnabled),
)
stateContext.displayName = 'CloudSyncStateContext'

const setContext = createContext<SetContext>((_: boolean) => {})
setContext.displayName = 'CloudSyncSetContext'

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(
    Boolean(persisted.get('settingsSyncEnabled')),
  )

  const setStateWrapped = useCallback((value: boolean) => {
    setState(value)
    void persisted.write('settingsSyncEnabled', value)
  }, [])

  useEffect(() => {
    return persisted.onUpdate('settingsSyncEnabled', next => {
      setState(Boolean(next))
    })
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export const useSettingsSyncEnabled = () => useContext(stateContext)
export const useSetSettingsSyncEnabled = () => useContext(setContext)
