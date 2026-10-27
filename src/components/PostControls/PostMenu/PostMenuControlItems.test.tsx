import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

import {type Shadow} from '#/state/cache/post-shadow'
import {type app} from '#/lexicons'
import {PostMenuControlItems} from './PostMenuControlItems'

const mockQueueRepost = jest.fn()
const mockQueueUnrepost = jest.fn()
const mockAutoLike = jest.fn()

jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({palette: {}, atoms: {}}),
}))
jest.mock('@lingui/react', () => ({useLingui: () => ({_: () => ''})}))
jest.mock('#/state/queries/post', () => ({
  usePostRepostMutationQueue: () => [mockQueueRepost, mockQueueUnrepost],
  usePostLikeMutationQueue: () => [jest.fn()],
}))
jest.mock('../useAutoLikeAfterRepost', () => ({
  useAutoLikeAfterRepost: () => mockAutoLike,
}))
jest.mock('../BookmarkButton', () => ({usePostBookmark: () => ({})}))
jest.mock('#/state/session', () => ({
  useRequireAuth: () => (action: () => void) => action(),
}))
jest.mock('#/state/feed-feedback', () => ({
  useFeedFeedbackContext: () => ({sendInteraction: jest.fn()}),
}))
jest.mock('#/lib/hooks/useOpenComposer', () => ({
  useOpenComposer: () => ({openComposer: jest.fn()}),
}))
jest.mock('#/lib/haptics', () => ({useHaptics: () => ({confirm: jest.fn()})}))
jest.mock('#/analytics', () => ({useAnalytics: () => ({metric: jest.fn()})}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Menu', () => {
  const {Pressable, View} = jest.requireActual('react-native')
  return {
    Group: View,
    Divider: () => null,
    ItemIcon: () => null,
    ItemText: () => null,
    Item: ({testID, onPress}: {testID: string; onPress: () => void}) => (
      <Pressable accessibilityRole="button" testID={testID} onPress={onPress} />
    ),
  }
})

function mount(reposted = false) {
  const post = {
    uri: 'at://did:plc:author/app.bsky.feed.post/abc',
    author: {did: 'did:plc:author'},
    viewer: {
      repost: reposted ? 'at://did:plc:me/app.bsky.feed.repost/abc' : undefined,
    },
  } as unknown as Shadow<app.bsky.feed.defs.PostView>
  return render(
    <PostMenuControlItems
      post={post}
      postFeedContext={undefined}
      postReqId={undefined}
      logContext="Post"
    />,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockQueueRepost.mockResolvedValue(undefined)
  mockQueueUnrepost.mockResolvedValue(undefined)
  mockAutoLike.mockResolvedValue(undefined)
})

it('runs auto-like after a successful compact-menu repost', async () => {
  const {getByTestId} = mount()
  fireEvent.press(getByTestId('postDropdownRepostBtn'))
  await waitFor(() => expect(mockAutoLike).toHaveBeenCalledTimes(1))
  expect(mockQueueRepost.mock.invocationCallOrder[0]).toBeLessThan(
    mockAutoLike.mock.invocationCallOrder[0],
  )
})

it('does not auto-like when undoing a repost', async () => {
  const {getByTestId} = mount(true)
  fireEvent.press(getByTestId('postDropdownRepostBtn'))
  await waitFor(() => expect(mockQueueUnrepost).toHaveBeenCalledTimes(1))
  expect(mockAutoLike).not.toHaveBeenCalled()
})

it('ignores duplicate activation while a repost is pending', async () => {
  let finish!: () => void
  const pending = new Promise<void>(resolve => {
    finish = resolve
  })
  mockQueueRepost.mockReturnValueOnce(pending)
  const {getByTestId} = mount()
  fireEvent.press(getByTestId('postDropdownRepostBtn'))
  fireEvent.press(getByTestId('postDropdownRepostBtn'))
  expect(mockQueueRepost).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish()
    await pending
  })
  expect(mockAutoLike).toHaveBeenCalledTimes(1)
})
