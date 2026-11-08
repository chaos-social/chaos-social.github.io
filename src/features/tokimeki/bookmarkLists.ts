import {type Client} from '@atproto/lex'
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'

import {
  readTokimekiProxyService,
  useTokimekiProxyService,
} from '#/state/preferences/tokimeki-instance'
import {STALE} from '#/state/queries'
import {
  unwrapCursor,
  useCursorPagination,
} from '#/state/queries/cursor-pagination'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, usePdsClient, useSession} from '#/state/session'
import {app} from '#/lexicons'

export type TokimekiBookmarkList = {id: number; name: string; text?: string}

type XrpcParams = Record<string, string | number | undefined>

/*
 * The `tech.tokimeki.bookmark.*` endpoints are unpublished (there are no
 * generated lexicons for them), so these are raw XRPC calls with a hand-set
 * `atproto-proxy`. The PDS resolves TOKIMEKI's DID document and forwards the
 * call with service auth.
 *
 * Callers pass the PDS client, not the appview one: these requests go to a
 * third party, so they must not carry the appview's device/session identifiers
 * or moderation authorities.
 *
 * The proxy target comes from the Infrastructure setting, so an operator can
 * point these calls at a different TOKIMEKI AppView.
 */
export async function tokimekiXrpc<T>(
  client: Client,
  method: string,
  {query, body}: {query?: XrpcParams; body?: unknown} = {},
): Promise<T> {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, String(value))
  }
  const qs = search.toString()
  const res = await client.agent.fetchHandler(
    `/xrpc/${method}${qs ? `?${qs}` : ''}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'atproto-proxy': readTokimekiProxyService(),
        accept: 'application/json',
        ...(body === undefined ? {} : {'content-type': 'application/json'}),
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    },
  )
  if (!res.ok) {
    /*
     * TOKIMEKI answers some failures with a bare text/plain "Bad Request"
     * instead of an XRPC error body, so surface whatever it does send - the
     * status alone gives nothing to debug when the shape is wrong.
     */
    const detail = await res.text().catch(() => '')
    throw new Error(
      `${method} failed: ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`,
    )
  }
  /*
   * Writes answer 200 with an empty body, so only parse when the response says
   * it is JSON. Calling res.json() unconditionally turns a successful write
   * into a thrown error, which leaves the mutation looking failed.
   */
  if (!res.headers.get('content-type')?.includes('application/json')) {
    return undefined as T
  }
  return (await res.json()) as T
}

const LISTS_KEY_ROOT = 'tokimeki-bookmark-lists'
const FEED_KEY_ROOT = 'tokimeki-bookmark-feed'
export const RELATED_KEY_ROOT = 'tokimeki-related-bookmarks'

/* The proxy target is part of the key, so switching it refetches everything. */
export const createBookmarkListsQueryKey = (
  owner: string | undefined,
  service: string,
) => createQueryKey(LISTS_KEY_ROOT, {owner, service})
const feedQueryKey = (
  owner: string | undefined,
  listId: string,
  service: string,
) => createQueryKey(FEED_KEY_ROOT, {owner, listId, service})
const relatedQueryKey = (
  owner: string | undefined,
  cid: string,
  service: string,
) => createQueryKey(RELATED_KEY_ROOT, {owner, cid, service})

export function useTokimekiBookmarkListsQuery() {
  const client = usePdsClient()
  const {hasSession} = useSession()
  const service = useTokimekiProxyService()
  const owner = client.did
  return useQuery({
    queryKey: createBookmarkListsQueryKey(owner, service),
    enabled: hasSession && Boolean(owner),
    staleTime: STALE.MINUTES.ONE,
    async queryFn() {
      return await tokimekiXrpc<{bookmarks: TokimekiBookmarkList[]}>(
        client,
        'tech.tokimeki.bookmark.getBookmarks',
        {query: {owner: owner!}},
      )
    },
  })
}

type FeedPage = {
  posts: app.bsky.feed.defs.PostView[]
  /** Offset of the next page, as the service returns it. */
  cursor?: string | number | null
}

export function useTokimekiBookmarkFeedQuery({
  listId,
  paginated = false,
}: {
  listId: string | undefined
  paginated?: boolean
}) {
  const appviewClient = useAppviewClient()
  const client = usePdsClient()
  const {hasSession} = useSession()
  const service = useTokimekiProxyService()
  const owner = client.did
  const pagination = useCursorPagination<FeedPage, number | undefined>(
    feedQueryKey(owner, listId ?? '', service),
    paginated,
    page =>
      page.cursor === undefined || page.cursor === null || page.cursor === ''
        ? undefined
        : Number(page.cursor),
    0,
  )
  const result = useInfiniteQuery({
    ...pagination,
    enabled: hasSession && Boolean(owner) && Boolean(listId),
    async queryFn({pageParam}): Promise<FeedPage> {
      const page = await tokimekiXrpc<{
        posts: string[]
        cursor?: string | number | null
      }>(client, 'tech.tokimeki.bookmark.getFeed', {
        query: {
          owner: owner!,
          id: listId!,
          cursor: unwrapCursor(pageParam),
          limit: 20,
        },
      })
      /*
       * `getFeed` returns URIs only. Posts are hydrated in this same request so
       * a page is always renderable; anything the AppView cannot resolve is
       * dropped, matching TOKIMEKI's own client.
       */
      const uris = page.posts ?? []
      if (uris.length === 0) return {posts: [], cursor: page.cursor}
      const hydrated = await appviewClient.call(app.bsky.feed.getPosts, {
        uris: uris.slice(0, 25) as app.bsky.feed.getPosts.$Params['uris'],
      })
      const byUri = new Map<string, app.bsky.feed.defs.PostView>(
        hydrated.posts.map(post => [post.uri, post]),
      )
      return {
        posts: uris.flatMap(uri => {
          const post = byUri.get(uri)
          return post ? [post] : []
        }),
        cursor: page.cursor,
      }
    },
  })
  return {...result, paginationQueryKey: pagination.queryKey}
}

/**
 * The ids of the viewer's private lists that contain this post. TOKIMEKI keys
 * membership by cid rather than post uri.
 */
export function useTokimekiRelatedBookmarksQuery(cid: string | undefined) {
  const client = usePdsClient()
  const {hasSession} = useSession()
  const service = useTokimekiProxyService()
  const owner = client.did
  return useQuery({
    queryKey: relatedQueryKey(owner, cid ?? '', service),
    enabled: hasSession && Boolean(owner) && Boolean(cid),
    staleTime: STALE.SECONDS.THIRTY,
    async queryFn() {
      /*
       * TOKIMEKI's own client types this as `{id, name}[]` but one call site
       * treats it as a plain id array, so accept either shape and either id
       * type. Callers compare against String(list.id).
       */
      const res = await tokimekiXrpc<{
        bookmarks?: (number | string | {id: number | string})[]
      }>(client, 'tech.tokimeki.bookmark.getRelatedBookmark', {
        query: {owner: owner!, cid: cid!},
      })
      return (res.bookmarks ?? []).map(item =>
        String(typeof item === 'object' ? item.id : item),
      )
    },
  })
}

function* postsInPages(
  queryClient: QueryClient,
  uri: string,
): Generator<app.bsky.feed.defs.PostView, void> {
  const datas = queryClient.getQueriesData<InfiniteData<FeedPage>>({
    queryKey: [FEED_KEY_ROOT],
  })
  for (const [, data] of datas) {
    for (const page of data?.pages ?? []) {
      for (const post of page.posts) {
        if (post.uri === uri) yield post
      }
    }
  }
}

export function findAllPostsInQueryData(
  queryClient: QueryClient,
  uri: string,
): Generator<app.bsky.feed.defs.PostView, void> {
  return postsInPages(queryClient, uri)
}
