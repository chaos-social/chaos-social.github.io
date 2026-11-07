import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook} from '@testing-library/react-native'

import {
  ITEM_COLLECTION,
  useDeleteEmojiMutation,
  useSaveEmojiMutation,
} from '#/features/bluemoji/collection/mutations'
import {OWN_COLLECTION_ROOT} from '#/features/bluemoji/collection/queries'
import {type BluemojiItem} from '#/features/bluemoji/util'

jest.unmock('multiformats/cid')

type CallParams = {
  rkey?: string
  collection?: string
  record?: {formats?: Record<string, unknown>} & Record<string, unknown>
}

let pdsCall: jest.Mock

jest.mock('#/state/session', () => {
  const call = jest.fn()
  const pdsClient = {did: 'did:plc:me', assertDid: 'did:plc:me', call}
  return {
    __esModule: true,
    pdsClient,
    usePdsClient: () => pdsClient,
    __setPdsCall: () => call,
  }
})
jest.mock('#/lib/api', () => ({
  uploadBlob: jest.fn(() => Promise.resolve({blob: {ref: {$link: 'bafynew'}}})),
}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({confirm: jest.fn(), tap: jest.fn(), success: jest.fn()}),
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

beforeAll(() => {
  const mock = jest.requireMock('#/state/session') as {
    __setPdsCall: () => jest.Mock
  }
  pdsCall = mock.__setPdsCall()
})

/** The mock is untyped through `requireMock`, so assert the shape once here. */
function calls() {
  return pdsCall.mock.calls as [{$nsid?: string}, CallParams][]
}

/** An item whose rkey does not match its alias, as historical collections have. */
const item = {
  uri: 'at://did:plc:me/blue.moji.collection.item/hist0rical',
  cid: 'bafyitem',
  did: 'did:plc:me',
  record: {
    $type: 'blue.moji.collection.item',
    name: ':blobcat:',
    alt: 'a cat',
    createdAt: '2026-01-01T00:00:00.000Z',
    formats: {$type: 'blue.moji.collection.item#formats_v1', png_128: 'kept'},
  },
} as unknown as BluemojiItem

function setup(queryClient: QueryClient) {
  return ({children}: {children: React.ReactNode}) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nProvider>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  pdsCall.mockResolvedValue({})
})

it('edits in place, keeping the record rkey and its renditions', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    alt: 'new',
    editing: item,
  })

  const [def, params] = calls()[0]
  expect(def.$nsid).toBe('com.atproto.repo.putRecord')
  expect(params).toMatchObject({
    collection: ITEM_COLLECTION,
    // Not `blobcat`, which is what deriving the rkey from the alias would give.
    rkey: 'hist0rical',
    record: {
      name: ':blobcat:',
      alt: 'new',
      createdAt: '2026-01-01T00:00:00.000Z',
      formats: {$type: 'blue.moji.collection.item#formats_v1', png_128: 'kept'},
    },
  })
  expect(calls()).toHaveLength(1)
})

it('renames by writing the new rkey and deleting the old one', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({alias: ':newcat:', editing: item})

  expect(calls()).toHaveLength(2)
  expect(calls()[0][1]).toMatchObject({rkey: 'newcat'})
  expect(calls()[1][0].$nsid).toBe('com.atproto.repo.deleteRecord')
  expect(calls()[1][1]).toMatchObject({rkey: 'hist0rical'})
})

it('replaces the renditions when a new image is picked', async () => {
  const queryClient = new QueryClient()
  const {result} = renderHook(() => useSaveEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync({
    alias: ':blobcat:',
    image: {path: '/tmp/cat.png', mime: 'image/png'} as never,
    editing: item,
  })

  expect(calls()[0][1].record?.formats?.png_128).toEqual({
    ref: {$link: 'bafynew'},
  })
})

it('deletes by the record rkey, not the alias', async () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData([OWN_COLLECTION_ROOT, {did: 'did:plc:me'}], [item])
  const {result} = renderHook(() => useDeleteEmojiMutation(), {
    wrapper: setup(queryClient),
  })

  await result.current.mutateAsync(item)

  expect(calls()[0][0].$nsid).toBe('com.atproto.repo.deleteRecord')
  expect(calls()[0][1]).toMatchObject({rkey: 'hist0rical'})
})
