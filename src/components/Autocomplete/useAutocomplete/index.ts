import {useCallback, useMemo} from 'react'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {keepPreviousData, useQuery} from '@tanstack/react-query'

import {searchActorsTypeahead} from '#/lib/api/search-actors-typeahead'
import {isJustAMute, moduiContainsHideableOffense} from '#/lib/moderation'
import {parseSearchLink} from '#/lib/routes/searchLink'
import {
  useCustomAppViewDid,
  useCustomAppViewUrl,
} from '#/state/preferences/custom-appview-did'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {DEFAULT_LOGGED_OUT_PREFERENCES} from '#/state/queries/preferences'
import {useAppviewClient} from '#/state/session'
import {
  type AutocompleteApi,
  type AutocompleteItem,
  type AutocompleteItemType,
  type AutocompleteProfile,
} from '#/components/Autocomplete/types'
import {type app} from '#/lexicons'
import {useEmojiSearch} from './useEmojiSearch'

const DEFAULT_MOD_OPTS = {
  userDid: undefined,
  prefs: DEFAULT_LOGGED_OUT_PREFERENCES.moderationPrefs,
}

export function useAutocomplete({
  type,
  query: q,
  limit,
  showSearchFallback = false,
}: {
  type: AutocompleteItemType
  query: string
  limit?: number
  showSearchFallback?: boolean
}): AutocompleteApi {
  const client = useAppviewClient()
  const [appViewDid] = useCustomAppViewDid()
  const [appViewUrl] = useCustomAppViewUrl()
  const moderationOpts = useModerationOpts()
  const emojiSearch = useEmojiSearch()

  const query = useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: [
      'autocomplete',
      {
        type,
        query: q,
        appViewDid,
        appViewUrl,
      },
    ],
    async queryFn() {
      if (type === 'profile') {
        // TODO return recents
        if (!q) return []

        // Going from "foo" to "foo." should not clear matches.
        q = q.toLowerCase().trim().replace(/\.$/, '')

        const data = await searchActorsTypeahead(client, {
          q,
          limit: limit || 8,
        })

        return (data?.actors || []).map(profile => ({
          key: profile.did,
          type: 'profile' as const,
          value: '@' + profile.handle,
          profile,
        }))
      } else if (type === 'emoji') {
        return emojiSearch(q, limit || 8)
      }

      return []
    },
    select: useCallback(
      (items: AutocompleteItem[]) => {
        const seen = new Set<string>()
        let results: AutocompleteItem[] = []

        for (const item of items) {
          if (seen.has(item.key)) continue
          seen.add(item.key)

          if (item.type === 'profile') {
            const moderated = moderateProfileItem({
              query: q,
              item,
              moderationOpts: moderationOpts || DEFAULT_MOD_OPTS,
            })
            if (moderated) results.push(moderated)
          } else {
            results.push(item)
          }
        }

        return results
      },
      [q, moderationOpts],
    ),
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => {
    const results: AutocompleteItem[] = [...(query.data ?? [])]

    if (showSearchFallback && q) {
      if (parseSearchLink(q)) {
        results.unshift({key: `open-link-${q}`, type: 'open-link', value: q})
      }
      results.unshift({
        key: `search-${q}`,
        type: 'search' as const,
        value: q,
      })
    }

    return results
  }, [query.data, showSearchFallback, q])

  return {
    query: q,
    items,
    isFetching: query.isFetching,
  }
}

function moderateProfileItem({
  query,
  item,
  moderationOpts,
}: {
  query: string
  item: AutocompleteProfile
  moderationOpts: ModerationOpts
}) {
  const modui = moderateProfile(item.profile, moderationOpts).ui('profileList')
  const isExactMatch = query && item.profile.handle.toLowerCase() === query

  if (
    (isExactMatch && !moduiContainsHideableOffense(modui)) ||
    !modui.filter ||
    isJustAMute(modui)
  ) {
    return item
  }

  return null
}
