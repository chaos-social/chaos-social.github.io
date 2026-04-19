import {MMKV} from 'react-native-mmkv'
import {setPolyfills} from '@growthbook/growthbook'
import {GrowthBook} from '@growthbook/growthbook-react'

import {getNavigationMetadata, type Metadata} from '#/analytics/metadata'
import * as env from '#/env'

export {Features} from '#/analytics/features/types'

const CACHE = new MMKV({id: 'bsky_features_cache'})

setPolyfills({
  localStorage: {
    getItem: key => {
      return CACHE.getString(key) ?? null
    },
    setItem: async (key, value) => {
      CACHE.set(key, value)
    },
  },
})

/**
 * We vary the amount of time we wait for GrowthBook to fetch feature
 * gates based on the strategy specified.
 */
export type FeatureFetchStrategy = 'prefer-low-latency' | 'prefer-fresh-gates'

export const features = new GrowthBook({
  apiHost: env.GROWTHBOOK_API_HOST,
  clientKey: env.GROWTHBOOK_CLIENT_KEY,
})

/**
 * Kept as a resolved promise so existing startup code can await it without
 * triggering any remote GrowthBook fetches.
 */
export const init = Promise.resolve()

/**
 * Refresh feature gates from GrowthBook. Updates attributes based on the
 * provided account, if any.
 */
export async function refresh(_: {strategy: FeatureFetchStrategy}) {}

/**
 * Converts our metadata into GrowthBook attributes and sets them. GrowthBook
 * attributes are manually configured in the GrowthBook dashboard. So these
 * values need to match exactly. Therefore, let's add them here manually to and
 * not spread them to avoid mistakes.
 */
export function setAttributes({
  base,
  geolocation,
  session,
  preferences,
}: Metadata) {
  features.setAttributes({
    deviceId: base.deviceId,
    sessionId: base.sessionId,
    platform: base.platform,
    appVersion: base.appVersion,
    countryCode: geolocation.countryCode,
    regionCode: geolocation.regionCode,
    did: session?.did,
    isBskyPds: session?.isBskyPds,
    appLanguage: preferences?.appLanguage,
    contentLanguages: preferences?.contentLanguages,
    currentScreen: getNavigationMetadata()?.currentScreen,
  })
}
