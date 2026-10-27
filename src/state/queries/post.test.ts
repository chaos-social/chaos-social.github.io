import {QueryClient} from '@tanstack/react-query'

import {type app} from '#/lexicons'
import {findAllPostsInQueryData, RQKEY} from './post'

jest.mock('#/state/cache/post-shadow', () => ({
  updatePostShadow: jest.fn(),
}))
jest.mock('#/state/session', () => ({}))
jest.mock('#/state/queries/profile', () => ({}))
jest.mock('#/analytics', () => ({}))
jest.mock('#/features/sixSeven', () => ({}))
jest.mock('#/state/preferences/disable-via-repost-notification', () => ({}))

const uri = 'at://did:plc:alice/app.bsky.feed.post/abc'
const handleUri = 'at://alice.test/app.bsky.feed.post/abc'

function post(likeCount: number): app.bsky.feed.defs.PostView {
  return {
    uri,
    cid: 'bafyreia',
    record: {text: 'Quoted post'},
    indexedAt: '2026-10-27T00:00:00Z',
    author: {did: 'did:plc:alice', handle: 'alice.test'},
    likeCount,
  }
}

it('finds every copy of a post across DID and handle query keys', () => {
  const client = new QueryClient()
  const didPost = post(1)
  const handlePost = post(2)
  client.setQueryData(RQKEY(uri), didPost)
  client.setQueryData(RQKEY(handleUri), handlePost)

  for (const lookupUri of [uri, handleUri]) {
    const matches = [...findAllPostsInQueryData(client, lookupUri)]
    expect(matches).toHaveLength(2)
    expect(matches[0]).toBe(didPost)
    expect(matches[1]).toBe(handlePost)
  }
})

it('finds posts in batch queries without including unrelated posts', () => {
  const client = new QueryClient()
  const batchPost = post(3)
  const other = {
    ...post(0),
    uri: 'at://did:plc:alice/app.bsky.feed.post/other',
  }
  client.setQueryData(RQKEY(`${uri},${other.uri}`), [batchPost, other])
  client.setQueryData(RQKEY(other.uri), other)
  client.setQueryData(['other-query', uri], post(4))

  const matches = [...findAllPostsInQueryData(client, uri)]
  expect(matches).toHaveLength(1)
  expect(matches[0]).toBe(batchPost)
})

it('ignores post queries that have not loaded yet', () => {
  const client = new QueryClient()
  client.getQueryCache().build(client, {queryKey: RQKEY(handleUri)})

  expect([...findAllPostsInQueryData(client, uri)]).toEqual([])
})
