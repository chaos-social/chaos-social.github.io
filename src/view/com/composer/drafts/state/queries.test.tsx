import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import {act, renderHook, waitFor} from '@testing-library/react-native'

import {type ComposerState} from '#/view/com/composer/state/composer'
import {app} from '#/lexicons'
import {
  useCleanupPublishedDraftMutation,
  useDeleteDraftMutation,
  useDraftsQuery,
  useSaveDraftMutation,
} from './queries'

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
let mockCurrentDid = alice
let mockAccounts = [{did: alice}, {did: bob}]
const mockDispose = jest.fn()
const mockAliceClient = {
  assertDid: alice,
  call: jest.fn(() => Promise.resolve({id: 'alice-draft', drafts: []})),
}
const mockBobClient = {
  assertDid: bob,
  call: jest.fn(() => Promise.resolve({id: 'bob-draft', drafts: []})),
}
const mockAliceChatClient = {assertDid: alice}
const mockBobChatClient = {assertDid: bob}
const mockCreateEphemeralAgent = jest.fn((account: {did: string}) =>
  Promise.resolve({
    did: account.did,
    dispose: mockDispose,
  }),
)
const mockConvert = jest.fn((..._args: unknown[]) =>
  Promise.resolve({
    draft: {posts: []},
    localRefPaths: new Map<string, string>(),
  }),
)

jest.mock('#/state/session', () => ({
  useSession: () => ({
    currentAccount: {did: mockCurrentDid},
    accounts: mockAccounts,
  }),
  useAppviewClient: () =>
    mockCurrentDid === 'did:plc:alice' ? mockAliceClient : mockBobClient,
  useChatClient: () =>
    mockCurrentDid === 'did:plc:alice'
      ? mockAliceChatClient
      : mockBobChatClient,
  useSessionApi: () => ({createEphemeralAgent: mockCreateEphemeralAgent}),
}))
jest.mock('#/state/session/agent', () => ({
  pdsAgent: (agent: unknown) => agent,
}))
jest.mock('#/state/session/clients', () => ({
  buildAppviewClient: (agent: {did: string}) =>
    agent.did === 'did:plc:alice' ? mockAliceClient : mockBobClient,
  buildChatClient: (agent: {did: string}) =>
    agent.did === 'did:plc:alice' ? mockAliceChatClient : mockBobChatClient,
}))
jest.mock('#/state/queries/util', () => ({
  createQueryKey: (root: string, args: unknown) => [root, args, {}],
}))
jest.mock('#/analytics', () => ({useAnalytics: () => ({})}))
jest.mock('#/analytics/identifiers', () => ({getDeviceId: () => 'device'}))
jest.mock('./api', () => ({
  composerStateToDraft: (...args: unknown[]) => mockConvert(...args),
  draftViewToSummary: (value: unknown) => value,
}))
jest.mock('./logger', () => ({
  logger: {debug: jest.fn(), error: jest.fn(), warn: jest.fn()},
}))
jest.mock('./storage', () => ({
  ensureMediaCachePopulated: jest.fn(() => Promise.resolve()),
  mediaExists: jest.fn(() => true),
  saveMediaToLocal: jest.fn(() => Promise.resolve()),
  deleteMediaFromLocal: jest.fn(),
}))

let queryClient: QueryClient
function wrapper({children}: {children: React.ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeAll(() => {
  notifyManager.setNotifyFunction(callback => {
    act(callback)
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCurrentDid = alice
  mockAccounts = [{did: alice}, {did: bob}]
  mockAliceClient.assertDid = alice
  mockCreateEphemeralAgent.mockImplementation(account =>
    Promise.resolve({
      did: account.did,
      dispose: mockDispose,
    }),
  )
  queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
})

afterEach(() => queryClient.clear())

it('saves to the composer author after another tab changes the session account', async () => {
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
  const {result, rerender} = renderHook(() => useSaveDraftMutation(alice), {
    wrapper,
  })
  mockCurrentDid = bob
  rerender({})

  await act(async () => {
    const saved = await result.current.mutateAsync({
      composerState: {} as ComposerState,
    })
    expect(saved.draftId).toBe('alice-draft')
  })

  expect(mockCreateEphemeralAgent).toHaveBeenCalledWith({did: alice})
  expect(mockConvert).toHaveBeenCalledWith(
    {appviewClient: mockAliceClient, chatClient: mockAliceChatClient},
    {},
    undefined,
  )
  expect(mockAliceClient.call).toHaveBeenCalledWith(
    app.bsky.draft.createDraft,
    {draft: {posts: []}},
  )
  expect(mockBobClient.call).not.toHaveBeenCalled()
  expect(mockDispose).toHaveBeenCalledTimes(1)
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['drafts', {did: alice}, {}],
  })
})

it('updates an existing draft using the retained composer author', async () => {
  mockCurrentDid = bob
  const {result} = renderHook(() => useSaveDraftMutation(alice), {wrapper})

  await act(async () => {
    await result.current.mutateAsync({
      composerState: {} as ComposerState,
      existingDraftId: 'existing-alice-draft',
    })
  })

  expect(mockAliceClient.call).toHaveBeenCalledWith(
    app.bsky.draft.updateDraft,
    {draft: {id: 'existing-alice-draft', draft: {posts: []}}},
  )
  expect(mockBobClient.call).not.toHaveBeenCalled()
})

it('lists the selected author drafts with account-isolated query caches', async () => {
  mockCurrentDid = bob
  const {result} = renderHook(
    () => ({alice: useDraftsQuery(alice), bob: useDraftsQuery(bob)}),
    {wrapper},
  )
  await waitFor(() => {
    expect(result.current.alice.isSuccess).toBe(true)
    expect(result.current.bob.isSuccess).toBe(true)
  })

  expect(mockAliceClient.call).toHaveBeenCalledWith(app.bsky.draft.getDrafts, {
    cursor: undefined,
  })
  expect(mockBobClient.call).toHaveBeenCalledWith(app.bsky.draft.getDrafts, {
    cursor: undefined,
  })
  expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
  expect(mockCreateEphemeralAgent).toHaveBeenCalledTimes(1)
  expect(mockCreateEphemeralAgent).toHaveBeenCalledWith({did: alice})
})

it('deletes and cleans up drafts on their selected account', async () => {
  mockCurrentDid = bob
  const {result} = renderHook(
    () => ({
      remove: useDeleteDraftMutation(alice),
      cleanup: useCleanupPublishedDraftMutation(alice),
    }),
    {wrapper},
  )

  await act(async () => {
    await result.current.remove.mutateAsync({
      draftId: 'remove-alice',
      draft: {posts: []},
    })
    await result.current.cleanup.mutateAsync({
      draftId: 'publish-alice',
      originalLocalRefs: new Set(),
    })
  })

  expect(mockAliceClient.call).toHaveBeenCalledWith(
    app.bsky.draft.deleteDraft,
    {id: 'remove-alice'},
  )
  expect(mockAliceClient.call).toHaveBeenCalledWith(
    app.bsky.draft.deleteDraft,
    {id: 'publish-alice'},
  )
  expect(mockBobClient.call).not.toHaveBeenCalled()
  expect(mockDispose).toHaveBeenCalledTimes(2)
})

it('disposes the selected account session when saving fails without falling back', async () => {
  mockCurrentDid = bob
  mockAliceClient.call.mockRejectedValueOnce(new Error('network unavailable'))
  const {result} = renderHook(() => useSaveDraftMutation(alice), {wrapper})

  await act(async () => {
    await expect(
      result.current.mutateAsync({composerState: {} as ComposerState}),
    ).rejects.toThrow('network unavailable')
  })

  expect(mockDispose).toHaveBeenCalledTimes(1)
  expect(mockBobClient.call).not.toHaveBeenCalled()
})

it.each(['removed', 'mismatched'])(
  'fails safely instead of saving under the session account when the author is %s',
  async failure => {
    mockCurrentDid = bob
    if (failure === 'removed') mockAccounts = [{did: bob}]
    if (failure === 'mismatched') mockAliceClient.assertDid = bob
    const {result} = renderHook(() => useSaveDraftMutation(alice), {wrapper})

    await act(async () => {
      await expect(
        result.current.mutateAsync({composerState: {} as ComposerState}),
      ).rejects.toThrow()
    })

    expect(mockAliceClient.call).not.toHaveBeenCalled()
    expect(mockBobClient.call).not.toHaveBeenCalled()
    expect(mockConvert).not.toHaveBeenCalled()
    if (failure === 'mismatched') expect(mockDispose).toHaveBeenCalledTimes(1)
  },
)
