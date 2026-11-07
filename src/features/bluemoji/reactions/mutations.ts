import {AtUri} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {type ViewerReaction} from '#/features/bluemoji/reactions/queries'
import {
  REACTION_COLLECTION,
  type ReactionEmoji,
  toReactionEmoji,
} from '#/features/bluemoji/reactions/util'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {com} from '#/lexicons'

type ReactionTarget = {uri: string; cid?: string}

/**
 * Stands in for the record URI until the PDS assigns one. Removals match on
 * emoji rather than this, so the placeholder never needs to round-trip.
 */
export const OPTIMISTIC_URI = 'optimistic'

/**
 * Add or remove the viewer's own reaction in the local list.
 *
 * This is the whole optimistic layer. Counts are never edited in place: they
 * are derived by merging this list into the AppView result (see
 * `mergeViewerReactions`), so a fake count cannot leak onto other posts and
 * cannot be erased by a refetch that has not caught up yet.
 *
 * Only our own record is touched, and every reader matches on `subject`, so
 * the viewer's other reactions on the same post survive.
 */
function setViewerReaction(
  queryClient: QueryClient,
  target: ReactionTarget,
  emoji: ReactionEmoji,
  action: 'add' | 'remove',
) {
  queryClient.setQueriesData<ViewerReaction[]>(
    {queryKey: ['bluemoji-viewer-reactions']},
    previous => {
      if (!previous) return previous
      const rest = previous.filter(
        reaction =>
          !(
            reaction.subject === target.uri && reaction.emoji.uri === emoji.uri
          ),
      )
      return action === 'remove'
        ? rest
        : [...rest, {uri: OPTIMISTIC_URI, subject: target.uri, emoji}]
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
      setViewerReaction(queryClient, target, emoji, 'add')
      return {target, emoji}
    },
    onError: (error, {target}, context) => {
      if (context)
        setViewerReaction(queryClient, target, context.emoji, 'remove')
      logger.error('Failed to record custom emoji reaction', {
        safeMessage: error,
      })
      Toast.show(l`Could not add your reaction`, {type: 'error'})
    },
    onSuccess: () => haptics.confirm(),
    onSettled: () => {
      // Only the viewer list is authoritative locally; counts and the per-post
      // list come from the AppView and simply catch up on the next read.
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-viewer-reactions'],
      })
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
      /*
       * An optimistic placeholder has no rkey yet. The create's onSettled
       * refetch replaces it with the real record.
       */
      if (reactionUri !== OPTIMISTIC_URI) {
        const uri = new AtUri(reactionUri)
        await pds.call(com.atproto.repo.deleteRecord, {
          repo: pds.assertDid,
          collection: REACTION_COLLECTION,
          rkey: uri.rkey,
        })
      }
      return reactionUri
    },
    onMutate: ({target, emoji}) => {
      setViewerReaction(queryClient, target, emoji, 'remove')
    },
    onError: (error, {target, emoji}) => {
      setViewerReaction(queryClient, target, emoji, 'add')
      logger.error('Failed to remove custom emoji reaction', {
        safeMessage: error,
      })
      Toast.show(l`Could not remove your reaction`, {type: 'error'})
    },
    onSuccess: () => {
      haptics.tap()
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-viewer-reactions'],
      })
    },
  })
}
