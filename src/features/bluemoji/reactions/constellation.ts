import {useQuery} from '@tanstack/react-query'

import {useConstellationInstance} from '#/state/preferences/constellation-instance'
import {STALE} from '#/state/queries'
import {
  type ConstellationLink,
  constellationLinks,
} from '#/state/queries/constellation'
import {LRU} from '#/state/queries/direct-fetch-record'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {createQueryKey} from '#/state/queries/util'
import {fetchBluemojiItem} from '#/features/bluemoji/queries'
import {
  REACTION_COLLECTION,
  type ReactionEmoji,
  type ReactionGroup,
} from '#/features/bluemoji/reactions/util'
import {blue} from '#/lexicons'

const recordCache = new LRU<string, unknown>()

type ConstellationReaction = {
  did: string
  emoji: ReactionEmoji
  createdAt: string
}

async function readReaction(link: ConstellationLink) {
  const atUri = `at://${link.did}/${REACTION_COLLECTION}/${link.rkey}`
  const value = await recordCache.getOrTryInsertWith(atUri, async () => {
    const service = await resolvePdsServiceUrl(link.did)
    if (!service) return undefined
    const res = await fetch(
      `${service}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(link.did)}&collection=${REACTION_COLLECTION}&rkey=${encodeURIComponent(link.rkey)}`,
    )
    if (!res.ok) return undefined
    return ((await res.json()) as {value?: unknown}).value
  })
  const record = blue.moji.feed.reaction.main.$ifMatches(value)
  return record ? {did: link.did, emoji: record.emoji, createdAt: record.createdAt} : null
}

/**
 * Rebuild a group from reaction records that never passed an AppView. Every
 * `emojiRef` here is self-attested by the reactor, so an item that cannot be
 * verified against its owner's PDS is dropped rather than rendered.
 */
async function verifyReactions(reactions: ConstellationReaction[]) {
  const items = new Map<string, Promise<ReactionEmoji | null>>()
  const groupMap = new Map<string, ReactionGroup>()

  for (const reaction of reactions) {
    const uri = reaction.emoji.uri
    if (!items.has(uri)) {
      items.set(
        uri,
        fetchBluemojiItem(uri).then(item =>
          item ? reaction.emoji : null,
        ).catch(() => null),
      )
    }
  }

  await Promise.all(
    [...items].map(async ([uri, promise]) => {
      if (!(await promise)) return
      // Count distinct reactors, matching the AppView's aggregation.
      const reactors = new Set(
        reactions.filter(r => r.emoji.uri === uri).map(r => r.did),
      )
      groupMap.set(uri, {
        emoji: reactions.find(r => r.emoji.uri === uri)!.emoji,
        count: reactors.size,
      })
    }),
  )

  return [...groupMap.values()].sort((a, b) => b.count - a.count)
}

/**
 * Backstop for posts the AppView has no reactions for - other AppViews, or an
 * instance that has not indexed the reaction collection yet. Expensive (one
 * getRecord per reactor), so it is only called when the AppView came back
 * empty for a post that is actually on screen.
 */
export async function fetchConstellationReactions(
  instance: string,
  postUri: string,
): Promise<ReactionGroup[]> {
  const reactions: ConstellationReaction[] = []
  for await (const link of constellationLinks(instance, {
    target: postUri,
    collection: REACTION_COLLECTION,
    path: '.subject',
  })) {
    const reaction = await readReaction(link).catch(() => null)
    if (reaction) reactions.push(reaction)
  }
  return verifyReactions(reactions)
}

export function useConstellationReactionsQuery(
  postUri: string | undefined,
  enabled: boolean,
) {
  const instance = useConstellationInstance()
  return useQuery({
    queryKey: createQueryKey('bluemoji-constellation-reactions', {
      instance,
      uri: postUri,
    }),
    staleTime: STALE.MINUTES.FIVE,
    enabled: Boolean(postUri && enabled && instance),
    retry: false,
    queryFn: () => fetchConstellationReactions(instance, postUri!),
  })
}
