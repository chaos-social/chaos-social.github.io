import {act, renderHook} from '@testing-library/react-native'

import {type Shadow} from '#/state/cache/types'
import {type app} from '#/lexicons'
import {useAutoLikeAfterRepost} from './useAutoLikeAfterRepost'

const mockGetPost = jest.fn()
const mockQueueLike = jest.fn()
const mockInteraction = jest.fn()
const mockCaptureAction = jest.fn()
let mockEnabled = true
let mockHistory: string[] = []

jest.mock('#/state/preferences/auto-like-on-repost', () => ({
  useAutoLikeOnRepost: () => mockEnabled,
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: {did: 'did:plc:me'}}),
}))
jest.mock('#/state/queries/post', () => ({useGetPost: () => mockGetPost}))
jest.mock('#/state/feed-feedback', () => ({
  useFeedFeedbackContext: () => ({sendInteraction: mockInteraction}),
}))
jest.mock('#/state/shell/progress-guide', () => ({
  ProgressGuideAction: {Like: 'like'},
  useProgressGuideControls: () => ({captureAction: mockCaptureAction}),
}))
jest.mock('#/state/userActionHistory', () => ({
  getActionHistory: () => ({likes: mockHistory}),
}))

const post = {
  uri: 'at://did:plc:author/app.bsky.feed.post/abc',
  author: {did: 'did:plc:author'},
  viewer: {},
} as unknown as Shadow<app.bsky.feed.defs.PostView>

beforeEach(() => {
  jest.clearAllMocks()
  mockEnabled = true
  mockHistory = []
  mockGetPost.mockResolvedValue(post)
  mockQueueLike.mockResolvedValue(undefined)
})

it('checks the current like state and then auto-likes with feed feedback', async () => {
  const onLike = jest.fn()
  const {result} = renderHook(() =>
    useAutoLikeAfterRepost({
      post,
      queueLike: mockQueueLike,
      feedContext: 'ctx',
      reqId: 'req',
      onLike,
    }),
  )
  await act(() => result.current())
  expect(mockGetPost).toHaveBeenCalledWith({uri: post.uri})
  expect(onLike).toHaveBeenCalledTimes(1)
  expect(mockQueueLike).toHaveBeenCalledTimes(1)
  expect(mockInteraction).toHaveBeenCalledWith({
    item: post.uri,
    event: 'app.bsky.feed.defs#interactionLike',
    feedContext: 'ctx',
    reqId: 'req',
  })
  expect(mockCaptureAction).toHaveBeenCalledWith('like')
})

it('does nothing when the preference is disabled', async () => {
  mockEnabled = false
  const {result} = renderHook(() =>
    useAutoLikeAfterRepost({post, queueLike: mockQueueLike}),
  )
  await act(() => result.current())
  expect(mockGetPost).not.toHaveBeenCalled()
  expect(mockQueueLike).not.toHaveBeenCalled()
})

it.each(['self', 'already liked', 'history', 'remote like', 'failed read'])(
  'does not auto-like for %s',
  async kind => {
    let target = post
    if (kind === 'self')
      target = {
        ...post,
        author: {...post.author, did: 'did:plc:me'},
      } as unknown as typeof post
    if (kind === 'already liked')
      target = {...post, viewer: {like: 'at://like'}} as unknown as typeof post
    if (kind === 'history') mockHistory = [post.uri]
    if (kind === 'remote like')
      mockGetPost.mockResolvedValue({...post, viewer: {like: 'at://like'}})
    if (kind === 'failed read')
      mockGetPost.mockRejectedValue(new Error('offline'))
    const {result} = renderHook(() =>
      useAutoLikeAfterRepost({post: target, queueLike: mockQueueLike}),
    )
    await act(() => result.current())
    expect(mockQueueLike).not.toHaveBeenCalled()
    expect(mockInteraction).not.toHaveBeenCalled()
  },
)
