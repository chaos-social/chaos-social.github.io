import {useEffect, useMemo} from 'react'
import {
  type AppBskyActorDefs,
  type BskyFeedViewPreference,
  type BskyPreferences,
  type LabelPreference,
} from '@atproto/api'
import {TID} from '@atproto/common-web'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {PROD_DEFAULT_FEED} from '#/lib/constants'
import {replaceEqualDeep} from '#/lib/functions'
import {getAge} from '#/lib/strings/time'
import {GCTIME, STALE} from '#/state/queries'
import {
  DEFAULT_HOME_FEED_PREFS,
  DEFAULT_LOGGED_OUT_PREFERENCES,
  DEFAULT_THREAD_VIEW_PREFS,
} from '#/state/queries/preferences/const'
import {
  type ThreadViewPreferences,
  type UsePreferencesQueryResponse,
} from '#/state/queries/preferences/types'
import {createQueryKey} from '#/state/queries/util'
import {useBlankPrefAuthedAgent as useAgent} from '#/state/session'
import {pdsAgent} from '#/state/session/agent'
import {saveLabelers} from '#/state/session/agent-config'
import {useAgeAssurance} from '#/ageAssurance'
import {makeAgeRestrictedModerationPrefs} from '#/ageAssurance/util'
import {useAnalytics} from '#/analytics'

export * from '#/state/queries/preferences/const'
export * from '#/state/queries/preferences/moderation'
export * from '#/state/queries/preferences/types'

export const preferencesQueryKey = createQueryKey(
  'getPreferences',
  {},
  {persistedVersion: 1},
)

/**
 * Some screens interpret missing prefs as "use defaults", which causes a
 * visible flicker when the preferences query briefly has no data. Retain the
 * last successful snapshot per account so those consumers stay stable.
 */
const lastKnownPreferencesByDid = new Map<string, UsePreferencesQueryResponse>()

function normalizePreferences(
  res: BskyPreferences,
): UsePreferencesQueryResponse {
  return {
    ...res,
    savedFeeds: res.savedFeeds.filter(f => f.type !== 'unknown'),
    /**
     * Special preference, only used for following feed, previously
     * called `home`
     */
    feedViewPrefs: {
      ...DEFAULT_HOME_FEED_PREFS,
      ...(res.feedViewPrefs.home || {}),
    },
    threadViewPrefs: {
      ...DEFAULT_THREAD_VIEW_PREFS,
      ...(res.threadViewPrefs ?? {}),
    },
    userAge: res.birthDate ? getAge(res.birthDate) : undefined,
  }
}

function ensureBirthDate(
  preferences: UsePreferencesQueryResponse,
): UsePreferencesQueryResponse {
  if (!preferences.birthDate || preferences.birthDate instanceof Date) {
    return preferences
  }
  return {
    ...preferences,
    birthDate: new Date(preferences.birthDate),
  }
}

function applyAgeAssurancePreferences(
  data: UsePreferencesQueryResponse,
  aa: ReturnType<typeof useAgeAssurance>,
) {
  /**
   * Prefs are all downstream of age assurance now. For logged-out
   * users, we override moderation prefs based on AA state.
   */
  if (aa.state.access !== aa.Access.Full) {
    return {
      ...data,
      moderationPrefs: makeAgeRestrictedModerationPrefs(data.moderationPrefs),
    }
  }
  return data
}

type PreferencesMutationContext = {
  previousPreferences: UsePreferencesQueryResponse | undefined
}

function updateCachedPreferences(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (data: UsePreferencesQueryResponse) => UsePreferencesQueryResponse,
) {
  queryClient.setQueryData<UsePreferencesQueryResponse | undefined>(
    preferencesQueryKey,
    previous => (previous ? updater(previous) : previous),
  )
}

async function mutateCachedPreferences(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (data: UsePreferencesQueryResponse) => UsePreferencesQueryResponse,
): Promise<PreferencesMutationContext> {
  await queryClient.cancelQueries({queryKey: preferencesQueryKey})
  const previousPreferences =
    queryClient.getQueryData<UsePreferencesQueryResponse>(preferencesQueryKey)
  updateCachedPreferences(queryClient, updater)
  return {previousPreferences}
}

function restoreCachedPreferences(
  queryClient: ReturnType<typeof useQueryClient>,
  context: PreferencesMutationContext | undefined,
) {
  if (!context) return
  queryClient.setQueryData(preferencesQueryKey, context.previousPreferences)
}

function refetchPreferences(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    queryKey: preferencesQueryKey,
  })
}

export function usePreferencesQuery() {
  const agent = useAgent()
  const aa = useAgeAssurance()

  const query = useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    structuralSharing: replaceEqualDeep,
    refetchOnWindowFocus: true,
    queryKey: preferencesQueryKey,
    gcTime: GCTIME.INFINITY,
    queryFn: async () => {
      if (!agent.did) {
        return DEFAULT_LOGGED_OUT_PREFERENCES
      } else {
        const res = await pdsAgent(agent).getPreferences()

        // save to local storage to ensure there are labels on initial requests
        void saveLabelers(
          agent.did,
          res.moderationPrefs.labelers.map((l: {did: string}) => l.did),
        )

        return normalizePreferences(res)
      }
    },
  })

  useEffect(() => {
    if (agent.did && query.data) {
      lastKnownPreferencesByDid.set(agent.did, ensureBirthDate(query.data))
    }
  }, [agent.did, query.data])

  const stableData = useMemo(() => {
    const data =
      query.data ??
      (agent.did ? lastKnownPreferencesByDid.get(agent.did) : undefined)
    if (!data) {
      return data
    }
    return applyAgeAssurancePreferences(ensureBirthDate(data), aa)
  }, [aa, agent.did, query.data])

  if (!stableData) {
    return query
  }

  return {
    ...query,
    data: stableData,
    error: null,
    isError: false,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    status: 'success',
  }
}

export function useClearPreferencesMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async () => {
      await pdsAgent(agent).app.bsky.actor.putPreferences({preferences: []})
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function usePreferencesSetContentLabelMutation() {
  const ax = useAnalytics()
  const agent = useAgent()
  const queryClient = useQueryClient()

  return useMutation<
    void,
    unknown,
    {label: string; visibility: LabelPreference; labelerDid: string | undefined}
  >({
    mutationFn: async ({label, visibility, labelerDid}) => {
      await agent.setContentLabelPref(label, visibility, labelerDid)
      ax.metric('moderation:changeLabelPreference', {preference: visibility})
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useSetContentLabelMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async ({
      label,
      visibility,
      labelerDid,
    }: {
      label: string
      visibility: LabelPreference
      labelerDid?: string
    }) => {
      await agent.setContentLabelPref(label, visibility, labelerDid)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function usePreferencesSetAdultContentMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<void, unknown, {enabled: boolean}>({
    mutationFn: async ({enabled}) => {
      await agent.setAdultContentEnabled(enabled)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useSetFeedViewPreferencesMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<void, unknown, Partial<BskyFeedViewPreference>>({
    mutationFn: async prefs => {
      /*
       * special handling here, merged into `feedViewPrefs` above, since
       * following was previously called `home`
       */
      await agent.setFeedViewPrefs('home', prefs)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useSetThreadViewPreferencesMutation({
  onSuccess,
  onError,
}: {
  onSuccess?: (data: void, variables: Partial<ThreadViewPreferences>) => void
  onError?: (error: unknown) => void
}) {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<void, unknown, Partial<ThreadViewPreferences>>({
    mutationFn: async prefs => {
      await agent.setThreadViewPrefs(prefs)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
    onSuccess,
    onError,
  })
}

export function useOverwriteSavedFeedsMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<
    void,
    unknown,
    AppBskyActorDefs.SavedFeed[],
    PreferencesMutationContext
  >({
    onMutate: savedFeeds =>
      mutateCachedPreferences(queryClient, data => ({
        ...data,
        savedFeeds,
      })),
    onError: (_error, _savedFeeds, context) => {
      restoreCachedPreferences(queryClient, context)
    },
    onSettled: () => {
      refetchPreferences(queryClient)
    },
    mutationFn: async savedFeeds => {
      await agent.overwriteSavedFeeds(savedFeeds)
    },
  })
}

export function useAddSavedFeedsMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<
    void,
    unknown,
    Pick<AppBskyActorDefs.SavedFeed, 'type' | 'value' | 'pinned'>[],
    PreferencesMutationContext
  >({
    onMutate: savedFeeds =>
      mutateCachedPreferences(queryClient, data => ({
        ...data,
        savedFeeds: data.savedFeeds.concat(
          savedFeeds.map(savedFeed => ({
            ...savedFeed,
            id: TID.nextStr(),
          })),
        ),
      })),
    onError: (_error, _savedFeeds, context) => {
      restoreCachedPreferences(queryClient, context)
    },
    onSettled: () => {
      refetchPreferences(queryClient)
    },
    mutationFn: async savedFeeds => {
      await agent.addSavedFeeds(savedFeeds)
    },
  })
}

export function useRemoveFeedMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<
    void,
    unknown,
    Pick<AppBskyActorDefs.SavedFeed, 'id'>,
    PreferencesMutationContext
  >({
    onMutate: savedFeed =>
      mutateCachedPreferences(queryClient, data => ({
        ...data,
        savedFeeds: data.savedFeeds.filter(feed => feed.id !== savedFeed.id),
      })),
    onError: (_error, _savedFeed, context) => {
      restoreCachedPreferences(queryClient, context)
    },
    onSettled: () => {
      refetchPreferences(queryClient)
    },
    mutationFn: async savedFeed => {
      await agent.removeSavedFeeds([savedFeed.id])
    },
  })
}

export function useReplaceForYouWithDiscoverFeedMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<
    void,
    unknown,
    {
      forYouFeedConfig: AppBskyActorDefs.SavedFeed | undefined
      discoverFeedConfig: AppBskyActorDefs.SavedFeed | undefined
    },
    PreferencesMutationContext
  >({
    onMutate: ({forYouFeedConfig, discoverFeedConfig}) =>
      mutateCachedPreferences(queryClient, data => {
        let savedFeeds = data.savedFeeds

        if (forYouFeedConfig) {
          savedFeeds = savedFeeds.filter(
            feed => feed.id !== forYouFeedConfig.id,
          )
        }

        if (!discoverFeedConfig) {
          savedFeeds = savedFeeds.concat({
            type: 'feed',
            value: PROD_DEFAULT_FEED('whats-hot'),
            pinned: true,
            id: TID.nextStr(),
          })
        } else {
          savedFeeds = savedFeeds.map(feed =>
            feed.id === discoverFeedConfig.id ? {...feed, pinned: true} : feed,
          )
        }

        return {
          ...data,
          savedFeeds,
        }
      }),
    onError: (_error, _variables, context) => {
      restoreCachedPreferences(queryClient, context)
    },
    onSettled: () => {
      refetchPreferences(queryClient)
    },
    mutationFn: async ({
      forYouFeedConfig,
      discoverFeedConfig,
    }: {
      forYouFeedConfig: AppBskyActorDefs.SavedFeed | undefined
      discoverFeedConfig: AppBskyActorDefs.SavedFeed | undefined
    }) => {
      if (forYouFeedConfig) {
        await agent.removeSavedFeeds([forYouFeedConfig.id])
      }
      if (!discoverFeedConfig) {
        await agent.addSavedFeeds([
          {
            type: 'feed',
            value: PROD_DEFAULT_FEED('whats-hot'),
            pinned: true,
          },
        ])
      } else {
        await agent.updateSavedFeeds([
          {
            ...discoverFeedConfig,
            pinned: true,
          },
        ])
      }
    },
  })
}

export function useUpdateSavedFeedsMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<
    void,
    unknown,
    AppBskyActorDefs.SavedFeed[],
    PreferencesMutationContext
  >({
    onMutate: feeds =>
      mutateCachedPreferences(queryClient, data => {
        const nextById = new Map(feeds.map(feed => [feed.id, feed]))
        return {
          ...data,
          savedFeeds: data.savedFeeds.map(
            feed => nextById.get(feed.id) ?? feed,
          ),
        }
      }),
    onError: (_error, _feeds, context) => {
      restoreCachedPreferences(queryClient, context)
    },
    onSettled: () => {
      refetchPreferences(queryClient)
    },
    mutationFn: async feeds => {
      await agent.updateSavedFeeds(feeds)
    },
  })
}

export function useUpsertMutedWordsMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (mutedWords: AppBskyActorDefs.MutedWord[]) => {
      await agent.upsertMutedWords(mutedWords)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useUpdateMutedWordMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (mutedWord: AppBskyActorDefs.MutedWord) => {
      await agent.updateMutedWord(mutedWord)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useRemoveMutedWordMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (mutedWord: AppBskyActorDefs.MutedWord) => {
      await agent.removeMutedWord(mutedWord)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useRemoveMutedWordsMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (mutedWords: AppBskyActorDefs.MutedWord[]) => {
      await agent.removeMutedWords(mutedWords)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useQueueNudgesMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (nudges: string | string[]) => {
      await agent.bskyAppQueueNudges(nudges)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useDismissNudgesMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (nudges: string | string[]) => {
      await agent.bskyAppDismissNudges(nudges)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useSetActiveProgressGuideMutation() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    mutationFn: async (
      guide: AppBskyActorDefs.BskyAppProgressGuide | undefined,
    ) => {
      await agent.bskyAppSetActiveProgressGuide(guide)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useSetVerificationPrefsMutation() {
  const ax = useAnalytics()
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation<void, unknown, AppBskyActorDefs.VerificationPrefs>({
    mutationFn: async prefs => {
      await agent.setVerificationPrefs(prefs)
      if (prefs.hideBadges) {
        ax.metric('verification:settings:hideBadges', {})
      } else {
        ax.metric('verification:settings:unHideBadges', {})
      }
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}
