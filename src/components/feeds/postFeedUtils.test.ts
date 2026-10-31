import {type FeedPostSlice} from '#/state/queries/post-feed'
import {markSeen} from '#/state/seen-posts'
import {
  collectPdsProfileDidsForFeedRow,
  filterFeedSlices,
  groupReposts,
} from '#/components/feeds/postFeedUtils'

function slice(
  name: string,
  {
    repost = false,
    replyDisabled = false,
    embed,
  }: {
    repost?: boolean
    replyDisabled?: boolean
    embed?: unknown
  } = {},
): FeedPostSlice {
  return {
    _reactKey: name,
    feedPostUri: `at://${name}`,
    items: [
      {
        post: {
          author: {did: `did:plc:${name}`},
          viewer: {replyDisabled},
          embed,
        },
      },
    ],
    reason: repost ? {$type: 'app.bsky.feed.defs#reasonRepost'} : undefined,
  } as unknown as FeedPostSlice
}

const blockedQuote = {
  $type: 'app.bsky.embed.record#view',
  record: {
    $type: 'app.bsky.embed.record#viewBlocked',
    author: {did: 'did:plc:quoted', viewer: {blocking: 'at://block'}},
  },
}

it('applies feed filters before a repost carousel can hide their contents', () => {
  const ordinary = slice('ordinary')
  const unreplyable = slice('unreplyable', {repost: true, replyDisabled: true})
  const blocked = slice('blocked', {repost: true, embed: blockedQuote})
  const muted = slice('muted', {repost: true})
  const slices = [ordinary, unreplyable, blocked, muted]
  expect(
    filterFeedSlices(slices, {
      hideUnreplyablePosts: true,
      hideQuotesOfBlockedAccounts: true,
      blockedOrMutedAuthors: ['did:plc:muted'],
    }),
  ).toEqual([ordinary])
  expect(
    filterFeedSlices(slices, {
      hideUnreplyablePosts: false,
      hideQuotesOfBlockedAccounts: false,
      blockedOrMutedAuthors: [],
    }),
  ).toEqual(slices)
})

it('hides posts seen before the page was fetched', () => {
  const before = slice('before')
  const after = slice('after')
  const never = slice('never')
  markSeen(before.feedPostUri)
  const fetchedAt = Date.now() + 1
  jest.spyOn(Date, 'now').mockReturnValue(fetchedAt + 1)
  markSeen(after.feedPostUri)
  jest.restoreAllMocks()
  const filters = {
    hideUnreplyablePosts: false,
    hideQuotesOfBlockedAccounts: false,
    blockedOrMutedAuthors: [],
  }
  expect(
    filterFeedSlices([before, after, never], {
      ...filters,
      seenBefore: fetchedAt,
    }),
  ).toEqual([after, never])
  expect(filterFeedSlices([before, after, never], filters)).toEqual([
    before,
    after,
    never,
  ])
})

it('groups reposts without dropping ordinary posts or reordering them', () => {
  const reposts = Array.from({length: 5}, (_, i) =>
    slice(`repost${i}`, {repost: true}),
  )
  const ordinary = Array.from({length: 7}, (_, i) => slice(`post${i}`))
  const grouped = groupReposts([...reposts, ...ordinary])
  expect(grouped.filter(row => !row.isRepostSlice)).toEqual(ordinary)
  expect(grouped.find(row => row.isRepostSlice)).toEqual({
    isRepostSlice: true,
    slices: reposts,
  })
  expect(groupReposts([reposts[0], ordinary[0]])).toEqual([
    reposts[0],
    ordinary[0],
  ])
})

it('collects authors from post, carousel, and video rows for PDS priorities', () => {
  const slices = [slice('a'), slice('b')]
  expect([
    ...collectPdsProfileDidsForFeedRow({
      type: 'sliceItem',
      slice: slices[0],
      indexInSlice: 0,
    }),
  ]).toEqual(['did:plc:a'])
  expect([
    ...collectPdsProfileDidsForFeedRow({type: 'reposts', items: slices}),
  ]).toEqual(['did:plc:a', 'did:plc:b'])
  expect([
    ...collectPdsProfileDidsForFeedRow({
      type: 'videoGridRow',
      items: slices.flatMap(s => s.items),
    }),
  ]).toEqual(['did:plc:a', 'did:plc:b'])
})
