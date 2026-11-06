import {useQuery} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {IS_WEB} from '#/env'
import {
  TOKIMEKI_POLL_COLLECTION,
  type TokimekiPoll,
  type TokimekiPollRef,
} from './types'

const UPSTREAM = 'https://poll.tokimeki.tech/xrpc/tech.tokimeki.poll.getPoll'

export const RQKEY_POLL = (uri: string, viewer: string) =>
  createQueryKey('tokimekiPoll', {uri, viewer})

type ApiResponse = {
  poll?: {
    uri?: string
    cid?: string
    options?: string[]
    endsAt?: string
  }
  options?: {index?: number; count?: number}[]
  totalVotes?: number
  myVote?: number
}

/**
 * TOKIMEKI only sends CORS headers for its own origins, so the web build asks
 * our `/tokimeki/<did>/<rkey>` Pages Function while native goes straight out.
 */
function pollApiUrl(ref: TokimekiPollRef, viewerDid: string) {
  const viewer = viewerDid ? `?viewer=${encodeURIComponent(viewerDid)}` : ''
  if (IS_WEB) {
    return `/tokimeki/${encodeURIComponent(ref.did)}/${encodeURIComponent(
      ref.rkey,
    )}${viewer}`
  }
  return `${UPSTREAM}?uri=${encodeURIComponent(tokimekiAtUri(ref))}${
    viewer ? `&viewer=${encodeURIComponent(viewerDid)}` : ''
  }`
}

function tokimekiAtUri(ref: TokimekiPollRef) {
  return `at://${ref.did}/${TOKIMEKI_POLL_COLLECTION}/${ref.rkey}`
}

export async function fetchTokimekiPoll(
  ref: TokimekiPollRef,
  viewerDid: string,
): Promise<TokimekiPoll | null> {
  let res: Response
  try {
    res = await fetch(pollApiUrl(ref, viewerDid))
  } catch {
    return null
  }
  if (!res.ok) return null

  let data: ApiResponse
  try {
    data = (await res.json()) as ApiResponse
  } catch {
    return null
  }
  const {poll} = data
  if (!poll?.uri || !poll.cid || !Array.isArray(poll.options)) return null
  if (!poll.options.every(o => typeof o === 'string')) return null

  /*
   * The service reports counts by index rather than in array order, and omits
   * zero-count options, so rebuild the array aligned with `options`.
   */
  const counts = poll.options.map(() => 0)
  for (const option of data.options ?? []) {
    const i = option.index
    if (typeof i === 'number' && i >= 0 && i < counts.length) {
      counts[i] = typeof option.count === 'number' ? option.count : 0
    }
  }

  return {
    uri: poll.uri,
    cid: poll.cid,
    options: poll.options,
    endsAt: poll.endsAt,
    counts,
    totalVotes:
      typeof data.totalVotes === 'number'
        ? data.totalVotes
        : counts.reduce((sum, n) => sum + n, 0),
    myVote: typeof data.myVote === 'number' ? data.myVote : undefined,
  }
}

export function useTokimekiPoll({
  ref,
  enabled,
}: {
  ref: TokimekiPollRef | undefined
  enabled: boolean
}) {
  const {currentAccount} = useSession()
  const viewerDid = currentAccount?.did ?? ''
  const deferred = useDeferredEnable(enabled && Boolean(ref))

  return useQuery({
    queryKey: RQKEY_POLL(ref ? tokimekiAtUri(ref) : '', viewerDid),
    enabled: deferred,
    staleTime: STALE.SECONDS.THIRTY,
    async queryFn() {
      if (!ref) return null
      return await fetchTokimekiPoll(ref, viewerDid)
    },
  })
}
