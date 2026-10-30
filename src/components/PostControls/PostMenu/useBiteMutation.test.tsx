import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {useBiteMutation} from './useBiteMutation'

const mockPutRecord = jest.fn()

type BiteInput = {rkey: string} & Record<string, unknown>
const biteRkeys = () =>
  mockPutRecord.mock.calls.map(([input]) => (input as BiteInput).rkey)

jest.mock('#/state/session', () => ({
  usePdsClient: () => ({
    assertDid: 'did:plc:me',
    call: (_def: unknown, input: unknown) => mockPutRecord(input),
  }),
}))
jest.mock('#/lexicons', () => ({com: {atproto: {repo: {putRecord: {}}}}}))

function renderBite(postUri: string) {
  const queryClient = new QueryClient()
  return renderHook(() => useBiteMutation(postUri), {
    wrapper: ({children}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

beforeEach(() => {
  mockPutRecord.mockReset()
  mockPutRecord.mockResolvedValue({uri: 'at://fake', cid: 'bafyfake'})
})

it('writes the wafrn bite record for the post', async () => {
  const {result} = renderBite('at://did:plc:author/app.bsky.feed.post/3kabc')

  result.current.mutate()

  await waitFor(() => expect(mockPutRecord).toHaveBeenCalled())
  expect(mockPutRecord).toHaveBeenCalledWith(
    expect.objectContaining({
      repo: 'did:plc:me',
      collection: 'net.wafrn.feed.bite',
      rkey: 'did:plc:author-3kabc',
      validate: false,
      record: expect.objectContaining({
        $type: 'net.wafrn.feed.bite',
        subject: 'at://did:plc:author/app.bsky.feed.post/3kabc',
      }),
    }),
  )
})

it('derives the same rkey for the same post so a second bite overwrites', async () => {
  const postUri = 'at://did:plc:author/app.bsky.feed.post/3kabc'

  renderBite(postUri).result.current.mutate()
  renderBite(postUri).result.current.mutate()

  await waitFor(() => expect(mockPutRecord).toHaveBeenCalledTimes(2))
  expect(biteRkeys()).toEqual(['did:plc:author-3kabc', 'did:plc:author-3kabc'])
})
