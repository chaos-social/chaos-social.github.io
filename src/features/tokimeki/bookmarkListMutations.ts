import {useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {useHaptics} from '#/lib/haptics'
import {isNetworkError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {useTokimekiProxyService} from '#/state/preferences/tokimeki-instance'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {type app} from '#/lexicons'
import {RELATED_KEY_ROOT, tokimekiXrpc} from './bookmarkLists'

export type BookmarkListMutationArgs =
  | {action: 'createList'; name: string; text?: string}
  | {action: 'updateList'; id: number; name: string; text?: string}
  | {action: 'deleteList'; id: number}
  | {action: 'addItem'; listId: number; post: app.bsky.feed.defs.PostView}
  | {action: 'removeItem'; listId: number; cid: string}

export function useBookmarkListMutation() {
  const client = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const service = useTokimekiProxyService()
  const {t: l} = useLingui()

  return useMutation({
    async mutationFn(args: BookmarkListMutationArgs) {
      const owner = client.assertDid
      switch (args.action) {
        case 'createList':
          return await tokimekiXrpc(
            client,
            'tech.tokimeki.bookmark.addBookmark',
            {
              body: {bookmark: {owner, name: args.name, text: args.text}},
            },
          )
        case 'updateList':
          return await tokimekiXrpc(
            client,
            'tech.tokimeki.bookmark.addBookmark',
            {
              body: {
                bookmark: {
                  id: args.id,
                  owner,
                  name: args.name,
                  text: args.text,
                },
              },
            },
          )
        case 'deleteList':
          return await tokimekiXrpc(
            client,
            'tech.tokimeki.bookmark.deleteBookmark',
            {body: {bookmark: {id: args.id, owner}}},
          )
        case 'addItem':
          return await tokimekiXrpc(
            client,
            'tech.tokimeki.bookmark.addBookmarkItem',
            {
              body: {
                bookmark: {
                  bookmark: args.listId,
                  owner,
                  uri: args.post.uri,
                  cid: args.post.cid,
                },
              },
            },
          )
        case 'removeItem':
          return await tokimekiXrpc(
            client,
            'tech.tokimeki.bookmark.deleteBookmarkItem',
            {
              body: {
                bookmark: {bookmark: args.listId, owner, cid: args.cid},
              },
            },
          )
      }
    },
    onMutate(args) {
      /*
       * Membership is a plain id list, so flip it with the request. The write
       * is authoritative: see onSuccess for why we do not refetch it.
       */
      if (args.action !== 'addItem' && args.action !== 'removeItem') return
      const owner = client.did
      if (!owner) return
      const cid = args.action === 'addItem' ? args.post.cid : args.cid
      const key = createQueryKey(RELATED_KEY_ROOT, {owner, cid, service})
      const listId = String(args.listId)
      queryClient.setQueryData<string[]>(key, prev => {
        if (!prev) return prev
        if (args.action === 'addItem') {
          return prev.includes(listId) ? prev : [...prev, listId]
        }
        return prev.filter(id => id !== listId)
      })
    },
    onSuccess(_, args) {
      if (args.action === 'addItem' || args.action === 'removeItem') {
        /*
         * Do NOT refetch membership here. The 200 already tells us the write
         * landed, but TOKIMEKI's read index lags it by a few seconds, so an
         * immediate refetch returns the old state and overwrites the
         * optimistic update - the checkmark then only appears on a later
         * refresh. The 30s staleTime reconciles any real drift.
         */
        haptics.confirm()
        return
      }
      void queryClient.invalidateQueries({
        queryKey: ['tokimeki-bookmark-lists'],
      })
      void queryClient.invalidateQueries({queryKey: ['tokimeki-bookmark-feed']})
    },
    onError(e, args) {
      if (!isNetworkError(e)) {
        logger.error('TOKIMEKI bookmark list mutation failed', {
          bookmarkListAction: args.action,
          safeMessage: e,
        })
      }
      const message =
        args.action === 'addItem'
          ? l`Could not save to the list`
          : args.action === 'removeItem'
            ? l`Could not remove from the list`
            : args.action === 'deleteList'
              ? l`Could not delete the list`
              : l`Could not save the list`
      Toast.show(message, {type: 'error'})
    },
  })
}
