import {Client} from '@atproto/lex'
import {QueryClient} from '@tanstack/react-query'

import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {item} from '#/features/bluemoji/__tests__/fixtures'
import {
  fetchBluemojiDiscoveryPage,
  fetchBluemojiItem,
  fetchBluemojiItemQuery,
  fetchBluemojiSuggestions,
} from '#/features/bluemoji/queries'

jest.unmock('multiformats/cid')

jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest.fn(),
}))
jest.mock('#/state/queries', () => ({
  STALE: {MINUTES: {FIVE: 300000, ONE: 60000}},
}))
jest.mock('#/state/queries/util', () => ({
  createQueryKey: (root: string, args: unknown) => [root, args],
}))
jest.mock('#/lib/hooks/useDeferredEnable', () => ({
  useDeferredEnable: (enabled: boolean) => enabled,
}))

const resolvePds = jest.mocked(resolvePdsServiceUrl)
const call = jest.spyOn(Client.prototype, 'call')

beforeEach(() => {
  resolvePds.mockResolvedValue('https://owner.example')
  call.mockReset()
  call.mockResolvedValue({uri: item.uri, cid: item.cid, value: item.record})
})

afterAll(() => call.mockRestore())

it('shares cached verification across repeated claims and ignores forged formats and flags', async () => {
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const claim = {
    did: item.did,
    name: item.record.name,
    formats: {png_128: 'forged'},
    adultOnly: false,
  }
  call.mockResolvedValue({
    uri: item.uri,
    cid: item.cid,
    value: {...item.record, adultOnly: true},
  })
  const results = await Promise.all([
    fetchBluemojiItemQuery(cache, claim),
    fetchBluemojiItemQuery(cache, claim),
  ])
  expect(call).toHaveBeenCalledTimes(1)
  expect(resolvePds).toHaveBeenCalledWith(item.did)
  expect(results[0]?.record.adultOnly).toBe(true)
  expect(results[0]?.record.formats).toEqual(item.record.formats)
  cache.clear()
})

it('rejects a response for a different URI or mismatched strong reference CID', async () => {
  call.mockResolvedValueOnce({
    uri: `${item.uri}-wrong`,
    cid: item.cid,
    value: item.record,
  })
  expect(await fetchBluemojiItem(item.uri)).toBeNull()
  expect(await fetchBluemojiItem(item.uri, 'incorrect')).toBeNull()
})

it('returns a text fallback when a source record is gone', async () => {
  call.mockRejectedValueOnce(
    Object.assign(new Error('Missing'), {error: 'RecordNotFound'}),
  )
  expect(await fetchBluemojiItem(item.uri)).toBeNull()
})

it('rejects malformed source records', async () => {
  call.mockResolvedValueOnce({
    uri: item.uri,
    cid: item.cid,
    value: {$type: 'blue.moji.collection.item', name: ':cat:'},
  })
  expect(await fetchBluemojiItem(item.uri)).toBeNull()
})

it('keeps usable discovery references when legacy asset metadata is malformed', async () => {
  call.mockResolvedValueOnce({
    items: [
      {
        ...item.record,
        did: item.did,
        uri: item.uri,
        cid: item.cid,
        formats: {
          $type: 'blue.moji.collection.item#formats_v0',
          lottie: {'0': 1},
        },
      },
      {name: 42},
      {name: ':forged:', uri: 'not-an-at-uri'},
    ],
  })
  const result = await fetchBluemojiDiscoveryPage({repo: item.did, q: 'blob'})
  expect(result.items).toHaveLength(1)
  expect(result.items[0].formats).toEqual({
    $type: 'blue.moji.collection.item#formats_v1',
  })
  expect(result.items[0].uri).toBe(item.uri)
})

it('verifies autocomplete results and skips a stale or forged source reference', async () => {
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}})
  call.mockResolvedValueOnce({
    items: [
      {...item.record, did: item.did, uri: item.uri, cid: item.cid},
      {...item.record, did: item.did, uri: `${item.uri}-forged`, cid: item.cid},
    ],
  })
  const results = await fetchBluemojiSuggestions(cache, item.did, 'blob')
  expect(results).toEqual([item])
  expect(call).toHaveBeenCalledTimes(3)
  cache.clear()
})
