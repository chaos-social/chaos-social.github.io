import {useCallback, useMemo} from 'react'
import {hasMutedWord} from '@bsky/sdk/moderation'
import {useQuery} from '@tanstack/react-query'

import {
  aggregateUserInterests,
  createBskyTopicsHeader,
} from '#/lib/api/feed/utils'
import {logger} from '#/logger'
import {
  APPVIEW_PRESETS,
  getActiveAppViewPreset,
  useCustomAppViewDid,
  useCustomAppViewUrl,
} from '#/state/preferences/custom-appview-did'
import {getContentLanguages} from '#/state/preferences/languages'
import {useTrendingSettings} from '#/state/preferences/trending'
import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {useAppviewClient} from '#/state/session'
import {app} from '#/lexicons'

export const DEFAULT_LIMIT = 10
export const DEFAULT_FETCH_LIMIT = 25

type QueryProps = {
  fetchLimit?: number
  limit?: number
  refetchOnWindowFocus?: boolean
}

function dedupe<T extends {link: string}>(trends: T[]): T[] {
  const seen = new Set<string>()
  return trends.filter(trend => {
    if (seen.has(trend.link)) return false
    seen.add(trend.link)
    return true
  })
}

export const createGetTrendsQueryKey = (fetchLimit?: number) =>
  fetchLimit === undefined ? ['trends'] : ['trends', {limit: fetchLimit}]

export function useGetTrendsQuery(props: QueryProps = {}) {
  const client = useAppviewClient()
  const [appViewDid] = useCustomAppViewDid()
  const [appViewUrl] = useCustomAppViewUrl()
  const isBlacksky =
    getActiveAppViewPreset(appViewDid, appViewUrl) === 'blacksky'
  const {trendingTopicCount} = useTrendingSettings()
  const {data: preferences} = usePreferencesQuery()
  const fetchLimit = props.fetchLimit ?? DEFAULT_FETCH_LIMIT
  const limit = props.limit ?? trendingTopicCount
  const mutedWords = useMemo(() => {
    return preferences?.moderationPrefs?.mutedWords || []
  }, [preferences?.moderationPrefs])

  return useQuery({
    enabled: !!preferences,
    refetchOnWindowFocus: props.refetchOnWindowFocus,
    staleTime: STALE.MINUTES.THREE,
    queryKey: [...createGetTrendsQueryKey(fetchLimit), appViewDid, appViewUrl],
    queryFn: async () => {
      const contentLangs = getContentLanguages().join(',')
      const headers = {
        ...createBskyTopicsHeader(aggregateUserInterests(preferences)),
        'Accept-Language': contentLangs,
      }
      if (isBlacksky) {
        const response = await fetch(
          `${APPVIEW_PRESETS.blacksky.url}/xrpc/app.bsky.unspecced.getTrends?limit=${fetchLimit}`,
          {headers},
        )
        if (!response.ok)
          throw new Error(`getTrends failed: ${response.status}`)
        return (await response.json()) as app.bsky.unspecced.getTrends.$OutputBody
      }
      const data = await client.call(
        app.bsky.unspecced.getTrends,
        {
          limit: fetchLimit,
        },
        {
          headers: {
            ...createBskyTopicsHeader(aggregateUserInterests(preferences)),
            'Accept-Language': contentLangs,
          },
        },
      )
      if (!data.recIdStr) {
        logger.debug('useGetTrendsQuery response missing recIdStr')
      }
      return data
    },
    select: useCallback(
      (data: app.bsky.unspecced.getTrends.$OutputBody) => {
        return {
          recId: data.recIdStr,
          trends: dedupe(
            (data.trends ?? []).filter(t => {
              return !hasMutedWord({
                mutedWords,
                text: `${t.topic} ${t.displayName} ${t.category}`,
              })
            }),
          ).slice(0, limit),
        }
      },
      [limit, mutedWords],
    ),
  })
}
