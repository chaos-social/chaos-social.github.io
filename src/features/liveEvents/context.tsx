import {createContext, useContext} from 'react'

import {
  convertBskyAppUrlIfNeeded,
  isBskyCustomFeedUrl,
  makeRecordUri,
} from '#/lib/strings/url-helpers'
import {useLiveEventPreferences} from '#/features/liveEvents/preferences'
import {type LiveEventsWorkerResponse} from '#/features/liveEvents/types'

export const DEFAULT_LIVE_EVENTS = {
  feeds: [],
}

const Context = createContext<LiveEventsWorkerResponse>(DEFAULT_LIVE_EVENTS)

export function Provider({children}: React.PropsWithChildren<{}>) {
  return (
    <Context.Provider value={DEFAULT_LIVE_EVENTS}>{children}</Context.Provider>
  )
}

export async function prefetchLiveEvents() {}

export function useLiveEvents() {
  const ctx = useContext(Context)
  if (!ctx) {
    throw new Error('useLiveEventsContext must be used within a Provider')
  }
  return ctx
}

export function useUserPreferencedLiveEvents() {
  const events = useLiveEvents()
  const {data, isLoading} = useLiveEventPreferences()
  if (isLoading) return DEFAULT_LIVE_EVENTS
  const {hideAllFeeds, hiddenFeedIds} = data
  return {
    ...events,
    feeds: hideAllFeeds
      ? []
      : events.feeds.filter(f => {
          const hidden = f?.id ? hiddenFeedIds.includes(f?.id || '') : false
          return !hidden
        }),
  }
}

export function useActiveLiveEventFeedUris() {
  const {feeds} = useLiveEvents()

  return new Set(
    feeds
      // insurance
      .filter(f => isBskyCustomFeedUrl(f.url))
      .map(f => {
        const uri = convertBskyAppUrlIfNeeded(f.url)
        const [_0, did, _1, rkey] = uri.split('/').filter(Boolean)
        const urip = makeRecordUri(did, 'app.bsky.feed.generator', rkey)
        return urip.toString()
      }),
  )
}
