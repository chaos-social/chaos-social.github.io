import {type Client} from '@atproto/lex'

import {fetchPostAnon} from '../see-through-blocks'

jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: () => Promise.resolve('https://pds.example'),
}))

const SLINGSHOT = 'https://slingshot.example/'
const URI = 'at://did:plc:alice/app.bsky.feed.post/3k'

const record = {
  $type: 'app.bsky.feed.post',
  text: 'blocked but readable',
  createdAt: '2024-01-01T00:00:00.000Z',
}

function makeClient(posts: unknown[] | Error) {
  const call = () =>
    posts instanceof Error
      ? Promise.reject(posts)
      : Promise.resolve({posts})
  return {call} as unknown as Client
}

function jsonResponse(body: unknown) {
  return {ok: true, json: () => Promise.resolve(body)} as Response
}

function errorResponse() {
  return {ok: false, status: 500} as Response
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock
})

/** The URL each fallback requested, in order. */
function requestedHosts() {
  return fetchMock.mock.calls.map(([url]) => (url as URL).hostname)
}

describe('fetchPostAnon', () => {
  it('uses the anonymous appview when it answers', async () => {
    const view = {uri: URI, cid: 'bafy', author: {did: 'did:plc:alice'}}
    const result = await fetchPostAnon(makeClient([view]), SLINGSHOT, URI)
    expect(result).toBe(view)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to slingshot when the appview returns nothing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({value: record}))
    const result = await fetchPostAnon(makeClient([]), SLINGSHOT, URI)
    expect(result?.uri).toBe(URI)
    expect(requestedHosts()).toEqual(['slingshot.example'])
  })

  it('falls back to the author pds when slingshot fails', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(jsonResponse({value: record}))
    const result = await fetchPostAnon(
      makeClient(new Error('boom')),
      SLINGSHOT,
      URI,
    )
    expect(result?.uri).toBe(URI)
    expect(requestedHosts()).toEqual(['slingshot.example', 'pds.example'])
  })

  it('returns undefined when every source fails', async () => {
    fetchMock.mockResolvedValue(errorResponse())
    const result = await fetchPostAnon(
      makeClient(new Error('boom')),
      SLINGSHOT,
      URI,
    )
    expect(result).toBeUndefined()
  })

  it('ignores a record that is not a post', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({value: {$type: 'app.bsky.graph.follow'}}),
    )
    const result = await fetchPostAnon(makeClient([]), SLINGSHOT, URI)
    expect(result).toBeUndefined()
  })
})
