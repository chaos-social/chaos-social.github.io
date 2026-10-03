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
}: {
  repo?: string
  query: string
}) {
  const q = useDebouncedValue(query.trim().slice(0, 100), 300)
  return useInfiniteQuery({
    queryKey: createQueryKey('useBluemojiSearchQuery', {repo, q}),
    staleTime: STALE.MINUTES.ONE,
    initialPageParam: undefined as string | undefined,
    async queryFn({pageParam, signal}) {
      if (q)
        return bluemojiClient.call(
          blue.moji.collection.searchItems,
          {
            repo: repo as AtIdentifierString | undefined,
            q,
            limit: 25,
            cursor: pageParam,
          },
          {signal},
        )
      return bluemojiClient.call(
        blue.moji.collection.listCollection,
        {
          repo: repo as AtIdentifierString | undefined,
          limit: 25,
          cursor: pageParam,
        },
        {signal},
      )
    },
    enabled: Boolean(repo || q),
    getNextPageParam: page => page.cursor,
    retry: false,
  })
}
