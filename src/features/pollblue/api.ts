import {useQuery} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {useConstellationInstance} from '#/state/preferences/constellation-instance'
import {STALE} from '#/state/queries'
import {
  asyncGenCollect,
  asyncGenDedupe,
  constellationLinks,
} from '#/state/queries/constellation'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {useSession} from '#/state/session'
import {IS_WEB} from '#/env'
import {pollPostParts} from './parse'
import {
  isPollRecord,
  POLL_RECORD_COLLECTION,
  type PollRecord,
  type PollVotes,
  VOTE_RECORD_COLLECTION,
} from './types'

const RQKEY_ROOT = 'pollblue'
export const RQKEY_POLL = (postUri: string) => [RQKEY_ROOT, 'poll', postUri]
export const RQKEY_VOTES = (pollUri: string) => [RQKEY_ROOT, 'votes', pollUri]

type PollApiResponse = {
  question?: string
  answers?: string[]
  results?: number[]
}

const CENTRALIZED_API = 'https://poll.blue/api/poll'

/**
 * poll.blue sends no CORS headers, so the web build goes through our own
 * `/poll/<id>` Pages Function while native reaches poll.blue directly.
 */
function centralizedPollUrl(id: string) {
  return IS_WEB ? `/poll/${encodeURIComponent(id)}` : `${CENTRALIZED_API}/${id}`
}

async function fetchCentralized(visibleId: string): Promise<PollRecord | null> {
  let res: Response
  try {
    res = await fetch(centralizedPollUrl(visibleId))
  } catch {
    return null
  }
  if (!res.ok) return null
  const data = (await res.json()) as PollApiResponse
  if (!data?.question || !Array.isArray(data.answers)) return null
  return {
    uri: '',
    cid: '',
    question: data.question,
    options: data.answers.map(text => ({text})),
    mode: 'centralized',
    visibleId,
    results: Array.isArray(data.results) ? data.results : undefined,
  }
}

async function readPollFromPds(
  did: string,
  rkey: string,
): Promise<PollRecord | null> {
  const pds = await resolvePdsServiceUrl(did as `did:${string}:${string}`)
  if (!pds) return null
  try {
    const res = await fetch(
      `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
        did,
      )}&collection=${POLL_RECORD_COLLECTION}&rkey=${encodeURIComponent(rkey)}`,
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      uri: string
      cid: string
      value: unknown
    }
    const record = {...(json.value as object), uri: json.uri, cid: json.cid}
    return isPollRecord(record) ? record : null
  } catch {
    return null
  }
}

/**
 * Finds a poll record from its post. Constellation indexes the record's
 * `post.uri` backlink for both modes, which is the only reliable route since
 * the post itself carries no embed.
 */
export async function getPollRecord(
  instance: string,
  postUri: string,
  ids: string[],
): Promise<PollRecord | null> {
  try {
    const links = await asyncGenCollect(
      asyncGenDedupe(
        constellationLinks(instance, {
          target: postUri,
          collection: POLL_RECORD_COLLECTION,
          path: '.post.uri',
        }),
        link => link.did,
      ),
    )
    for (const link of links) {
      const poll = await readPollFromPds(link.did, link.rkey)
      if (poll) return poll
    }
  } catch {
    // A Constellation outage should not hide the id-based fallback below.
  }

  // Constellation can lag a brand-new poll. Fall back to the id in the post
  // text: `did~rkey` is a public record we can read from the PDS directly;
  // a visible id is a centralized poll counted on poll.blue.
  for (const id of ids) {
    if (id.includes('~')) {
      const [did, rkey] = id.split('~')
      const poll = await readPollFromPds(did, rkey)
      if (poll) return poll
    } else {
      const poll = await fetchCentralized(id)
      if (poll) return poll
    }
  }

  return null
}

export function usePollBluePoll(post: {
  uri: string
  record: {text?: string; facets?: unknown}
}) {
  const instance = useConstellationInstance()
  const parts = pollPostParts(post.record)
  const enabled = useDeferredEnable(Boolean(parts))

  return useQuery({
    queryKey: RQKEY_POLL(post.uri),
    enabled,
    staleTime: STALE.MINUTES.FIVE,
    async queryFn() {
      if (!parts) return null
      return await getPollRecord(instance, post.uri, [parts.id])
    },
  })
}

/**
 * Public polls are counted from signed vote records in voters' repos; a
 * centralized poll keeps its tally in poll.blue's database, which the card
 * reads straight from the poll record instead.
 */
export function usePollBlueVotes(poll: PollRecord | null | undefined) {
  const instance = useConstellationInstance()
  const {currentAccount} = useSession()
  const enabled = useDeferredEnable(poll?.mode === 'public')

  return useQuery({
    queryKey: RQKEY_VOTES(poll?.uri ?? ''),
    enabled,
    staleTime: STALE.SECONDS.THIRTY,
    async queryFn(): Promise<PollVotes | null> {
      if (!poll || poll.mode !== 'public') return null
      const uris = poll.options.map(o => o.uri).filter(Boolean) as string[]
      if (uris.length !== poll.options.length) {
        // Without option records there is nothing to count against.
        return {counts: poll.options.map(() => 0), total: 0}
      }

      const perOption = await Promise.all(
        uris.map(uri =>
          asyncGenCollect(
            asyncGenDedupe(
              constellationLinks(instance, {
                target: uri,
                collection: VOTE_RECORD_COLLECTION,
                path: '.option',
              }),
              link => link.did,
            ),
          ),
        ),
      )
      const viewerDid = currentAccount?.did
      const viewerIndex = viewerDid
        ? perOption.findIndex(dids => dids.some(l => l.did === viewerDid))
        : -1
      return {
        counts: perOption.map(dids => dids.length),
        viewerIndex: viewerIndex >= 0 ? viewerIndex + 1 : undefined,
        total: perOption.reduce((sum, dids) => sum + dids.length, 0),
      }
    },
  })
}
