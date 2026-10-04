import {BSKY_LABELER_DID} from '@atproto/api'
import {isDidString} from '@atproto/lex'
import {z} from 'zod'

import {DEFAULT_ALT_TEXT_AI_MODEL} from '#/lib/constants'
import {
  countsMetricsDisplaySchema,
  followedByMetricsDisplaySchema,
  notificationDotDisplaySchema,
} from '#/lib/metrics-display'
import {deviceLanguageCodes, deviceLocales} from '#/locale/deviceLocales'
import {findSupportedAppLanguage} from '#/locale/helpers'
import {logger} from '#/logger'
import {PlatformInfo} from '../../../modules/expo-bluesky-swiss-army'

const externalEmbedOptions = ['show', 'hide'] as const

/**
 * A account persisted to storage. Stored in the `accounts[]` array. Contains
 * base account info and access tokens.
 */
const accountSchema = z.object({
  service: z.string(),
  /**
   * Genuinely validated, not just branded: the refinement rejects malformed
   * values at runtime and narrows the inferred type to `DidString`.
   *
   * Weigh any further tightening of this field carefully. One failing field
   * fails the whole root schema, and {@link tryParse} then discards the ENTIRE
   * persisted state - every account and every preference - so the app boots
   * logged out with defaults. Persisted dids come from com.atproto.server
   * responses and are always canonical, so this particular check is safe.
   */
  did: z.string().refine(isDidString),
  handle: z.string(),
  addedAt: z.string().optional(),
  lastActiveAt: z.string().optional(),
  email: z.string().optional(),
  emailConfirmed: z.boolean().optional(),
  emailAuthFactor: z.boolean().optional(),
  refreshJwt: z.string().optional(), // optional because it can expire
  accessJwt: z.string().optional(), // optional because it can expire
  signupQueued: z.boolean().optional(),
  active: z.boolean().optional(), // optional for backwards compat
  /**
   * Known values: takendown, suspended, deactivated
   * @see https://github.com/bluesky-social/atproto/blob/5441fbde9ed3b22463e91481ec80cb095643e141/lexicons/com/atproto/server/getSession.json
   */
  status: z.string().optional(),
  pdsUrl: z.string().optional(),
  isSelfHosted: z.boolean().optional(),
  isOauthSession: z.boolean().optional(),
})
export type PersistedAccount = z.infer<typeof accountSchema>

/**
 * The current account. Stored in the `currentAccount` field.
 *
 * In previous versions, this included tokens and other info. Now, it's used
 * only to reference the `did` field, and all other fields are marked as
 * optional. They should be considered deprecated and not used, but are kept
 * here for backwards compat.
 */
const currentAccountSchema = accountSchema.extend({
  service: z.string().optional(),
  handle: z.string().optional(),
})
export type PersistedCurrentAccount = z.infer<typeof currentAccountSchema>

const semanticColorsSchema = z.object({
  canvas: z.string(),
  surface: z.string(),
  surfaceRaised: z.string(),
  text: z.string(),
  textMuted: z.string(),
  border: z.string(),
  accent: z.string(),
  accentSoft: z.string(),
  onAccent: z.string(),
  positive: z.string(),
  warning: z.string(),
  critical: z.string(),
  favorite: z.string(),
})
const semanticColorOverridesSchema = semanticColorsSchema.partial()

const themeRecordSchema = z.object({
  $type: z.literal('app.witchsky.theme.colors').optional(),
  name: z.string(),
  description: z.string().optional(),
  mode: z.enum(['light', 'dark']),
  recommendedPair: z.string().optional(),
  base: z.object({
    name: z.string(),
    colors: semanticColorsSchema,
  }),
  variants: z
    .array(
      z.object({
        name: z.string(),
        colors: semanticColorOverridesSchema.optional(),
      }),
    )
    .optional(),
  special: z
    .object({
      $type: z.string(),
      accent: z.string().optional(),
    })
    .passthrough()
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

const activeThemeSelectionSchema = z.object({
  uri: z.string(),
  cid: z.string(),
  author: z.string(),
  record: themeRecordSchema,
  colorSet: z.string(),
  hue: z.number().optional(),
})

const activeThemeSchema = z.object({
  light: activeThemeSelectionSchema,
  dark: activeThemeSelectionSchema,
})

const schema = z.object({
  colorMode: z.enum(['system', 'light', 'dark']),
  darkTheme: z.enum(['dim', 'dark']).optional(),
  colorScheme: z.enum([
    'witchsky',
    'bluesky',
    'blacksky',
    'deer',
    'zeppelin',
    'kitty',
    'reddwarf',
    'catppuccin',
    'evergarden',
    'cyan base',
    'material3',
  ]),
  hue: z.number(),
  material3Accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, {
      message:
        'Invalid color format. Must be a 7-character hex code (e.g., #RRGGBB).',
    })
    .default('#ee6300'),
  material3Style: z
    .enum([
      'SPRITZ',
      'TONAL_SPOT',
      'VIBRANT',
      'EXPRESSIVE',
      'RAINBOW',
      'FRUIT_SALAD',
      'CONTENT',
      'MONOCHROMATIC',
    ])
    .default('TONAL_SPOT'),
  activeTheme: activeThemeSchema.optional(),
  session: z.object({
    accounts: z.array(accountSchema),
    currentAccount: currentAccountSchema.optional(),
  }),
  reminders: z.object({
    lastEmailConfirm: z.string().optional(),
  }),
  languagePrefs: z.object({
    /**
     * The target language for translating posts.
     *
     * BCP-47 2-letter language code without region.
     */
    primaryLanguage: z.string(),
    /**
     * The languages the user can read, passed to feeds.
     *
     * BCP-47 2-letter language codes without region.
     */
    contentLanguages: z.array(z.string()),
    /**
     * The language(s) the user is currently posting in, configured within the
     * composer. Multiple languages are separated by commas.
     *
     * BCP-47 2-letter language code without region.
     */
    postLanguage: z.string(),
    /**
     * The user's post language history, used to pre-populate the post language
     * selector in the composer. Within each value, multiple languages are separated
     * by commas.
     *
     * BCP-47 2-letter language codes without region.
     */
    postLanguageHistory: z.array(z.string()),
    /**
     * The language for UI translations in the app.
     *
     * BCP-47 2-letter language code with or without region,
     * to match with {@link AppLanguage}.
     */
    appLanguage: z.string(),
  }),
  forceAltTextEnabled: z.boolean().optional(),
  requireAltTextEnabled: z.boolean(), // should move to server
  largeAltBadgeEnabled: z.boolean().optional(),
  externalEmbeds: z
    .object({
      giphy: z.enum(externalEmbedOptions).optional(),
      tenor: z.enum(externalEmbedOptions).optional(),
      klipy: z.enum(externalEmbedOptions).optional(),
      youtube: z.enum(externalEmbedOptions).optional(),
      youtubeShorts: z.enum(externalEmbedOptions).optional(),
      twitch: z.enum(externalEmbedOptions).optional(),
      vimeo: z.enum(externalEmbedOptions).optional(),
      spotify: z.enum(externalEmbedOptions).optional(),
      appleMusic: z.enum(externalEmbedOptions).optional(),
      soundcloud: z.enum(externalEmbedOptions).optional(),
      flickr: z.enum(externalEmbedOptions).optional(),
      bandcamp: z.enum(externalEmbedOptions).optional(),
      streamplace: z.enum(externalEmbedOptions).optional(),
      plyr: z.enum(externalEmbedOptions).optional(),
    })
    .optional(),
  invites: z.object({
    copiedInvites: z.array(z.string()),
  }),
  onboarding: z.object({
    step: z.string(),
  }),
  hiddenPosts: z.array(z.string()).optional(), // should move to server
  useInAppBrowser: z.boolean().optional(),
  /** @deprecated */
  lastSelectedHomeFeed: z.string().optional(),
  pdsAddressHistory: z.array(z.string()).optional(),
  disableHaptics: z.boolean().optional(),
  extractQuotedPost: z.boolean().optional(),
  disableAutoplay: z.boolean().optional(),
  kawaii: z.boolean().optional(),
  hasCheckedForStarterPack: z.boolean().optional(),
  subtitlesEnabled: z.boolean().optional(),

  // deer
  goLinksEnabled: z.boolean().optional(),
  pasteToLinkEnabled: z.boolean().optional(),
  constellationEnabled: z.boolean().optional(),
  directFetchRecords: z.boolean().optional(),
  ignoredAppLabelers: z.array(z.string()).optional(),
  noDiscoverFallback: z.boolean().optional(),
  repostCarouselEnabled: z.boolean().optional(),
  alsoLikedFeedEnabled: z.boolean().optional(),
  alsoLikedCollapseByDefault: z.boolean().optional(),
  constellationInstance: z.string().optional(),
  constellationInstanceCustom: z.string().optional(),
  slingshotInstance: z.string().optional(),
  slingshotInstanceCustom: z.string().optional(),
  showLinkInHandle: z.boolean().optional(),
  showLinkInHandleOnlyOnWorkingLinks: z.boolean().optional(),
  hideFeedsPromoTab: z.boolean().optional(),
  disableViaRepostNotification: z.boolean().optional(),
  disableComposerPrompt: z.boolean().optional(),
  disableInfiniteScroll: z.boolean().optional(),
  disableTopOfFeedButton: z.boolean().optional(),
  showAvatarFollowButton: z.boolean().optional(),
  /** @deprecated Migrated to likesMetricsDisplay */
  disableLikesMetrics: z.boolean().optional(),
  /** @deprecated Migrated to repostsMetricsDisplay */
  disableRepostsMetrics: z.boolean().optional(),
  /** @deprecated Migrated to quotesMetricsDisplay */
  disableQuotesMetrics: z.boolean().optional(),
  /** @deprecated Migrated to savesMetricsDisplay */
  disableSavesMetrics: z.boolean().optional(),
  /** @deprecated Migrated to replyMetricsDisplay */
  disableReplyMetrics: z.boolean().optional(),
  /** @deprecated Migrated to followersMetricsDisplay */
  disableFollowersMetrics: z.boolean().optional(),
  /** @deprecated Migrated to followingMetricsDisplay */
  disableFollowingMetrics: z.boolean().optional(),
  /** @deprecated Migrated to followedByMetricsDisplay */
  disableFollowedByMetrics: z.boolean().optional(),
  /** @deprecated Migrated to postsMetricsDisplay */
  disablePostsMetrics: z.boolean().optional(),
  likesMetricsDisplay: countsMetricsDisplaySchema.optional(),
  repostsMetricsDisplay: countsMetricsDisplaySchema.optional(),
  quotesMetricsDisplay: countsMetricsDisplaySchema.optional(),
  savesMetricsDisplay: countsMetricsDisplaySchema.optional(),
  replyMetricsDisplay: countsMetricsDisplaySchema.optional(),
  followersMetricsDisplay: countsMetricsDisplaySchema.optional(),
  followingMetricsDisplay: countsMetricsDisplaySchema.optional(),
  followedByMetricsDisplay: followedByMetricsDisplaySchema.optional(),
  postsMetricsDisplay: countsMetricsDisplaySchema.optional(),
  /** @deprecated Migrated to notificationsTabBadgeDisplay and chatsTabBadgeDisplay */
  notificationDotDisplay: notificationDotDisplaySchema.optional(),
  tabTitleSource: z.enum(['notifications', 'chats', 'none']).optional(),
  notificationsBadgeText: z.string().max(16).optional(),
  chatsBadgeText: z.string().max(16).optional(),
  notificationsTabBadgeDisplay: notificationDotDisplaySchema.optional(),
  chatsTabBadgeDisplay: notificationDotDisplaySchema.optional(),
  showFollowsYouBadge: z.boolean().optional(),
  showFollowedByOnOwnProfile: z.boolean().optional(),
  hideSimilarAccountsRecomm: z.boolean().optional(),
  hideScaryFollowButtons: z.boolean().optional(),
  showGermDmButton: z.boolean().optional(),
  showClearskyProfileLink: z.boolean().optional(),
  showStandardLabelerProfile: z.boolean().optional(),
  confirmFollow: z.boolean().optional(),
  showPostTags: z.boolean().optional(),
  discoverContextEnabled: z.boolean().optional(),
  compactPosts: z.boolean().optional(),
  enableSquareAvatars: z.boolean().optional(),
  enableSquareButtons: z.boolean().optional(),
  useNotoColorEmoji: z.boolean().optional(),
  useCompactAccountSwitcher: z.boolean().optional(),
  autoCompactAccountSwitcher: z.boolean().optional(),
  disableVerifyEmailReminder: z.boolean().optional(),
  showViaClient: z.boolean().optional(),
  hideDisplayNames: z.boolean().optional(),
  replyIconIndicators: z.boolean().optional(),
  sixSevenCelebration: z.boolean().optional(),
  deerVerification: z
    .object({
      enabled: z.boolean(),
      perVerifierBadges: z.boolean().optional(),
      trustAppView: z.boolean().optional(),
      trustedSelf: z.boolean().optional(),
      trusted: z.array(z.string()),
    })
    .optional(),
  /** @deprecated Use thumbnailFormat and fullsizeFormat instead */
  highQualityImages: z.boolean().optional(),
  thumbnailFormat: z.string().optional(),
  fullsizeFormat: z.string().optional(),
  downloadFormat: z.string().optional(),
  loadAsPngs: z.boolean().optional(),
  imageCdnHost: z.string().optional(),
  imageCdnHostCustom: z.string().optional(),
  plcDirectory: z.string().optional(),
  plcDirectoryCustom: z.string().optional(),
  hideUnreplyablePosts: z.boolean().optional(),
  hideQuotesOfBlockedAccounts: z.boolean().optional(),
  pdsLabel: z
    .object({
      enabled: z.boolean(),
      hideBskyPds: z.boolean(),
    })
    .optional(),
  faviconService: z.string().optional(),

  postReplacement: z.object({
    enabled: z.boolean().optional(),
    postName: z.string().optional(),
    postsName: z.string().optional(),
  }),

  /** @deprecated The Open submenu is now always shown. */
  showExternalShareButtons: z.boolean().optional(),
  atprotoExplorer: z
    .object({
      name: z.string(),
      url: z.string(),
    })
    .optional(),

  translationServicePreference: z.enum([
    'google',
    'kagi',
    'papago',
    'libreTranslate',
  ]),
  libreTranslateInstance: z.string().optional(),

  openRouterApiKey: z.string().optional(),
  openRouterModel: z.string().optional(),
  openRouterPrompt: z.string().optional(),
  altTextAiProvider: z
    .enum(['none', 'openrouter', 'cocore', 'openaiCompatible'])
    .optional(),
  openAiCompatibleApiKey: z.string().optional(),
  openAiCompatibleBaseUrl: z.string().optional(),
  openAiCompatibleModel: z.string().optional(),

  useHandleInLinks: z.boolean().optional(),

  /** @deprecated */
  mutedThreads: z.array(z.string()),
  trendingTopicCount: z.number().int().min(1).max(25).optional(),
  trendingDisabled: z.boolean().optional(),
  trendingVideoDisabled: z.boolean().optional(),

  autoLikeOnRepost: z.boolean().optional(),
  omitViaField: z.boolean().optional(),
  tidSuffix: z.string().optional(),

  // settings sync
  settingsSyncEnabled: z.boolean().optional(),
  settingsSyncDraftId: z.string().optional(),
  /** Last successfully synced values, keyed by account DID, for 3-way merges. */
  settingsSyncBaselines: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .optional(),
  syncOpenRouterApiKey: z.boolean().optional(),
  /** When false, theme prefs are omitted from push/pull. Defaults to true. */
  syncTheme: z.boolean().optional(),
  /**
   * @deprecated No longer used; kept so older persisted storage still parses.
   */
  settingsSyncShareAcrossAccounts: z.boolean().optional(),
  // Skip the next startup pull after a restart-required setting change so
  // local edits are not overwritten by stale cloud data.
  settingsSyncSkipNextPull: z.boolean().optional(),
})
export type Schema = z.infer<typeof schema>

export const defaults: Schema = {
  colorMode: 'system',
  darkTheme: 'dim',
  colorScheme: 'witchsky',
  hue: 0,
  material3Accent: '#ee6300',
  material3Style: 'TONAL_SPOT',
  activeTheme: undefined,
  session: {
    accounts: [],
    currentAccount: undefined,
  },
  reminders: {
    lastEmailConfirm: undefined,
  },
  languagePrefs: {
    primaryLanguage: deviceLanguageCodes[0] || 'en',
    contentLanguages: [],
    postLanguage: deviceLanguageCodes[0] || 'en',
    postLanguageHistory: (deviceLanguageCodes || [])
      .concat(['en', 'ja', 'pt', 'de'])
      .slice(0, 6),
    // try full language tag first, then fallback to language code
    appLanguage: findSupportedAppLanguage([
      deviceLocales.at(0)?.languageTag,
      deviceLanguageCodes[0],
    ]),
  },
  forceAltTextEnabled: false,
  requireAltTextEnabled: true,
  largeAltBadgeEnabled: false,
  externalEmbeds: {},
  mutedThreads: [],
  invites: {
    copiedInvites: [],
  },
  onboarding: {
    step: 'Home',
  },
  hiddenPosts: [],
  useInAppBrowser: undefined,
  lastSelectedHomeFeed: undefined,
  pdsAddressHistory: [],
  disableHaptics: false,
  extractQuotedPost: false,
  disableAutoplay: PlatformInfo.getIsReducedMotionEnabled(),
  kawaii: false,
  hasCheckedForStarterPack: false,
  subtitlesEnabled: true,
  trendingTopicCount: 5,
  trendingDisabled: true,
  trendingVideoDisabled: true,

  // deer
  goLinksEnabled: true,
  pasteToLinkEnabled: false,
  constellationEnabled: true,
  directFetchRecords: true,
  ignoredAppLabelers: [],
  noDiscoverFallback: false,
  repostCarouselEnabled: false,
  alsoLikedFeedEnabled: true,
  alsoLikedCollapseByDefault: true,
  constellationInstance: 'https://constellation.microcosm.blue/',
  slingshotInstance: 'https://slingshot.microcosm.blue/',
  showLinkInHandle: true,
  showLinkInHandleOnlyOnWorkingLinks: true,
  hideFeedsPromoTab: false,
  disableViaRepostNotification: false,
  disableComposerPrompt: true,
  disableInfiniteScroll: false,
  disableTopOfFeedButton: false,
  showAvatarFollowButton: false,
  likesMetricsDisplay: 'visible',
  repostsMetricsDisplay: 'visible',
  quotesMetricsDisplay: 'visible',
  savesMetricsDisplay: 'visible',
  replyMetricsDisplay: 'visible',
  followersMetricsDisplay: 'visible',
  followingMetricsDisplay: 'visible',
  followedByMetricsDisplay: 'visible',
  postsMetricsDisplay: 'visible',
  notificationDotDisplay: 'exact',
  notificationsTabBadgeDisplay: 'exact',
  chatsTabBadgeDisplay: 'exact',
  showFollowsYouBadge: false,
  showFollowedByOnOwnProfile: false,
  hideSimilarAccountsRecomm: true,
  hideScaryFollowButtons: false,
  showGermDmButton: false,
  showClearskyProfileLink: false,
  showStandardLabelerProfile: true,
  confirmFollow: false,
  showPostTags: true,
  discoverContextEnabled: false,
  compactPosts: false,
  enableSquareAvatars: true,
  enableSquareButtons: true,
  useNotoColorEmoji: false,
  useCompactAccountSwitcher: false,
  autoCompactAccountSwitcher: true,
  disableVerifyEmailReminder: false,
  showViaClient: true,
  hideDisplayNames: false,
  replyIconIndicators: true,
  sixSevenCelebration: true,
  deerVerification: {
    enabled: false,
    trustAppView: true,
    trustedSelf: true,
    trusted: [],
  },
  highQualityImages: false,
  thumbnailFormat: 'webp',
  fullsizeFormat: 'webp',
  downloadFormat: 'original',
  loadAsPngs: true,
  plcDirectory: 'https://plc.directory',
  hideUnreplyablePosts: false,
  hideQuotesOfBlockedAccounts: false,
  pdsLabel: {
    enabled: true,
    hideBskyPds: true,
  },
  faviconService: 'https://twenty-icons.com/(pds)',
  atprotoExplorer: {
    name: 'PDSls',
    url: 'https://pds.ls/(uri)',
  },
  translationServicePreference: 'google',
  libreTranslateInstance: 'https://libretranslate.com/',

  openRouterApiKey: undefined,
  openRouterModel: DEFAULT_ALT_TEXT_AI_MODEL,
  openRouterPrompt: undefined,
  altTextAiProvider: 'none',
  openAiCompatibleApiKey: undefined,
  openAiCompatibleBaseUrl: undefined,
  openAiCompatibleModel: undefined,

  useHandleInLinks: false,

  postReplacement: {
    enabled: false,
    postName: 'skeet',
    postsName: 'skeets',
  },

  autoLikeOnRepost: false,
  omitViaField: false,
  tidSuffix: undefined,

  settingsSyncEnabled: false,
  settingsSyncDraftId: undefined,
  settingsSyncBaselines: undefined,
  syncOpenRouterApiKey: false,
  syncTheme: true,
  settingsSyncShareAcrossAccounts: false,
  settingsSyncSkipNextPull: false,
}

export function tryParse(rawData: string): Schema | undefined {
  let objData
  try {
    objData = JSON.parse(rawData)
  } catch (e) {
    logger.error('persisted state: failed to parse root state from storage', {
      message: e,
    })
  }
  if (!objData) {
    return undefined
  }
  const parsed = schema.safeParse(objData)
  if (parsed.success) {
    let data = parsed.data
    if (
      (objData as {noAppLabelers?: boolean}).noAppLabelers &&
      !data.ignoredAppLabelers?.length
    ) {
      data = {
        ...data,
        ignoredAppLabelers: [BSKY_LABELER_DID],
      }
    }
    if (data.highQualityImages) {
      data = {
        ...data,
        thumbnailFormat: data.thumbnailFormat ?? 'png',
        fullsizeFormat: data.fullsizeFormat ?? 'png',
        loadAsPngs: data.loadAsPngs ?? true,
      }
    }
    return data
  } else {
    const errors =
      parsed.error?.errors?.map(e => ({
        code: e.code,
        // @ts-expect-error exists on some types
        expected: e?.expected,
        path: e.path?.join('.'),
      })) || []
    logger.error(`persisted store: data failed validation on read`, {errors})
    return undefined
  }
}

export function tryStringify(value: Schema): string | undefined {
  try {
    schema.parse(value)
    return JSON.stringify(value)
  } catch (e) {
    logger.error(`persisted state: failed stringifying root state`, {
      safeMessage: String(e),
    })
    return undefined
  }
}
