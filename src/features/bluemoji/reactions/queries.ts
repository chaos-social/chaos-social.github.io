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
    Array.from(
      {length: Math.ceil(uris.length / REACTION_COUNT_BATCH)},
      (_, i) => {
        const chunk = uris.slice(
          i * REACTION_COUNT_BATCH,
          (i + 1) * REACTION_COUNT_BATCH,
        )
        return client
          .call(
            blue.moji.feed.getReactionCounts,
            {uris: chunk as AtUriString[]},
            {validateResponse: false},
          )
          .then(result => parseCounts(result))
          .then(counts =>
            counts.forEach((groups, uri) => results.set(uri, groups)),
          )
          .catch(() => {
            /* A failed batch resolves as no reactions; readers retry on refetch. */
          })
      },
    ),
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

export function parseGroup(candidate: unknown): ReactionGroup[] {
  if (!candidate || typeof candidate !== 'object') return []
  const record = candidate as {emoji?: unknown; count?: unknown}
  if (typeof record.count !== 'number' || record.count <= 0) return []
  const emoji = parseEmojiRef(record.emoji)
  return emoji ? [{emoji, count: record.count}] : []
}

/**
 * Parsed by hand rather than through the generated validator: the lexicon
 * describes `formats` as CID strings (the inline-facet wire format), but the
 * AppView rebuilds reaction refs from the source item record and returns blob
 * objects. Strict validation rejects every real group.
 */
function parseEmojiRef(candidate: unknown): ReactionEmoji | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const record = candidate as Partial<Record<keyof ReactionEmoji, unknown>>
  if (typeof record.uri !== 'string' || typeof record.name !== 'string') {
    return undefined
  }
  // Reject anything that is not an item reference before trusting the URI.
  if (
    !record.uri.startsWith('at://') ||
    !record.uri.includes('/blue.moji.collection.item/')
  ) {
    return undefined
  }
  return {
    $type: 'blue.moji.feed.reaction#emojiRef',
    uri: record.uri,
    cid: typeof record.cid === 'string' ? record.cid : undefined,
    name: record.name,
    alt: typeof record.alt === 'string' ? record.alt : undefined,
    adultOnly: record.adultOnly === true,
    formats: (record.formats ?? {}) as ReactionEmoji['formats'],
  } as ReactionEmoji
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
          out.push({
            uri: record.uri,
            subject: value.subject,
            emoji: value.emoji,
          })
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

/**
 * The viewer's reactions on one post, plus whether their whole reaction list is
 * known. The second half matters because an empty list has to be distinguishable
 * from a list that has not loaded: only the former proves the viewer is not one
 * of the reactors a count is made of.
 */
export function useViewerReactionForPost(uri: string | undefined): {
  reactions: ViewerReaction[] | undefined
  known: boolean
} {
  const {data, isSuccess} = useViewerReactionsQuery()
  return {
    reactions: uri && data ? data.filter(r => r.subject === uri) : undefined,
    known: isSuccess,
  }
}

/**
 * Fold the viewer's own reactions into the AppView's groups.
 *
 * The reactor's PDS record is the authority on whether they reacted, and it is
 * written before the AppView's firehose has seen anything. Without this a fresh
 * reaction flickers in and back out until the AppView catches up.
 *
 * A viewer reaction only ever raises a group to 1, so a later AppView count
 * replaces it naturally instead of double counting.
 *
 * `ownReactionsKnown` says the viewer's own records were read successfully. Only
 * then does the absence of a reaction mean the viewer has none: it lets their
 * share be subtracted from the AppView's count, so a reaction removed here stops
 * showing even while the AppView still reports it (its index does not reliably
 * process reaction deletes). While the read is pending nothing is subtracted,
 * which is the old behaviour rather than a wrong one.
 */
export function mergeViewerReactions(
  groups: ReactionGroup[],
  viewerReactions: ViewerReaction[] | undefined,
  ownReactionsKnown = false,
): ReactionGroup[] {
  const byEmoji = new Map(groups.map(group => [group.emoji.uri, group]))
  const own = new Set(viewerReactions?.map(reaction => reaction.emoji.uri))

  if (ownReactionsKnown) {
    for (const [uri, group] of byEmoji) {
      // The viewer is one of the reactors the AppView counted, and is no
      // longer counted locally, so their reaction is gone.
      if (!own.has(uri) && group.count <= 1) byEmoji.delete(uri)
    }
  }

  for (const {emoji} of viewerReactions ?? []) {
    const existing = byEmoji.get(emoji.uri)
    byEmoji.set(emoji.uri, existing ? {...existing} : {emoji, count: 1})
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}

/**
 * Reactions whose record URI is real. Anything else is an optimistic entry the
 * PDS has not acknowledged yet, so it cannot be deleted or counted on.
 */
export function isPersistedReaction(reaction: ViewerReaction | undefined) {
  return Boolean(reaction?.uri && reaction.uri.startsWith('at://'))
}

/** AppView-wide trending, used as the Discover tab's default content. */
export function useTrendingEmojiQuery() {
  return useQuery({
    // Month: reactions are still sparse, and a week window is often empty.
    queryKey: createQueryKey(trendingRoot, {period: 'month'}),
    staleTime: STALE.MINUTES.FIVE,
    retry: false,
    queryFn: async (): Promise<ReactionGroup[]> => {
      const result: unknown = await client.call(
        blue.moji.feed.getTrending,
        {period: 'month', limit: 60},
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
