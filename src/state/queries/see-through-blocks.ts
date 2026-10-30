import {type Did} from '@atproto/api'
import {type Client} from '@atproto/lex'
import {AtUri, type AtUriString} from '@atproto/syntax'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {useQuery} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {useSlingshotInstance} from '#/state/preferences/slingshot-instance'
import {STALE} from '#/state/queries'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {createQueryKey} from '#/state/queries/util'
import {getPublicAppviewClient} from '#/state/session/clients'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

export {useSeeThroughBlocks} from '#/state/preferences/see-through-blocks'

/**
 * Anonymous record reads.
 *
 * Every block cause in `@bsky/sdk/moderation` is derived from an item's
 * `viewer` fields, so an unauthenticated read of the same content produces no
 * block at all. That is the whole mechanism behind seeing through a block: ask
 * the same question without credentials.
 *
 * The AppView answers nearly every post anonymously, so that is the first and
 * usually only path. Slingshot and the author's PDS are fallbacks for accounts
 * whose AppView reads are refused; those return a bare record, so the view is
 * synthesized the same way `directFetchRecordAndProfile` does it.
 */

const RQKEY_ROOT = 'see-through-blocks'
export const RQKEY = (uri: string) => createQueryKey(RQKEY_ROOT, {uri})

/**
 * Whether the decision is about a block, as opposed to a mute, a label, or
 * hidden-post preference. Only blocks are see-through; everything else keeps
 * its normal behaviour.
 */
export function isBlocked(decision: ModerationDecision | undefined) {
  return Boolean(decision?.blockCause)
}

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

/** Per-request timeout for the fallback reads. */
const FETCH_TIMEOUT = 8000

/**
 * Hermes does not reliably provide `AbortSignal.timeout`, so time out with a
 * controller the same way `pds-detection.ts` does.
 */
async function fetchJson(url: URL, timeout: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      headers: {accept: 'application/json'},
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`getRecord failed: ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Slingshot's `com.atproto.repo.getRecord`. Takes repo/collection/rkey rather
 * than an at-uri, and is unauthenticated.
 */
async function fetchRecordViaSlingshot(
  slingshot: string,
  uri: string,
): Promise<unknown> {
  const urip = new AtUri(uri)
  const url = new URL('/xrpc/com.atproto.repo.getRecord', slingshot)
  url.searchParams.set('repo', urip.host)
  url.searchParams.set('collection', urip.collection)
  url.searchParams.set('rkey', urip.rkey)
  return ((await fetchJson(url, FETCH_TIMEOUT)) as {value: unknown}).value
}

/**
 * The author PDS directly. Last resort: needs a DID, and only works for
 * accounts that still expose public repo reads.
 */
async function fetchRecordViaPds(uri: string): Promise<unknown> {
  const urip = new AtUri(uri)
  if (!urip.host.startsWith('did:')) return
  const pds = await resolvePdsServiceUrl(urip.host as Did)
  if (!pds) return
  const url = new URL('/xrpc/com.atproto.repo.getRecord', pds)
  if (url.protocol !== 'https:') return
  url.searchParams.set('repo', urip.host)
  url.searchParams.set('collection', urip.collection)
  url.searchParams.set('rkey', urip.rkey)
  return ((await fetchJson(url, FETCH_TIMEOUT)) as {value: unknown}).value
}

/** Author stub for a synthesized view; viewer-less by construction. */
function authorFromUri(uri: string): app.bsky.actor.defs.ProfileViewBasic {
  return {
    $type: 'app.bsky.actor.defs#profileViewBasic',
    did: new AtUri(uri).host as Did,
    handle: 'handle.invalid',
  }
}

/**
 * Build a PostView out of a bare record. Counts and embeds-as-views are not
 * available from a repo read, so this is the "minimal view" case: text, tags,
 * and any embed record the post itself carries as a raw value.
 */
function viewFromRecord(
  uri: string,
  record: unknown,
): app.bsky.feed.defs.PostView | undefined {
  if (!bsky.isType(app.bsky.feed.post.main, record)) return
  return {
    $type: 'app.bsky.feed.defs#postView',
    uri: uri as AtUriString,
    cid: 'see-through',
    author: authorFromUri(uri),
    record,
    indexedAt: record.createdAt,
  } satisfies app.bsky.feed.defs.PostView
}

/**
 * Swap in the real author profile for a synthesized view.
 *
 * The anonymous AppView will happily describe the author even when it refuses
 * the post, so this is usually one cheap read; on failure the `handle.invalid`
 * stub is kept rather than dropping the post.
 */
async function withRealAuthor(
  view: app.bsky.feed.defs.PostView,
): Promise<app.bsky.feed.defs.PostView> {
  if (view.author.handle !== 'handle.invalid') return view
  try {
    const profile = await getPublicAppviewClient().call(
      app.bsky.actor.getProfile,
      {actor: view.author.did},
    )
    return {
      ...view,
      author: {
        $type: 'app.bsky.actor.defs#profileViewBasic',
        did: profile.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar,
        associated: profile.associated,
        labels: profile.labels,
        createdAt: profile.createdAt,
      },
    }
  } catch {
    return view
  }
}

/**
 * A single post, read without credentials. AppView, then Slingshot, then the
 * author's PDS. Returns `undefined` when all three come up empty so callers can
 * fall back to the existing blocked placeholder.
 */
export async function fetchPostAnon(
  client: Client,
  slingshot: string,
  uri: string,
): Promise<app.bsky.feed.defs.PostView | undefined> {
  try {
    const {posts} = await client.call(app.bsky.feed.getPosts, {
      uris: [uri as AtUriString],
    })
    if (posts[0]) return await withRealAuthor(posts[0])
  } catch (e) {
    console.debug('see-through-blocks: appview getPosts failed', getErrorMessage(e))
  }

  for (const getRecord of [
    () => fetchRecordViaSlingshot(slingshot, uri),
    () => fetchRecordViaPds(uri),
  ]) {
    try {
      const record = await getRecord()
      const view = viewFromRecord(uri, record)
      if (view) return await withRealAuthor(view)
    } catch (e) {
      console.debug(
        'see-through-blocks: record fallback failed',
        getErrorMessage(e),
      )
    }
  }
}

/**
 * Query options for a single anonymous post read. Exposed so a caller fetching
 * many posts at once shares this cache and fallback chain.
 */
export function unblockedPostQueryOptions(uri: string, slingshot: string) {
  return {
    queryKey: RQKEY(uri),
    staleTime: STALE.HOURS.ONE,
    queryFn: () => fetchPostAnon(getPublicAppviewClient(), slingshot, uri),
  }
}

export function useUnblockedPostQuery({
  uri,
  enabled,
}: {
  uri: string | undefined
  enabled?: boolean
}) {
  const slingshot = useSlingshotInstance()
  const deferredEnabled = useDeferredEnable(Boolean(enabled) && !!uri)
  return useQuery({
    ...unblockedPostQueryOptions(uri ?? '', slingshot),
    enabled: deferredEnabled,
  })
}

/**
 * The whole thread, read without credentials. Threads are self-contained, so a
 * blocked reply or parent resolves from this one call.
 */
export async function fetchThreadAnon(
  client: Client,
  anchor: string,
  params: UnblockedThreadParams,
) {
  return await client.call(app.bsky.unspecced.getPostThreadV2, {
    ...params,
    anchor: anchor as AtUriString,
  })
}

export type UnblockedThreadParams = {
  branchingFactor?: number
  below?: number
  sort?: app.bsky.unspecced.getPostThreadV2.$Params['sort']
}

export function useUnblockedThreadQuery({
  anchor,
  params,
  enabled,
}: {
  anchor: string | undefined
  params: UnblockedThreadParams
  enabled?: boolean
}) {
  const deferredEnabled = useDeferredEnable(Boolean(enabled) && !!anchor)
  return useQuery({
    queryKey: createQueryKey('see-through-blocks-thread', {anchor, params}),
    staleTime: STALE.MINUTES.FIVE,
    queryFn: () =>
      fetchThreadAnon(getPublicAppviewClient(), anchor!, params),
    enabled: deferredEnabled,
  })
}

/**
 * A profile, read without credentials. The returned view has no `viewer`, so
 * `moderateProfile` finds nothing to hide.
 */
export function useUnblockedProfileQuery({
  did,
  enabled,
}: {
  did: string | undefined
  enabled?: boolean
}) {
  const deferredEnabled = useDeferredEnable(Boolean(enabled) && !!did)
  return useQuery({
    queryKey: createQueryKey('see-through-blocks-profile', {did}),
    staleTime: STALE.MINUTES.FIVE,
    queryFn: () =>
      getPublicAppviewClient().call(app.bsky.actor.getProfile, {
        actor: did as Did,
      }),
    enabled: deferredEnabled,
  })
}
