import {Client} from '@atproto/lex'

import {fetchReactionCounts} from '#/features/bluemoji/reactions/queries'

jest.unmock('multiformats/cid')

jest.mock('#/state/queries', () => ({STALE: {MINUTES: {ONE: 60000, FIVE: 300000}}}))
jest.mock('#/state/queries/util', () => ({
  createQueryKey: (root: string, args: unknown) => [root, args],
}))
jest.mock('#/lib/hooks/useDeferredEnable', () => ({
  useDeferredEnable: (enabled: boolean) => enabled,
}))
jest.mock('#/state/session', () => ({
  usePdsClient: () => ({}),
  useSession: () => ({currentAccount: undefined}),
}))
jest.mock('#/state/preferences/constellation-instance', () => ({
  useConstellationInstance: () => undefined,
}))

const call = jest.spyOn(Client.prototype, 'call')

const emoji = {
  $type: 'blue.moji.feed.reaction#emojiRef',
  uri: 'at://did:plc:owner/blue.moji.collection.item/blobcat',
  name: ':blobcat:',
  formats: {$type: 'blue.moji.richtext.facet#formats_v1'},
}

const counts = (uri: string, count: number) => ({
  uri,
  groups: [
    {
      $type: 'blue.moji.feed.defs#reactionGroup',
      emoji,
      count,
    },
  ],
})

beforeEach(() => call.mockReset())
afterAll(() => call.mockRestore())

it('coalesces concurrent lookups into one request and resolves each subject', async () => {
  call.mockImplementation((_def, params: {uris: string[]}) =>
    Promise.resolve({
      counts: params.uris.map((uri, i) => counts(uri, i + 1)),
    }),
  )

  const [a, b, c] = await Promise.all([
    fetchReactionCounts('at://post/a'),
    fetchReactionCounts('at://post/b'),
    fetchReactionCounts('at://post/c'),
  ])

  expect(call).toHaveBeenCalledTimes(1)
  expect(call.mock.calls[0][1]).toMatchObject({
    uris: ['at://post/a', 'at://post/b', 'at://post/c'],
  })
  expect(a?.[0].count).toBe(1)
  expect(b?.[0].count).toBe(2)
  expect(c?.[0].count).toBe(3)
})

it('treats a failed batch as no reactions rather than hanging', async () => {
  call.mockRejectedValue(new Error('offline'))

  await expect(fetchReactionCounts('at://post/a')).resolves.toEqual([])
})

it('drops groups with a zero count', async () => {
  call.mockResolvedValue({counts: [counts('at://post/a', 0)]})

  await expect(fetchReactionCounts('at://post/a')).resolves.toEqual([])
})
