import {moderatePost} from '@bsky/sdk/moderation'
import {
  type InfiniteData,
  type QueryKey,
  useInfiniteQuery,
} from '@tanstack/react-query'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useTagSearchInstance} from '#/state/preferences/tag-search-instance'
import {
  type CursorPageParam,
  unwrapCursor,
  useCursorPagination,
} from '#/state/queries/cursor-pagination'
import {useAppviewClient, useSession} from '#/state/session'
import {app, type com} from '#/lexicons'

type TagSearchPage = {
  posts: app.bsky.feed.defs.PostView[]
  nextOffset?: number
}

/**
 * Searches posts by label via an iqdb-labeler `/search` endpoint, which
 * returns at-uris that must be hydrated by the AppView.
 */
export function useTagSearchQuery({
  query,
  enabled,
  paginated = false,
}: {
  query: string
  enabled?: boolean
  paginated?: boolean
}) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const instance = useTagSearchInstance()
  const moderationOpts = useModerationOpts()

  /*
   * Rooted at 'search-posts' so findAllPostsInQueryData in search-posts-v2
   * also finds these pages for post shadow updates.
   */
  const pagination = useCursorPagination<TagSearchPage, number>(
    ['search-posts', 'tags', query, instance, currentAccount?.did],
    paginated,
    page => page.nextOffset,
    0,
  )
  const result = useInfiniteQuery<
    TagSearchPage,
    Error,
    InfiniteData<TagSearchPage>,
    QueryKey,
    CursorPageParam<number>
  >({
    ...pagination,
    queryFn: async ({pageParam, signal}) => {
      const url = new URL('/search', instance)
      url.searchParams.set('tags', query)
      url.searchParams.set('offset', String(unwrapCursor(pageParam)))
      // getPosts hydrates at most 25 uris per call
      url.searchParams.set('limit', '25')
      const response = await fetch(url, {signal})
      const data = (await response.json().catch(() => ({}))) as {
        posts?: string[]
        nextOffset?: number
        message?: string
      }
      if (!response.ok || !data.posts) {
        throw new Error(data.message ?? `Tag search failed: ${response.status}`)
      }
      const [hydrated, labelsByUri] = await Promise.all([
        data.posts.length
          ? client.call(app.bsky.feed.getPosts, {
              uris: data.posts as app.bsky.feed.getPosts.$Params['uris'],
            })
          : {posts: []},
        queryFullLabels(instance, data.posts, signal),
      ])
      const byUri = new Map(hydrated.posts.map(post => [post.uri, post]))
      return {
        nextOffset: data.nextOffset,
        posts: data.posts.flatMap(uri => {
          let post = byUri.get(uri as app.bsky.feed.defs.PostView['uri'])
          if (!post) return []
          const fullLabels = labelsByUri.get(uri)
          if (fullLabels) {
            post = {...post, labels: mergeLabels(post.labels, fullLabels)}
          }
          return moderatePost(post, moderationOpts!).ui('contentList').filter
            ? []
            : [post]
        }),
      }
    },
    enabled: !!moderationOpts && (enabled ?? true),
  })
  return {...result, paginationQueryKey: pagination.queryKey}
}

/**
 * The labeler only emits a few labels per post to the AppView (its label
 * ingester is rate limited), but queryLabels on the labeler returns them all.
 * Failures resolve to no entry so the AppView's labels are kept.
 */
async function queryFullLabels(
  instance: string,
  uris: string[],
  signal: AbortSignal,
) {
  /*
   * shortcut: one request per uri, since the labeler's queryLabels never
   * returns a cursor and caps at 250 labels per call; batch uriPatterns once
   * it paginates.
   */
  const entries = await Promise.all(
    uris.map(async uri => {
      try {
        const url = new URL('/xrpc/com.atproto.label.queryLabels', instance)
        url.searchParams.set('uriPatterns', uri)
        url.searchParams.set('limit', '250')
        const response = await fetch(url, {signal})
        if (!response.ok) return []
        const {labels} =
          (await response.json()) as com.atproto.label.queryLabels.$OutputBody
        return [[uri, labels] as const]
      } catch {
        return []
      }
    }),
  )
  return new Map(entries.flat())
}

/**
 * Replaces the AppView's labels from each source in `full` with that source's
 * full label set, applying negations and expiry. `full` must be in emit order.
 */
export function mergeLabels(
  existing: com.atproto.label.defs.Label[] = [],
  full: com.atproto.label.defs.Label[],
  now = Date.now(),
) {
  const active = new Map<string, com.atproto.label.defs.Label>()
  for (const label of full) {
    const key = `${label.src} ${label.val}`
    if (label.neg || (label.exp && Date.parse(label.exp) <= now)) {
      active.delete(key)
    } else {
      active.set(key, label)
    }
  }
  const sources = new Set(full.map(label => label.src))
  return [
    ...existing.filter(label => !sources.has(label.src)),
    ...active.values(),
  ]
}
