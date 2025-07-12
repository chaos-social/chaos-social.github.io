import {useCallback} from 'react'
import {
  type AppBskyFeedDefs,
  AtUri,
  type ComAtprotoRepoDeleteRecord,
  type ComAtprotoRepoPutRecord,
} from '@atproto/api'
import {useMutation} from '@tanstack/react-query'

import {useToggleMutationQueue} from '#/lib/hooks/useToggleMutationQueue'
import {type Shadow} from '../cache/types'
import {useAgent} from '../session'
import {getBookmarkUri} from './my-bookmarks'

export function usePostBookmarkMutationQueue(
  post: Shadow<AppBskyFeedDefs.PostView>,
) {
  const initialBookmarkUri = getBookmarkUri(post.uri)
  const bookmarkMutation = usePostBookmarkMutation(post)
  const unBookmarkMutation = usePostUnBookmarkMutation()

  const queueToggle = useToggleMutationQueue({
    initialState: initialBookmarkUri,
    runMutation: async (prevBookmarkUri, shouldBookmark) => {
      if (shouldBookmark) {
        const {data} = await bookmarkMutation.mutateAsync()
        return data.uri
      } else {
        if (prevBookmarkUri) {
          await unBookmarkMutation.mutateAsync({
            bookmarkUri: prevBookmarkUri,
          })
        }
        return undefined
      }
    },
    onSuccess() {},
  })

  const queueBookmark = useCallback(() => {
    return queueToggle(true)
  }, [queueToggle])

  const unQueueBookmark = useCallback(() => {
    return queueToggle(false)
  }, [queueToggle])
  return [queueBookmark, unQueueBookmark]
}

function usePostBookmarkMutation(
  post: Shadow<AppBskyFeedDefs.PostView>,
) {
  const agent = useAgent()
  return useMutation<ComAtprotoRepoPutRecord.Response, Error>({
    mutationFn: () => {
      const record = {
        $type: 'community.lexicon.bookmarks.bookmark',
        subject: post.uri,
        createdAt: new Date().toISOString(),
      }
      return agent.com.atproto.repo.createRecord({
        repo: agent.assertDid,
        collection: 'community.lexicon.bookmarks.bookmark',
        record,
        validate: false,
      })
    },
  })
}

function usePostUnBookmarkMutation() {
  const agent = useAgent()
  return useMutation<
    ComAtprotoRepoDeleteRecord.Response,
    Error,
    {bookmarkUri: string}
  >({
    mutationFn: ({bookmarkUri}) => {
      const bookmarkUrip = new AtUri(bookmarkUri)
      return agent.com.atproto.repo.deleteRecord({
        repo: agent.assertDid,
        collection: 'community.lexicon.bookmarks.bookmark',
        rkey: bookmarkUrip.rkey,
      })
    },
  })
}