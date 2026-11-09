import {type DidString} from '@atproto/syntax'
import {useQuery} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {useConstellationInstance} from '#/state/preferences/constellation-instance'
import {STALE} from '#/state/queries'
import {
  asyncGenCollect,
  constellationLinks,
} from '#/state/queries/constellation'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {createQueryKey} from '#/state/queries/util'
import {useSession} from '#/state/session'
import {
  TOKIMEKI_POLL_COLLECTION,
  TOKIMEKI_VOTE_COLLECTION,
  type TokimekiPoll,
  type TokimekiPollRef,
} from './types'

export const RQKEY_POLL = (uri: string, viewer: string, instance: string) =>
  createQueryKey('tokimekiPoll', {uri, viewer, instance})

async function readRecord(did: string, collection: string, rkey: string) {
  const pds = await resolvePdsServiceUrl(did as DidString)
  if (!pds) return null
  const url = new URL('/xrpc/com.atproto.repo.getRecord', pds)
  url.searchParams.set('repo', did)
  url.searchParams.set('collection', collection)
  url.searchParams.set('rkey', rkey)
  const response = await fetch(url)
  if (response.status === 404) return null
  if (!response.ok)
    throw new Error(`Could not read poll record: ${response.status}`)
  const data = (await response.json()) as {
    uri?: string
    cid?: string
    value?: Record<string, unknown>
  }
  if (
    data.uri !== `at://${did}/${collection}/${rkey}` ||
    typeof data.cid !== 'string' ||
    !data.value ||
    data.value.$type !== collection
  ) {
    return null
  }
  return {uri: data.uri, cid: data.cid, value: data.value}
}

/** Read the poll from its PDS and verify Constellation's vote backlinks there. */
export async function fetchTokimekiPoll(
  ref: TokimekiPollRef,
  viewerDid: string,
  instance: string,
): Promise<TokimekiPoll | null> {
  const record = await readRecord(ref.did, TOKIMEKI_POLL_COLLECTION, ref.rkey)
  if (!record) return null
  const {options, endsAt, createdAt} = record.value
  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 4 ||
    !options.every(
      o => typeof o === 'string' && o.length > 0 && o.length <= 100,
    ) ||
    typeof endsAt !== 'string' ||
    !Number.isFinite(Date.parse(endsAt)) ||
    typeof createdAt !== 'string' ||
    !Number.isFinite(Date.parse(createdAt))
  ) {
    return null
  }

  const links = await asyncGenCollect(
    constellationLinks(instance, {
      target: record.uri,
      collection: TOKIMEKI_VOTE_COLLECTION,
      path: '.poll.uri',
    }),
  )
  const votes = await Promise.all(
    links.map(async link => ({
      did: link.did,
      record: await readRecord(link.did, TOKIMEKI_VOTE_COLLECTION, link.rkey),
    })),
  )
  const byVoter = new Map<string, {index: number; time: number}>()
  for (const vote of votes) {
    const value = vote.record?.value
    if (!value) continue
    const poll = value.poll as {uri?: unknown; cid?: unknown} | undefined
    const index = value.optionIndex
    const time =
      typeof value.createdAt === 'string' ? Date.parse(value.createdAt) : NaN
    if (
      poll?.uri !== record.uri ||
      poll.cid !== record.cid ||
      typeof index !== 'number' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= options.length ||
      !Number.isFinite(time) ||
      time < Date.parse(createdAt) ||
      time > Date.parse(endsAt)
    ) {
      continue
    }
    const previous = byVoter.get(vote.did)
    if (!previous || previous.time < time) byVoter.set(vote.did, {index, time})
  }
  const counts = options.map(() => 0)
  for (const vote of byVoter.values()) counts[vote.index]++
  return {
    uri: record.uri,
    cid: record.cid,
    options,
    endsAt,
    counts,
    totalVotes: byVoter.size,
    myVote: byVoter.get(viewerDid)?.index,
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
  const instance = useConstellationInstance()
  const viewerDid = currentAccount?.did ?? ''
  const deferred = useDeferredEnable(enabled && Boolean(ref))

  return useQuery({
    queryKey: RQKEY_POLL(
      ref ? `at://${ref.did}/${TOKIMEKI_POLL_COLLECTION}/${ref.rkey}` : '',
      viewerDid,
      instance,
    ),
    enabled: deferred,
    staleTime: STALE.SECONDS.THIRTY,
    async queryFn() {
      if (!ref) return null
      return await fetchTokimekiPoll(ref, viewerDid, instance)
    },
  })
}
