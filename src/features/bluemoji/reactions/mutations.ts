import {AtUri} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {type QueryClient, useMutation, useQueryClient} from '@tanstack/react-query'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {
  REACTION_COLLECTION,
  type ReactionEmoji,
  type ReactionGroup,
} from '#/features/bluemoji/reactions/util'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {com} from '#/lexicons'

type ReactionTarget = {uri: string; cid?: string}

/** Only the CID-bearing v1 slots travel in the record; v0 bytes cannot. */
function toReactionEmoji(item: BluemojiItem): ReactionEmoji {
  const formats: Record<string, string> = {
    $type: 'blue.moji.richtext.facet#formats_v1',
  }
  const source = item.record.formats as Record<string, unknown>
  for (const slot of ['png_128', 'webp_128', 'gif_128', 'apng_128']) {
    const blob = source?.[slot]
    const cid =
      blob && typeof blob === 'object' && 'ref' in blob
        ? (blob.ref as {$link?: string}).$link
        : undefined
    if (cid) formats[slot] = cid
  }
  return {
    $type: 'blue.moji.feed.reaction#emojiRef',
    uri: item.uri as ReactionEmoji['uri'],
    name: item.record.name,
    alt: item.record.alt,
    adultOnly: item.record.adultOnly,
    formats: formats as unknown as ReactionEmoji['formats'],
  }
}

function bumpCounts(
  queryClient: QueryClient,
  target: ReactionTarget,
  emoji: ReactionEmoji,
  delta: 1 | -1,
) {
  queryClient.setQueriesData<ReactionGroup[]>(
    {queryKey: ['bluemoji-reaction-counts']},
    previous => {
      if (!previous) return previous
      const next = previous.map(group =>
        group.emoji.uri === emoji.uri
          ? {...group, count: group.count + delta}
          : group,
      )
      const existing = next.find(group => group.emoji.uri === emoji.uri)
      if (!existing && delta > 0) next.push({emoji, count: 1})
      return next
        .filter(group => group.count > 0)
        .sort((a, b) => b.count - a.count)
    },
  )
  queryClient.setQueriesData<{subject: string}[]>(
    {queryKey: ['bluemoji-viewer-reactions']},
    previous => {
      if (!previous) return previous
      if (delta > 0) return [...previous, {subject: target.uri}]
      return previous.filter(reaction => reaction.subject !== target.uri)
    },
  )
}

export function useCreateReactionMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      target,
      item,
    }: {
      target: ReactionTarget
      item: BluemojiItem
    }) => {
      if (!pds.did) throw new Error('You need to sign in to react')
      const emoji = toReactionEmoji(item)
      const result = await pds.call(com.atproto.repo.createRecord, {
        repo: pds.assertDid,
        collection: REACTION_COLLECTION,
        record: {
          $type: REACTION_COLLECTION,
          subject: target.uri,
          subjectCid: target.cid,
          emoji: {
            uri: emoji.uri,
            name: emoji.name,
            alt: emoji.alt,
            adultOnly: emoji.adultOnly,
            formats: emoji.formats,
          },
          createdAt: new Date().toISOString(),
        },
        // Our PDS does not know this lexicon.
        validate: false,
      })
      return {uri: result.uri, emoji}
    },
    onMutate: ({target, item}) => {
      const emoji = toReactionEmoji(item)
      bumpCounts(queryClient, target, emoji, 1)
      return {target, emoji}
    },
    onError: (error, {target}, context) => {
      if (context) bumpCounts(queryClient, target, context.emoji, -1)
      logger.error('Failed to record custom emoji reaction', {
        safeMessage: error,
      })
      Toast.show(l`Could not add your reaction`, {type: 'error'})
    },
    onSuccess: () => haptics.confirm(),
    onSettled: (_data, _error, {target}) => {
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-reaction-counts'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-reactions', {uri: target.uri}],
      })
      void queryClient.invalidateQueries({queryKey: ['bluemoji-viewer-reactions']})
    },
  })
}

export function useDeleteReactionMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      reactionUri,
    }: {
      reactionUri: string
      target: ReactionTarget
      emoji: ReactionEmoji
    }) => {
      const uri = new AtUri(reactionUri)
      await pds.call(com.atproto.repo.deleteRecord, {
        repo: pds.assertDid,
        collection: REACTION_COLLECTION,
        rkey: uri.rkey,
      })
      return reactionUri
    },
    onMutate: ({target, emoji}) => {
      bumpCounts(queryClient, target, emoji, -1)
    },
    onError: (error, {target, emoji}) => {
      bumpCounts(queryClient, target, emoji, 1)
      logger.error('Failed to remove custom emoji reaction', {
        safeMessage: error,
      })
      Toast.show(l`Could not remove your reaction`, {type: 'error'})
    },
    onSuccess: () => haptics.tap(),
    onSettled: (_data, _error, {target}) => {
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-reaction-counts'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-reactions', {uri: target.uri}],
      })
      void queryClient.invalidateQueries({queryKey: ['bluemoji-viewer-reactions']})
    },
  })
}
