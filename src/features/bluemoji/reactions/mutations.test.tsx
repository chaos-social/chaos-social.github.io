import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {
  OPTIMISTIC_URI,
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from '#/features/bluemoji/reactions/mutations'
import {
  isPersistedReaction,
  mergeViewerReactions,
  type ViewerReaction,
} from '#/features/bluemoji/reactions/queries'

jest.unmock('multiformats/cid')

/*
 * The factory runs before the test body, so it owns the spy and hands it back
 * through `jest.requireMock`. Reaching for it lazily keeps the call count
 * accurate across the module-level mock and avoids re-instantiating a client
 * that `mockResolvedValue` would not stick to.
 */
let pdsCall: jest.Mock

jest.mock('#/state/session', () => {
  const call = jest.fn()
  const pdsClient = {
    did: 'did:plc:me',
    assertDid: 'did:plc:me',
    call,
  }
  return {
    __esModule: true,
    pdsClient,
    usePdsClient: () => pdsClient,
    __setPdsCall: () => call,
  }
})

beforeAll(() => {
  const mock = jest.requireMock('#/state/session') as {
    __setPdsCall: () => jest.Mock
  }
  pdsCall = mock.__setPdsCall()
})

jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({confirm: jest.fn(), tap: jest.fn()}),
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

const emoji = {
  $type: 'blue.moji.feed.reaction#emojiRef',
  uri: 'at://did:plc:owner/blue.moji.collection.item/blobcat',
  name: ':blobcat:',
  formats: {$type: 'blue.moji.richtext.facet#formats_v1'},
} as unknown as import('#/lexicons').blue.moji.feed.reaction.EmojiRef

const item = {
  uri: emoji.uri,
  cid: 'bafyitem',
  did: 'did:plc:owner',
  record: {
    $type: 'blue.moji.collection.item',
    name: ':blobcat:',
    createdAt: '2026-01-01T00:00:00.000Z',
    formats: emoji.formats,
  },
} as never

const subject = 'at://did:plc:author/app.bsky.feed.post/abc'
const target = {uri: subject, cid: 'bafypost'}

function setup(queryClient: QueryClient) {
  return ({children}: {children: React.ReactNode}) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  pdsCall.mockResolvedValue({uri: '', cid: ''})
})

it('adds a viewer reaction entry that carries its emoji, not just the subject', async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['bluemoji-viewer-reactions'], [])
  queryClient.setQueryData(['bluemoji-reaction-counts'], [])

  const {result} = renderHook(() => useCreateReactionMutation(), {
    wrapper: setup(queryClient),
  })
  await result.current.mutateAsync({target, item})

  const viewer = queryClient.getQueryData<ViewerReaction[]>([
    'bluemoji-viewer-reactions',
  ])
  expect(viewer).toHaveLength(1)
  // Every reader matches on `emoji.uri`; a subject-only entry used to crash.
  expect(viewer?.[0].emoji.uri).toBe(emoji.uri)
  expect(viewer?.[0].subject).toBe(subject)
  expect(isPersistedReaction(viewer?.[0])).toBe(false)
})

it('does not write into every post counts cache', async () => {
  /*
   * Counts live under a per-post key. An earlier version matched the key by
   * prefix, so one reaction showed up on every post in the feed.
   */
  const queryClient = new QueryClient()
  const otherPost = 'at://did:plc:me/app.bsky.feed.post/other'
  queryClient.setQueryData(
    [`bluemoji-reaction-counts`, otherPost],
    [{emoji, count: 3}],
  )

  const {result} = renderHook(() => useCreateReactionMutation(), {
    wrapper: setup(queryClient),
  })
  await result.current.mutateAsync({target, item})

  expect(
    queryClient.getQueryData([`bluemoji-reaction-counts`, otherPost]),
  ).toEqual([{emoji, count: 3}])
})

it('merges the viewer reaction into counts for its own post only', () => {
  const groups = mergeViewerReactions([], [{uri: 'optimistic', subject, emoji}])
  expect(groups).toHaveLength(1)
  expect(groups[0].count).toBe(1)
  expect(groups[0].emoji.uri).toBe(emoji.uri)
})

it('does not double count a reaction the AppView already reports', () => {
  const groups = mergeViewerReactions(
    [{emoji, count: 2}],
    [{uri: 'optimistic', subject, emoji}],
  )
  expect(groups).toEqual([{emoji, count: 2}])
})

it('removes only the matching emoji, leaving the viewer other reactions on the post', async () => {
  const keeper = {
    uri: `${subject}/reaction/keeper`,
    subject,
    emoji: {
      ...emoji,
      uri: 'at://did:plc:owner/blue.moji.collection.item/keeper',
    },
  }
  const doomed = {
    uri: `${subject}/reaction/doomed`,
    subject,
    emoji,
  }
  const queryClient = new QueryClient()
  queryClient.setQueryData(['bluemoji-viewer-reactions'], [keeper, doomed])

  const {result} = renderHook(() => useDeleteReactionMutation(), {
    wrapper: setup(queryClient),
  })
  await result.current.mutateAsync({
    reactionUri: doomed.uri,
    target,
    emoji: doomed.emoji,
  })

  await waitFor(() => {
    const viewer = queryClient.getQueryData<ViewerReaction[]>([
      'bluemoji-viewer-reactions',
    ])
    expect(viewer?.map(r => r.emoji.uri)).toEqual([keeper.emoji.uri])
  })
})

it('skips the PDS call for an optimistic placeholder', async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['bluemoji-viewer-reactions'], [])

  const {result} = renderHook(() => useDeleteReactionMutation(), {
    wrapper: setup(queryClient),
  })
  await result.current.mutateAsync({
    reactionUri: OPTIMISTIC_URI,
    target,
    emoji,
  })

  expect(pdsCall).not.toHaveBeenCalled()
})
