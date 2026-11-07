import {Client} from '@atproto/lex'
import {type AtIdentifierString, AtUri, type DidString} from '@atproto/syntax'
import {
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'

import {useDebouncedValue} from '#/lib/hooks/useDebouncedValue'
import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {STALE} from '#/state/queries'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {createQueryKey} from '#/state/queries/util'
import {
  BLUEMOJI_SERVICE,
  type BluemojiItem,
  type BluemojiRef,
  getBluemojiRefUri,
} from '#/features/bluemoji/util'
import {blue, com} from '#/lexicons'

const bluemojiClient = new Client(BLUEMOJI_SERVICE)
const bluemojiItemQueryKey = (uri: string, cid?: string) =>
  createQueryKey('useBluemojiItemQuery', {uri, cid})

/** Read through the owning PDS so formats and labels come from the source. */
export async function fetchBluemojiItem(
  uri: string,
  cid?: string,
): Promise<BluemojiItem | null> {
  const atUri = new AtUri(uri)
  if (
    atUri.collection !== 'blue.moji.collection.item' ||
    !atUri.host.startsWith('did:')
  )
    return null
  const pds = await resolvePdsServiceUrl(atUri.host as DidString)
  if (!pds || !pds.startsWith('https://')) return null
  const client = new Client(pds)
  try {
    const result = await client.call(com.atproto.repo.getRecord, {
      repo: atUri.host,
      collection: atUri.collection,
      rkey: atUri.rkey,
      cid,
    })
    const record = blue.moji.collection.item.$ifMatches(result.value)
    if (
      !record ||
      result.uri !== uri ||
      (cid && result.cid !== cid) ||
      !result.cid
    )
      return null
    return {uri, cid: result.cid, did: atUri.host as DidString, record}
  } catch (error) {
    if (
      error instanceof Error &&
      'error' in error &&
      error.error === 'RecordNotFound'
    )
      return null
    throw error
  }
}

export function bluemojiItemQueryOptions(ref: BluemojiRef) {
  const uri = getBluemojiRefUri(ref)
  return {
    queryKey: bluemojiItemQueryKey(uri ?? '', ref.record?.cid),
    staleTime: STALE.MINUTES.FIVE,
    queryFn: () =>
      uri ? fetchBluemojiItem(uri, ref.record?.cid) : Promise.resolve(null),
    enabled: Boolean(uri),
    retry: false,
  } as const
}

export function fetchBluemojiItemQuery(
  queryClient: QueryClient,
  ref: BluemojiRef,
) {
  return queryClient.fetchQuery(bluemojiItemQueryOptions(ref))
}

export function useBluemojiItemQuery(ref: BluemojiRef) {
  const uri = getBluemojiRefUri(ref)
  const enabled = useDeferredEnable(Boolean(uri))
  return useQuery({
    ...bluemojiItemQueryOptions(ref),
    enabled,
  })
}

export function useBluemojiSearchQuery({
  repo,
  query,
  enabled = true,
}: {
  repo?: string
  query: string
  enabled?: boolean
}) {
  const q = useDebouncedValue(query.trim().slice(0, 100), 300)
  return useInfiniteQuery({
    queryKey: createQueryKey('useBluemojiSearchQuery', {repo, q}),
    staleTime: STALE.MINUTES.ONE,
    initialPageParam: undefined as string | undefined,
    async queryFn({pageParam, signal}) {
      return fetchBluemojiDiscoveryPage({repo, q, cursor: pageParam, signal})
    },
    enabled: enabled && Boolean(repo || q),
    getNextPageParam: page => page.cursor,
    retry: false,
  })
}

/** Autocomplete results still require verification against the owning PDS. */
export async function fetchBluemojiSuggestions(
  queryClient: QueryClient,
  repo: string,
  query: string,
) {
  const q = query.trim().slice(0, 100)
  if (!repo || !q) return []
  const result = await queryClient.fetchQuery({
    queryKey: createQueryKey('useBluemojiSearchQuery', {
      repo,
      q,
      autocomplete: true,
    }),
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryFn: () => fetchBluemojiDiscoveryPage({repo, q, limit: 8}),
  })
  const verified = await Promise.allSettled(
    result.items.map(item =>
      fetchBluemojiItemQuery(queryClient, {
        did: item.did ?? '',
        name: item.name,
        record:
          item.uri && item.cid ? {uri: item.uri, cid: item.cid} : undefined,
      }),
    ),
  )
  return verified.flatMap(result =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  )
}

/**
 * Discovery views sometimes contain incorrectly JSON-encoded legacy bytes.
 * Validate references independently; images and labels must come from the PDS.
 */
export async function fetchBluemojiDiscoveryPage({
  repo,
  q,
  cursor,
  signal,
  limit = 25,
}: {
  repo?: string
  q: string
  cursor?: string
  signal?: AbortSignal
  limit?: number
}) {
  const params = {repo: repo as AtIdentifierString | undefined, limit, cursor}
  const options = {signal, validateResponse: false}
  const result: unknown = q
    ? await bluemojiClient.call(
        blue.moji.collection.searchItems,
        {...params, q},
        options,
      )
    : await bluemojiClient.call(
        blue.moji.collection.listCollection,
        params,
        options,
      )
  if (
    !result ||
    typeof result !== 'object' ||
    !('items' in result) ||
    !Array.isArray(result.items)
  )
    throw new Error('Invalid Bluemoji discovery response')
  const items = result.items.flatMap((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') return []
    const view = blue.moji.collection.item.itemView.$ifMatches({
      $type: 'blue.moji.collection.item#itemView',
      name: 'name' in candidate ? candidate.name : undefined,
      did: 'did' in candidate ? candidate.did : undefined,
      uri: 'uri' in candidate ? candidate.uri : undefined,
      cid: 'cid' in candidate ? candidate.cid : undefined,
      formats: {$type: 'blue.moji.collection.item#formats_v1'},
    })
    return view ? [view] : []
  })
  return {
    items,
    cursor:
      'cursor' in result && typeof result.cursor === 'string'
        ? result.cursor
        : undefined,
  }
}
