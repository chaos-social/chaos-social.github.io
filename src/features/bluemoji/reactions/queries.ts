import {type AtUriString} from '@atproto/syntax'
import {useInfiniteQuery, useQuery, useQueryClient} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {createServiceClient} from '#/lib/lexClient'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {
  REACTION_COLLECTION,
  REACTION_COUNT_BATCH,
  type ReactionEmoji,
  type ReactionGroup,
} from '#/features/bluemoji/reactions/util'
import {BLUEMOJI_SERVICE} from '#/features/bluemoji/util'
import {blue, com} from '#/lexicons'

const client = createServiceClient(BLUEMOJI_SERVICE)

const countsRoot = 'bluemoji-reaction-counts'
const reactionsRoot = 'bluemoji-reactions'
const viewerRoot = 'bluemoji-viewer-reactions'
const trendingRoot = 'bluemoji-trending'

/*
 * Reaction counts are looked up per post but fetched in bulk: rendering a feed
 * kicks off one query per visible post, and sending one request each would
 * hammer the AppView. Requests arriving in the same tick are coalesced into a
 * single call and each post resolves from the shared response.
 */
const pending = new Map<string, (groups: ReactionGroup[]) => void>()
let flushHandle: ReturnType<typeof setTimeout> | null = null

async function flushCounts() {
  flushHandle = null
  const uris = [...pending.keys()]
  const waiters = new Map(pending)
  pending.clear()
  const results = new Map<string, ReactionGroup[]>()
  await Promise.all(
    Array.from({length: Math.ceil(uris.length / REACTION_COUNT_BATCH)}, (_, i) => {
      const chunk = uris.slice(i * REACTION_COUNT_BATCH, (i + 1) * REACTION_COUNT_BATCH)
      return client
        .call(
          blue.moji.feed.getReactionCounts,
          {uris: chunk as AtUriString[]},
          {validateResponse: false},
        )
        .then(result => parseCounts(result))
        .then(counts => counts.forEach((groups, uri) => results.set(uri, groups)))
        .catch(() => {
          /* A failed batch resolves as no reactions; readers retry on refetch. */
        })
    }),
  )
  for (const [uri, resolve] of waiters) resolve(results.get(uri) ?? [])
}

function parseCounts(result: unknown) {
  const counts = new Map<string, ReactionGroup[]>()
  if (!result || typeof result !== 'object' || !('counts' in result)) {
    return counts
  }
  const list = (result as {counts?: unknown}).counts
  if (!Array.isArray(list)) return counts
  for (const entry of list as unknown[]) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as {uri?: unknown; groups?: unknown}
    if (typeof record.uri !== 'string' || !Array.isArray(record.groups)) {
      continue
    }
    counts.set(record.uri, (record.groups as unknown[]).flatMap(parseGroup))
  }
  return counts
}

function parseGroup(candidate: unknown): ReactionGroup[] {
  if (!candidate || typeof candidate !== 'object') return []
  const parsed = blue.moji.feed.defs.reactionGroup.$ifMatches({
    $type: 'blue.moji.feed.defs#reactionGroup',
    emoji: 'emoji' in candidate ? candidate.emoji : undefined,
    count: 'count' in candidate ? candidate.count : undefined,
  })
  return parsed && parsed.count > 0
    ? [{emoji: parsed.emoji, count: parsed.count}]
    : []
}

export function fetchReactionCounts(uri: string): Promise<ReactionGroup[]> {
  return new Promise(resolve => {
    pending.set(uri, resolve)
    flushHandle ??= setTimeout(() => void flushCounts(), 0)
  })
}

export function reactionCountsQueryOptions(uri: string) {
  return {
    queryKey: createQueryKey(countsRoot, {uri}),
    staleTime: STALE.MINUTES.ONE,
    queryFn: () => fetchReactionCounts(uri),
    enabled: Boolean(uri),
    retry: false,
  } as const
}

export function useReactionCountsQuery(uri: string | undefined) {
  const enabled = useDeferredEnable(Boolean(uri))
  return useQuery({...reactionCountsQueryOptions(uri ?? ''), enabled})
}

export function usePostReactionsQuery(uri: string | undefined) {
  const enabled = useDeferredEnable(Boolean(uri))
  return useInfiniteQuery({
    queryKey: createQueryKey(reactionsRoot, {uri}),
    staleTime: STALE.MINUTES.ONE,
    initialPageParam: undefined as string | undefined,
    enabled,
    queryFn: ({pageParam}) => fetchReactions(uri ?? '', pageParam),
    getNextPageParam: page => page.cursor,
    retry: false,
  })
}

async function fetchReactions(uri: string, cursor?: string) {
  const result: unknown = await client.call(
    blue.moji.feed.getReactions,
    {uri: uri as AtUriString, limit: 50, cursor},
    {validateResponse: false},
  )
  const body = result as {
    groups?: unknown[]
    reactions?: unknown[]
    cursor?: string
  }
  return {
    groups: (body.groups ?? []).flatMap(parseGroup),
    reactions: (body.reactions ?? []).flatMap(candidate => {
      const parsed = blue.moji.feed.defs.reactionView.$ifMatches(candidate)
      return parsed ? [parsed] : []
    }),
    cursor: body.cursor,
  }
}

/**
 * NFC of the label text, for group ordering keys only - the emoji URI is the
 * identity everywhere else.
 */
export function getGroupKey(emoji: ReactionEmoji) {
  return emoji.uri
}

/** Merged counts for a post, largest group first. */
export function useReactionGroups(uri: string | undefined) {
  const {data} = useReactionCountsQuery(uri)
  return data ?? []
}

/**
 * The viewer's own reactions. moji.blue only fills `group.viewer` for
 * requests authenticated as that actor, and our users' sessions live with our
 * OAuth client, so we read our own repo instead. Reactions use TID rkeys, so
 * the only way in is to walk the collection once per account.
 */
export function useViewerReactionsQuery() {
  const pds = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const enabled = useDeferredEnable(Boolean(did))
  return useQuery({
    queryKey: createQueryKey(viewerRoot, {did}),
    staleTime: STALE.MINUTES.ONE,
    enabled: enabled && Boolean(did),
    retry: false,
    queryFn: async (): Promise<ViewerReaction[]> => {
      if (!did) return []
      const out: ViewerReaction[] = []
      let cursor: string | undefined
      do {
        const page = await pds.call(com.atproto.repo.listRecords, {
          repo: did,
          collection: REACTION_COLLECTION,
          limit: 100,
          reverse: true,
          cursor,
        })
        for (const record of page.records) {
          const value = blue.moji.feed.reaction.main.$ifMatches(record.value)
          if (!value) continue
          out.push({uri: record.uri, subject: value.subject, emoji: value.emoji})
        }
        cursor = page.cursor
      } while (cursor && out.length < 500)
      return out
    },
  })
}

export type ViewerReaction = {
  uri: string
  subject: string
  emoji: ReactionEmoji
}

export function useViewerReactionForPost(uri: string | undefined) {
  const {data} = useViewerReactionsQuery()
  if (!uri || !data) return undefined
  return data.filter(r => r.subject === uri)
}

/** AppView-wide trending, used as the Discover tab's default content. */
export function useTrendingEmojiQuery() {
  return useQuery({
    queryKey: createQueryKey(trendingRoot, {period: 'week'}),
    staleTime: STALE.MINUTES.FIVE,
    retry: false,
    queryFn: async (): Promise<ReactionGroup[]> => {
      const result: unknown = await client.call(
        blue.moji.feed.getTrending,
        {period: 'week', limit: 60},
        {validateResponse: false},
      )
      const items =
        result && typeof result === 'object' && 'items' in result
          ? (result as {items?: unknown[]}).items
          : undefined
      return (items ?? []).flatMap(parseGroup)
    },
  })
}

export function useInvalidateReactions() {
  const queryClient = useQueryClient()
  return async (uri: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: createQueryKey(countsRoot, {uri}),
      }),
      queryClient.invalidateQueries({
        queryKey: createQueryKey(reactionsRoot, {uri}),
      }),
    ])
    void queryClient.invalidateQueries({queryKey: [viewerRoot]})
  }
}
