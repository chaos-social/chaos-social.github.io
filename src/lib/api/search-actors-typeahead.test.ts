import {type Client} from '@atproto/lex'
import {PasswordSession} from '@atproto/lex-password-session'

import {PUBLIC_BSKY_SERVICE} from '#/lib/constants'
import {createLexClient} from '#/lib/lexClient'
import {
  asFetch,
  DID,
  HANDLE,
  json,
  makeAccount,
  makeMockFetch,
} from '#/state/session/__tests__/mock-fetch'
import {sessionAccountToSessionData} from '#/state/session/session-data'
import {app} from '#/lexicons'
import {searchActorsTypeahead} from './search-actors-typeahead'

const BLACKSKY = 'did:web:api.blacksky.community#bsky_appview'
const BLUESKY = 'did:web:api.bsky.app#bsky_appview'
const params = {q: 'alice', limit: 8}
const result = {actors: [{did: DID, handle: HANDLE}]}

function makeClient(fetchMock: ReturnType<typeof makeMockFetch>) {
  const session = new PasswordSession(
    sessionAccountToSessionData(makeAccount()),
    {fetch: asFetch(fetchMock)},
  )
  return createLexClient(session, {service: BLACKSKY})
}

function headers(fetchMock: ReturnType<typeof makeMockFetch>) {
  return fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers))
}

it.each([result, {actors: []}])(
  'keeps successful results on the selected AppView',
  async body => {
    const fetchMock = makeMockFetch({
      'app.bsky.actor.searchActorsTypeahead': () => json(body),
    })
    await expect(
      searchActorsTypeahead(makeClient(fetchMock), params),
    ).resolves.toEqual(body)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headers(fetchMock)[0].get('atproto-proxy')).toBe(BLACKSKY)
  },
)

it.each([
  [502, 'InternalServerError', 'Failed to perform upstream request'],
  [404, 'NotFound', 'Not found'],
  [501, 'MethodNotImplemented', 'Unavailable'],
  [400, 'UnsupportedMethod', 'Unavailable'],
])(
  'retries an unavailable endpoint (%s) through the same authenticated client',
  async (status, error, message) => {
    const fetchMock = makeMockFetch({
      'app.bsky.actor.searchActorsTypeahead': (_url, init) =>
        new Headers(init.headers).get('atproto-proxy') === BLACKSKY
          ? json({error, message}, status)
          : json(result),
      'app.bsky.actor.getProfile': () => json(result.actors[0]),
    })
    const client = makeClient(fetchMock)
    await expect(searchActorsTypeahead(client, params)).resolves.toEqual(result)
    const requests = headers(fetchMock)
    expect(requests.map(h => h.get('atproto-proxy'))).toEqual([
      BLACKSKY,
      BLUESKY,
    ])
    expect(requests.map(h => h.get('authorization'))).toEqual([
      'Bearer access-jwt',
      'Bearer access-jwt',
    ])
    await client.call(app.bsky.actor.getProfile, {actor: DID})
    expect(headers(fetchMock)[2].get('atproto-proxy')).toBe(BLACKSKY)
  },
)

it.each([
  [400, 'InvalidRequest', 'Invalid query'],
  [401, 'AuthRequired', 'Authentication Required'],
  [403, 'Forbidden', 'Forbidden'],
  [429, 'RateLimitExceeded', 'Slow down'],
  [500, 'InternalServerError', 'Unexpected failure'],
  [502, 'InternalServerError', 'Other upstream failure'],
])(
  'does not fall back for unrelated errors (%s)',
  async (status, error, message) => {
    const fetchMock = makeMockFetch({
      'app.bsky.actor.searchActorsTypeahead': () =>
        json({error, message}, status),
    })
    await expect(
      searchActorsTypeahead(makeClient(fetchMock), params),
    ).rejects.toMatchObject({status, error})
    const actorCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('app.bsky.actor.searchActorsTypeahead'),
    )
    expect(actorCalls.length).toBe(status === 401 ? 2 : 1)
    for (const [, init] of actorCalls) {
      expect(new Headers(init?.headers).get('atproto-proxy')).toBe(BLACKSKY)
    }
  },
)

it('does not retry Bluesky against itself', async () => {
  const fetchMock = makeMockFetch({
    'app.bsky.actor.searchActorsTypeahead': () =>
      json({error: 'NotFound'}, 404),
  })
  const client = createLexClient(makeClient(fetchMock).agent, {
    service: BLUESKY,
  })
  await expect(searchActorsTypeahead(client, params)).rejects.toMatchObject({
    status: 404,
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('propagates fallback failures', async () => {
  const fetchMock = makeMockFetch({
    'app.bsky.actor.searchActorsTypeahead': (_url, init) =>
      new Headers(init.headers).get('atproto-proxy') === BLACKSKY
        ? json(
            {
              error: 'InternalServerError',
              message: 'Failed to perform upstream request',
            },
            502,
          )
        : json({error: 'RateLimitExceeded'}, 429),
  })
  await expect(
    searchActorsTypeahead(makeClient(fetchMock), params),
  ).rejects.toMatchObject({status: 429})
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('uses the public Bluesky endpoint for a guest fallback', async () => {
  const originalFetch = global.fetch
  const fetchMock: jest.MockedFunction<typeof fetch> = jest
    .fn()
    .mockResolvedValue(json(result))
  global.fetch = fetchMock
  const primaryFetch = makeMockFetch({
    'app.bsky.actor.searchActorsTypeahead': () =>
      json(
        {
          error: 'InternalServerError',
          message: 'Failed to perform upstream request',
        },
        502,
      ),
  })
  const client: Client = createLexClient({
    service: 'https://api.blacksky.community',
    fetch: asFetch(primaryFetch),
  })
  try {
    await expect(searchActorsTypeahead(client, params)).resolves.toEqual(result)
    const [input, init] = fetchMock.mock.calls[0]
    const url = new URL(input instanceof Request ? input.url : input)
    expect(url.origin).toBe(new URL(PUBLIC_BSKY_SERVICE).origin)
    expect(url.searchParams.get('q')).toBe(params.q)
    expect(url.searchParams.get('limit')).toBe(String(params.limit))
    expect(new Headers(init?.headers).has('authorization')).toBe(false)
    expect(new Headers(init?.headers).has('atproto-proxy')).toBe(false)
  } finally {
    global.fetch = originalFetch
  }
})

it('does not fall back after a network failure', async () => {
  const fetchMock = makeMockFetch({
    'app.bsky.actor.searchActorsTypeahead': () =>
      Promise.reject(new Error('network failure')),
  })
  await expect(
    searchActorsTypeahead(makeClient(fetchMock), params),
  ).rejects.toBeInstanceOf(Error)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
