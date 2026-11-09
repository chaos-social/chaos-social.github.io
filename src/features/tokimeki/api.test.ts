import {constellationLinks} from '#/state/queries/constellation'
import {fetchTokimekiPoll} from './api'
import {TOKIMEKI_POLL_COLLECTION, TOKIMEKI_VOTE_COLLECTION} from './types'

jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest.fn(() => Promise.resolve('https://pds.test')),
}))
jest.mock('#/state/queries/constellation', () => ({
  ...jest.requireActual('#/state/queries/constellation'),
  constellationLinks: jest.fn(),
}))
jest.mock('#/state/session', () => ({useSession: jest.fn()}))

const author = 'did:web:author.test'
const voter = 'did:plc:voter'
const ref = {did: author, rkey: 'poll'}
const uri = `at://${author}/${TOKIMEKI_POLL_COLLECTION}/poll`
const originalFetch = global.fetch
const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()
const records = new Map<string, object>()

function vote(index: number, createdAt = '2026-11-09T01:00:00Z') {
  return {
    $type: TOKIMEKI_VOTE_COLLECTION,
    poll: {uri, cid: 'poll-cid'},
    optionIndex: index,
    createdAt,
  }
}

beforeEach(() => {
  records.clear()
  records.set(`${author}/poll`, {
    $type: TOKIMEKI_POLL_COLLECTION,
    options: ['Yes', 'No'],
    createdAt: '2026-11-09T00:00:00Z',
    endsAt: '2026-11-10T00:00:00Z',
  })
  jest.mocked(constellationLinks).mockImplementation(async function* () {
    for (const key of records.keys()) {
      const [did, rkey] = key.split('/')
      if (did !== author)
        yield await Promise.resolve({
          did: did as `did:${string}:${string}`,
          collection: TOKIMEKI_VOTE_COLLECTION,
          rkey,
        })
    }
  })
  global.fetch = mockFetch
  mockFetch.mockImplementation(input => {
    if (!(input instanceof URL)) throw new Error('Expected URL')
    const url = input
    const did = url.searchParams.get('repo')!
    const rkey = url.searchParams.get('rkey')!
    const value = records.get(`${did}/${rkey}`)
    return Promise.resolve({
      ok: Boolean(value),
      status: value ? 200 : 404,
      json: () =>
        Promise.resolve({
          uri: `at://${did}/${url.searchParams.get('collection')}/${rkey}`,
          cid: did === author ? 'poll-cid' : 'vote-cid',
          value,
        }),
    } as Response)
  })
})

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

it('reads a poll directly and counts verified vote backlinks', async () => {
  records.set(`${voter}/vote`, vote(1))
  const poll = await fetchTokimekiPoll(ref, voter, 'https://constellation.test')
  expect(poll).toMatchObject({uri, counts: [0, 1], totalVotes: 1, myVote: 1})
  expect(constellationLinks).toHaveBeenCalledWith(
    'https://constellation.test',
    {
      target: uri,
      collection: TOKIMEKI_VOTE_COLLECTION,
      path: '.poll.uri',
    },
  )
  expect(
    jest
      .mocked(fetch)
      .mock.calls.every(
        ([url]) => url instanceof URL && url.origin === 'https://pds.test',
      ),
  ).toBe(true)
})

it('counts each voter once using their latest valid vote', async () => {
  records.set(`${voter}/old`, vote(0))
  records.set(`${voter}/new`, vote(1, '2026-11-09T02:00:00Z'))
  expect(
    await fetchTokimekiPoll(ref, voter, 'https://constellation.test'),
  ).toMatchObject({counts: [0, 1], totalVotes: 1, myVote: 1})
})

it('rejects mismatched poll refs, invalid choices and votes after closing', async () => {
  records.set('did:plc:wrongcid/vote', {
    ...vote(0),
    poll: {uri, cid: 'old-cid'},
  })
  records.set('did:plc:wronguri/vote', {
    ...vote(0),
    poll: {uri: 'at://another/poll/key', cid: 'poll-cid'},
  })
  records.set('did:plc:fraction/vote', vote(0.5))
  records.set('did:plc:outside/vote', vote(2))
  records.set('did:plc:late/vote', vote(0, '2026-11-11T00:00:00Z'))
  expect(
    await fetchTokimekiPoll(ref, voter, 'https://constellation.test'),
  ).toMatchObject({counts: [0, 0], totalVotes: 0, myVote: undefined})
})

it('still displays a new poll with no indexed votes', async () => {
  expect(
    await fetchTokimekiPoll(ref, '', 'https://constellation.test'),
  ).toMatchObject({options: ['Yes', 'No'], counts: [0, 0], totalVotes: 0})
})

it('does not treat an unreadable PDS as a missing poll', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ok: false, status: 503} as Response)
  await expect(
    fetchTokimekiPoll(ref, '', 'https://constellation.test'),
  ).rejects.toThrow('Could not read poll record: 503')
})
