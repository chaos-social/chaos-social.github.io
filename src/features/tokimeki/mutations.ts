import {useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useConstellationInstance} from '#/state/preferences/constellation-instance'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {com} from '#/lexicons'
import {RQKEY_POLL} from './api'
import {TOKIMEKI_VOTE_COLLECTION, type TokimekiPoll} from './types'

/**
 * Casts a vote the way TOKIMEKI does: a `tech.tokimeki.poll.vote` record in the
 * voter's own repo. One vote per poll, so the card stops offering buttons once
 * `myVote` is set.
 */
export function useTokimekiVoteMutation(
  poll: TokimekiPoll | null | undefined,
  viewerDid: string,
) {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const instance = useConstellationInstance()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (index: number) => {
      if (!poll) throw new Error('This poll is not loaded yet')
      if (!pdsClient.did) throw new Error('You need to sign in to vote')
      return await pdsClient.call(com.atproto.repo.createRecord, {
        repo: pdsClient.assertDid,
        collection: TOKIMEKI_VOTE_COLLECTION,
        record: {
          $type: TOKIMEKI_VOTE_COLLECTION,
          poll: {uri: poll.uri, cid: poll.cid},
          optionIndex: index,
          createdAt: new Date().toISOString(),
        },
        // Our PDS does not know this lexicon.
        validate: false,
      })
    },
    onMutate: async (index: number) => {
      const key = RQKEY_POLL(poll?.uri ?? '', viewerDid, instance)
      await queryClient.cancelQueries({queryKey: key})
      const prev = queryClient.getQueryData<TokimekiPoll | null>(key)
      if (prev) {
        const counts = [...prev.counts]
        counts[index] = (counts[index] ?? 0) + 1
        queryClient.setQueryData<TokimekiPoll>(key, {
          ...prev,
          counts,
          totalVotes: prev.totalVotes + 1,
          myVote: index,
        })
      }
      return {prev, key}
    },
    onError: (_e, _index, ctx) => {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.prev ?? null)
      logger.error('Failed to record TOKIMEKI poll vote', {safeMessage: _e})
      Toast.show(l`Could not record your vote`, {type: 'error'})
    },
    onSuccess: () => {
      haptics.confirm()
    },
    onSettled: (_data, _error, _index, ctx) => {
      if (ctx) void queryClient.invalidateQueries({queryKey: ctx.key})
    },
  })
}
