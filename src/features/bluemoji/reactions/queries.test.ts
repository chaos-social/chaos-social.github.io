import {Client} from '@atproto/lex'

import {
  fetchReactionCounts,
  mergeViewerReactions,
  parseGroup,
} from '#/features/bluemoji/reactions/queries'
import {getReactionEmojiImage} from '#/features/bluemoji/reactions/util'

jest.unmock('multiformats/cid')

jest.mock('#/state/queries', () => ({
  STALE: {MINUTES: {ONE: 60000, FIVE: 300000}},
}))
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

/*
 * Captured from moji.blue: the AppView returns `formats` as blob objects, not
 * the CID strings the inline-facet lexicon declares. Validating strictly drops
 * every group, which is what made reactions invisible.
 */
describe('parsing AppView groups', () => {
  const real = {
    $type: 'blue.moji.feed.defs#reactionGroup',
    emoji: {
      $type: 'blue.moji.feed.reaction#emojiRef',
      uri: 'at://did:plc:kmzpsik7s5y5fwu7nnkngfx4/blue.moji.collection.item/party_heart',
      cid: 'bafyreia3ayj46qnsgiqvothtc7y5bgzoyi4crgjsp5324vls5tm5wdmtmi',
      name: ':party_heart:',
      alt: 'party heart',
      adultOnly: false,
      formats: {
        $type: 'blue.moji.collection.item#formats_v1',
        png_128: {
          ref: {
            $link:
              'bafkreif3gkhyfbgywf4woydjd7zn4i53lbvv573rdjim3tuv2mjibblz3q',
          },
          size: 3153,
          $type: 'blob',
          mimeType: 'image/png',
        },
      },
    },
    count: 2,
  }

  it('keeps blob-shaped formats instead of discarding the group', () => {
    const [group] = parseGroup(real)
    expect(group?.count).toBe(2)
    expect(group ? getReactionEmojiImage(group.emoji) : undefined).toBe(
      'https://moji.blue/img/did%3Aplc%3Akmzpsik7s5y5fwu7nnkngfx4/bafkreif3gkhyfbgywf4woydjd7zn4i53lbvv573rdjim3tuv2mjibblz3q',
    )
  })

  it('drops groups with no usable emoji', () => {
    expect(parseGroup({...real, emoji: undefined})).toEqual([])
    expect(parseGroup({...real, count: 0})).toEqual([])
    expect(
      parseGroup({
        ...real,
        emoji: {...real.emoji, uri: 'https://example.com/x'},
      }),
    ).toEqual([])
  })
})

describe('merging the viewer own reactions', () => {
  const emoji = {
    $type: 'blue.moji.feed.reaction#emojiRef',
    uri: 'at://did:plc:owner/blue.moji.collection.item/blobcat',
    name: ':blobcat:',
  }

  it('adds a viewer reaction the AppView has not indexed yet', () => {
    const groups = mergeViewerReactions(
      [],
      [{uri: 'optimistic', subject: 'at://post', emoji: emoji as never}],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].emoji.uri).toBe(emoji.uri)
    expect(groups[0].count).toBe(1)
  })

  it('does not double count one the AppView already reports', () => {
    const groups = mergeViewerReactions(
      [{emoji: emoji as never, count: 2}],
      [{uri: 'optimistic', subject: 'at://post', emoji: emoji as never}],
      true,
    )
    expect(groups).toEqual([{emoji, count: 2}])
  })

  it('hides a reaction the viewer removed while the AppView still counts it', () => {
    /*
     * moji.blue's index does not reliably apply reaction deletes, so a count of
     * 1 can outlive the record. Once the viewer's own list is known and does
     * not contain it, that one reaction was theirs: "gray, still 1" is wrong.
     */
    const groups = mergeViewerReactions(
      [{emoji: emoji as never, count: 1}],
      [],
      true,
    )
    expect(groups).toEqual([])
  })

  it('keeps a count of one that belongs to someone else', () => {
    // Nothing local is subtracted while the viewer has the reaction too.
    const groups = mergeViewerReactions(
      [{emoji: emoji as never, count: 1}],
      [
        {
          uri: 'at://me/blue.moji.feed.reaction/1',
          subject: 'at://post',
          emoji: emoji as never,
        },
      ],
      true,
    )
    expect(groups).toHaveLength(1)
  })

  it('keeps counts above one: they include other reactors', () => {
    const groups = mergeViewerReactions(
      [{emoji: emoji as never, count: 3}],
      [],
      true,
    )
    expect(groups).toEqual([{emoji, count: 3}])
  })

  it('subtracts nothing until the viewer list is known', () => {
    // A pending or failed own-reactions read must not hide other people's.
    const groups = mergeViewerReactions(
      [{emoji: emoji as never, count: 1}],
      undefined,
      false,
    )
    expect(groups).toHaveLength(1)
  })
})
