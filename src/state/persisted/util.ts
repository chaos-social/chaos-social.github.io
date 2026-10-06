import {parse} from 'bcp-47'

import {dedupArray} from '#/lib/functions'
import {
  migrateCountsMetricsDisplay,
  migrateFollowedByMetricsDisplay,
} from '#/lib/metrics-display'
import {logger} from '#/logger'
import {defaults, type Schema} from '#/state/persisted/schema'

function isMergeableObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Recursively fill missing keys from `defaultObj` (see {@link defaults}). */
function hydrateRecord<T extends Record<string, unknown>>(
  defaultObj: T,
  dataObj: T,
): T {
  const out = {...defaultObj}
  for (const key of Object.keys(defaultObj) as (keyof T)[]) {
    const value = dataObj[key]
    if (value === undefined) {
      continue
    }
    const defaultValue = defaultObj[key]
    if (isMergeableObject(defaultValue) && isMergeableObject(value)) {
      out[key] = hydrateRecord(defaultValue, value)
    } else {
      out[key] = value
    }
  }
  // Keys stored in data but absent from defaults (e.g. externalEmbeds sources).
  for (const key of Object.keys(dataObj) as (keyof T)[]) {
    if (key in defaultObj) continue
    const value = dataObj[key]
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

/**
 * Fill missing keys from {@link defaults} so existing installs pick up new
 * settings without resetting storage.
 */
export function hydrateWithDefaults(data: Schema): Schema {
  return hydrateRecord(defaults, data)
}

function migrateMetricsDisplayPrefs(data: Schema): Schema {
  return {
    ...data,
    likesMetricsDisplay: migrateCountsMetricsDisplay(
      data.likesMetricsDisplay,
      data.disableLikesMetrics,
    ),
    repostsMetricsDisplay: migrateCountsMetricsDisplay(
      data.repostsMetricsDisplay,
      data.disableRepostsMetrics,
    ),
    quotesMetricsDisplay: migrateCountsMetricsDisplay(
      data.quotesMetricsDisplay,
      data.disableQuotesMetrics,
    ),
    savesMetricsDisplay: migrateCountsMetricsDisplay(
      data.savesMetricsDisplay,
      data.disableSavesMetrics,
    ),
    replyMetricsDisplay: migrateCountsMetricsDisplay(
      data.replyMetricsDisplay,
      data.disableReplyMetrics,
    ),
    followersMetricsDisplay: migrateCountsMetricsDisplay(
      data.followersMetricsDisplay,
      data.disableFollowersMetrics,
    ),
    followingMetricsDisplay: migrateCountsMetricsDisplay(
      data.followingMetricsDisplay,
      data.disableFollowingMetrics,
    ),
    postsMetricsDisplay: migrateCountsMetricsDisplay(
      data.postsMetricsDisplay,
      data.disablePostsMetrics,
    ),
    followedByMetricsDisplay: migrateFollowedByMetricsDisplay(
      data.followedByMetricsDisplay,
      data.disableFollowedByMetrics,
    ),
    notificationsTabBadgeDisplay:
      data.notificationsTabBadgeDisplay ?? data.notificationDotDisplay,
    chatsTabBadgeDisplay:
      data.chatsTabBadgeDisplay ?? data.notificationDotDisplay,
  }
}

export function normalizeData(data: Schema) {
  const next = hydrateWithDefaults(migrateMetricsDisplayPrefs(data))

  if ((data.imageFormatDefaultsVersion ?? 0) < 1) {
    /*
     * Older builds persisted automatic and explicitly selected WebP identically.
     * Migrate both once, then preserve any subsequent explicit WebP selections.
     */
    if (next.thumbnailFormat === 'webp') next.thumbnailFormat = 'default'
    if (next.fullsizeFormat === 'webp') next.fullsizeFormat = 'default'
    next.imageFormatDefaultsVersion = 1
  }

  if (next.imageCdnHost) {
    try {
      const origin = new URL(next.imageCdnHost).origin
      if (origin === 'https://cdn.bsky.app') {
        next.imageCdnHost = undefined
      } else if (origin === 'https://cdn.blueat.network') {
        next.imageCdnHost = 'https://luna.madebydanny.uk'
      }
    } catch {}
  }

  const imageCdnPresets = [
    'https://porxie-bsky.dollware.net',
    'https://luna.madebydanny.uk',
  ]
  const plcDirectoryPresets = [
    'https://plc.directory',
    'https://plc.eurosky.network',
    'https://plc.wafflehouse.dev',
  ]
  const constellationPresets = [
    'https://constellation.microcosm.blue',
    'https://constellation.wafflehouse.dev',
  ]
  const slingshotPresets = [
    'https://slingshot.microcosm.blue',
    'https://slingshot.wafflehouse.dev',
  ]

  if (!next.imageCdnHostCustom && next.imageCdnHost) {
    try {
      const origin = new URL(next.imageCdnHost).origin
      if (
        origin !== 'https://cdn.bsky.app' &&
        !imageCdnPresets.includes(origin)
      ) {
        next.imageCdnHostCustom = origin
      }
    } catch {}
  }

  if (!next.plcDirectoryCustom && next.plcDirectory) {
    try {
      const origin = new URL(next.plcDirectory).origin
      if (!plcDirectoryPresets.includes(origin)) {
        next.plcDirectoryCustom = origin
      }
    } catch {}
  }

  if (!next.constellationInstanceCustom && next.constellationInstance) {
    try {
      const origin = new URL(next.constellationInstance).origin
      if (!constellationPresets.includes(origin)) {
        next.constellationInstanceCustom = origin
      }
    } catch {}
  }

  if (!next.slingshotInstanceCustom && next.slingshotInstance) {
    try {
      const origin = new URL(next.slingshotInstance).origin
      if (!slingshotPresets.includes(origin)) {
        next.slingshotInstanceCustom = origin
      }
    } catch {}
  }

  /**
   * Normalize language prefs to ensure that these values only contain 2-letter
   * country codes without region.
   */
  try {
    const langPrefs = {...next.languagePrefs}
    langPrefs.primaryLanguage = normalizeLanguageTagToTwoLetterCode(
      langPrefs.primaryLanguage,
    )
    langPrefs.contentLanguages = dedupArray(
      langPrefs.contentLanguages.map(lang =>
        normalizeLanguageTagToTwoLetterCode(lang),
      ),
    )
    langPrefs.postLanguage = langPrefs.postLanguage
      .split(',')
      .map(lang => normalizeLanguageTagToTwoLetterCode(lang))
      .filter(Boolean)
      .join(',')
    langPrefs.postLanguageHistory = dedupArray(
      langPrefs.postLanguageHistory.map(postLanguage => {
        return postLanguage
          .split(',')
          .map(lang => normalizeLanguageTagToTwoLetterCode(lang))
          .filter(Boolean)
          .join(',')
      }),
    )
    next.languagePrefs = langPrefs
  } catch (e: any) {
    logger.error(`persisted state: failed to normalize language prefs`, {
      safeMessage: e.message,
    })
  }

  return next
}

export function normalizeLanguageTagToTwoLetterCode(lang: string) {
  const result = parse(lang).language
  return result ?? lang
}
