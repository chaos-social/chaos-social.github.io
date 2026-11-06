import {useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {com} from '#/lexicons'
import {RQKEY_VOTES} from './api'
import {voteRkey} from './parse'
import {
  POLLBLUE_SPEC,
  type PollRecord,
  type PollVotes,
  VOTE_RECORD_COLLECTION,
} from './types'

/**
 * Casts a vote on a public poll the way poll.blue does: a signed
 * `blue.poll.poll.vote` record in the voter's own repo, keyed by the poll so a
 * revote overwrites the previous one. Only public polls carry option URIs.
 */
export function usePollBlueVoteMutation(poll: PollRecord | null | undefined) {
  const pdsClient = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (index: number) => {
      if (!poll) throw new Error('This poll is not loaded yet')
      const option = poll.options[index - 1]?.uri
      if (!option) throw new Error('This poll does not accept in-app votes')
      return await pdsClient.call(com.atproto.repo.putRecord, {
        repo: pdsClient.assertDid,
        collection: VOTE_RECORD_COLLECTION,
        rkey: voteRkey(poll.uri),
        record: {
          $type: VOTE_RECORD_COLLECTION,
          spec: POLLBLUE_SPEC,
          poll: {uri: poll.uri, cid: poll.cid},
          option,
          index,
          createdAt: new Date().toISOString(),
        },
        // Our PDS does not know this lexicon.
        validate: false,
      })
    },
    onMutate: async (index: number) => {
      const key = RQKEY_VOTES(poll?.uri ?? '')
      await queryClient.cancelQueries({queryKey: key})
      const prev = queryClient.getQueryData<PollVotes | null>(key)
      if (prev) {
        const counts = [...prev.counts]
        const next = {counts, total: prev.total, viewerIndex: index}
        if (prev.viewerIndex) {
          counts[prev.viewerIndex - 1] = Math.max(
            0,
            counts[prev.viewerIndex - 1] - 1,
          )
          next.total = Math.max(0, prev.total - 1)
        }
        counts[index - 1] += 1
        next.total += 1
        queryClient.setQueryData(key, next)
      }
      return {prev}
    },
    onError: (_e, _index, ctx) => {
      queryClient.setQueryData(RQKEY_VOTES(poll?.uri ?? ''), ctx?.prev ?? null)
      logger.error('Failed to record poll.blue vote', {safeMessage: _e})
      Toast.show(l`Could not record your vote`, {type: 'error'})
    },
    onSuccess: () => {
      haptics.confirm()
    },
    onSettled: () => {
      // Constellation lags the write, so let the cache settle on a refetch.
      void queryClient.invalidateQueries({
        queryKey: RQKEY_VOTES(poll?.uri ?? ''),
      })
    },
  })
}
