import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {describe, expect, it, jest} from '@jest/globals'

import {app} from '#/lexicons'
import {type FeedPage, type Notification, type UnreadCheck} from '../types'
import {
  fetchPage,
  groupNotifications,
  markUnreadCheckSeen,
  summarizeUnreadCheck,
} from '../util'

jest.mock('#/state/queries/profile', () => ({precacheProfile: jest.fn()}))
jest.mock('#/state/persisted', () => ({
  get: (key: string) =>
    key === 'constellationInstance' ? 'https://constellation.test/' : undefined,
  defaults: {constellationInstance: 'https://default.test/'},
}))

/*
 * Fixture builder. The generated view brands `did`/`uri`/`cid`/`indexedAt`, and
 * these are plain test strings, so the whole literal is asserted once - the
 * grouping logic under test only compares them as strings.
 */
function makeFollowNotification(
  did: DidString,
  starterPackUri?: string,
): Notification {
  return {
    uri: `at://${did}/app.bsky.graph.follow/follow`,
    cid: `cid-${did}`,
    author: {
      did,
      handle: `${did}.test`,
      displayName: did,
      avatar: undefined,
      associated: undefined,
      viewer: {},
      labels: [],
      createdAt: '2026-07-28T12:00:00.000Z',
    },
    reason: 'follow',
    record: {},
    starterPack: starterPackUri
      ? ({uri: starterPackUri} as Notification['starterPack'])
      : undefined,
    isRead: false,
    indexedAt: '2026-07-28T12:00:00.000Z',
  }
}

describe('groupNotifications', () => {
  it('does not group a Starter Pack follow with an organic follow', () => {
    const pack = 'at://did:plc:alice/app.bsky.graph.starterpack/a'

    const grouped = groupNotifications([
      makeFollowNotification('did:plc:a'),
      makeFollowNotification('did:plc:b', pack),
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0].notification.author.did).toBe('did:plc:a')
    expect(grouped[0].notification.starterPack).toBeUndefined()
    expect(grouped[0].additional).toBeUndefined()
    expect(grouped[1].notification.author.did).toBe('did:plc:b')
    expect(grouped[1].notification.starterPack?.uri).toBe(pack)
    expect(grouped[1].additional).toBeUndefined()
  })

  it('groups follows by Starter Pack', () => {
    const packA = 'at://did:plc:alice/app.bsky.graph.starterpack/a'
    const packB = 'at://did:plc:bob/app.bsky.graph.starterpack/b'

    const grouped = groupNotifications([
      makeFollowNotification('did:plc:a', packA),
      makeFollowNotification('did:plc:b', packB),
      makeFollowNotification('did:plc:c', packA),
      makeFollowNotification('did:plc:d'),
      makeFollowNotification('did:plc:e', packB),
      makeFollowNotification('did:plc:f'),
    ])

    expect(
      grouped.map(item => [
        item.notification.author.did,
        ...(item.additional ?? []).map(notification => notification.author.did),
      ]),
    ).toEqual([
      ['did:plc:a', 'did:plc:c'],
      ['did:plc:b', 'did:plc:e'],
      ['did:plc:d', 'did:plc:f'],
    ])
  })
})

function makeNotification({
  reason,
  indexedAt,
  isRead = false,
  following = false,
}: {
  reason: string
  indexedAt: string
  isRead?: boolean
  following?: boolean
}): Notification {
  return {
    uri: `at://did:plc:author/app.bsky.feed.post/${indexedAt}`,
    cid: `cid-${indexedAt}`,
    author: {
      did: 'did:plc:author',
      handle: 'author.test',
      viewer: following
        ? {following: 'at://did:plc:viewer/app.bsky.graph.follow/1'}
        : {},
    },
    reason,
    record: {},
    isRead,
    indexedAt: indexedAt as Notification['indexedAt'],
  }
}

function makePage(...groups: Notification[][]): FeedPage {
  return {
    cursor: undefined,
    seenAt: new Date(0),
    items: groups.map(([notification, ...additional]) => ({
      _reactKey: notification.uri,
      type: 'unknown',
      notification,
      additional: additional.length ? additional : undefined,
    })),
  }
}

const REQUESTED_AT = Date.parse('2026-10-09T12:00:00.000Z')

describe('summarizeUnreadCheck', () => {
  it('finds the newest unread notification for each grouped feed', () => {
    const check = summarizeUnreadCheck(
      makePage(
        [makeNotification({reason: 'like', indexedAt: '2026-10-09T11:50:00Z'})],
        [
          makeNotification({
            reason: 'reply',
            indexedAt: '2026-10-09T11:40:00Z',
            following: true,
          }),
        ],
        [
          makeNotification({
            reason: 'reply',
            indexedAt: '2026-10-09T11:30:00Z',
          }),
        ],
        [
          makeNotification({
            reason: 'follow',
            indexedAt: '2026-10-09T11:20:00Z',
            isRead: true,
          }),
        ],
      ),
      REQUESTED_AT,
    )

    expect(check).toEqual({
      requestedAt: REQUESTED_AT,
      newestUnreadAt: {
        all: Date.parse('2026-10-09T11:50:00Z'),
        'people-i-follow': Date.parse('2026-10-09T11:40:00Z'),
        followers: undefined,
        conversations: Date.parse('2026-10-09T11:40:00Z'),
        activity: undefined,
      },
    } satisfies UnreadCheck)
  })

  it('counts notifications grouped under another', () => {
    const check = summarizeUnreadCheck(
      makePage([
        makeNotification({
          reason: 'follow',
          indexedAt: '2026-10-09T11:00:00Z',
          isRead: true,
        }),
        makeNotification({reason: 'follow', indexedAt: '2026-10-09T11:10:00Z'}),
      ]),
      REQUESTED_AT,
    )

    expect(check.newestUnreadAt.followers).toBe(
      Date.parse('2026-10-09T11:10:00Z'),
    )
  })

  it('finds nothing when everything is read', () => {
    const check = summarizeUnreadCheck(
      makePage([
        makeNotification({
          reason: 'like',
          indexedAt: '2026-10-09T11:00:00Z',
          isRead: true,
        }),
      ]),
      REQUESTED_AT,
    )

    expect(Object.values(check.newestUnreadAt)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})

describe('markUnreadCheckSeen', () => {
  const check: UnreadCheck = {
    requestedAt: REQUESTED_AT,
    newestUnreadAt: {
      all: Date.parse('2026-10-09T11:50:00Z'),
      'people-i-follow': undefined,
      followers: Date.parse('2026-10-09T11:00:00Z'),
      conversations: Date.parse('2026-10-09T11:30:00Z'),
      activity: undefined,
    },
  }

  it('drops what was indexed up to seenAt', () => {
    expect(
      markUnreadCheckSeen(check, Date.parse('2026-10-09T11:30:00Z')),
    ).toEqual({
      requestedAt: REQUESTED_AT,
      newestUnreadAt: {
        all: Date.parse('2026-10-09T11:50:00Z'),
        'people-i-follow': undefined,
        followers: undefined,
        conversations: undefined,
        activity: undefined,
      },
    })
  })

  it('leaves no check as none', () => {
    expect(markUnreadCheckSeen(undefined, REQUESTED_AT)).toBeUndefined()
  })
})

describe('fetchPage bites', () => {
  const VIEWER = 'did:plc:viewer'
  // 2026-10-01T00:00:00.000Z
  const BIT_AT = Date.UTC(2026, 9, 1)
  const rkey = (time: number) => TID.fromTime(time * 1000, 2).toString()

  function makeClient({
    bites,
    profiles,
  }: {
    bites: {did: string; rkey: string}[]
    profiles: string[]
  }) {
    const call = jest.fn(async (method: unknown, params: any) => {
      if (method === app.bsky.notification.listNotifications) {
        return {notifications: [], cursor: undefined, seenAt: undefined}
      }
      if (method === app.bsky.actor.getProfiles) {
        return {
          profiles: params.actors.map((did: string) => ({did, handle: did})),
        }
      }
      if (method === app.bsky.feed.getPosts) return {posts: []}
      throw new Error(`unexpected call ${method}`)
    })
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({linking_records: bites, cursor: null}),
    } as Response)
    return {client: {did: VIEWER, call} as unknown as Client, call, fetchMock}
  }

  const queryClient = {setQueryData: jest.fn()} as any

  async function page(
    client: Client,
    opts: Partial<Parameters<typeof fetchPage>[0]> = {},
  ) {
    return (
      await fetchPage({
        client,
        cursor: undefined,
        limit: 30,
        queryClient,
        moderationOpts: undefined,
        fetchAdditionalData: true,
        reasons: [],
        ...opts,
      })
    ).page
  }

  afterEach(() => jest.restoreAllMocks())

  it('finds bites through Constellation and batches their profiles', async () => {
    const bites = [
      {did: 'did:plc:a', rkey: rkey(BIT_AT)},
      {did: 'did:plc:b', rkey: rkey(BIT_AT + 1000)},
      {did: 'did:plc:a', rkey: rkey(BIT_AT + 2000)},
    ]
    const {client, call, fetchMock} = makeClient({bites, profiles: []})

    const result = await page(client)

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://constellation.test/links')
    expect(url.searchParams.get('target')).toBe(`at://${VIEWER}`)
    expect(url.searchParams.get('collection')).toBe('net.wafrn.feed.bite')

    // One getProfiles for both biters, not one per bite.
    expect(call).toHaveBeenCalledTimes(2)
    // Both biters group into one notification, as genuine bite notifications do.
    expect(result.items).toHaveLength(1)
    const [bite] = result.items
    expect(bite.type).toBe('user-bite')
    expect(
      [
        bite.notification.author.did,
        ...(bite.additional ?? []).map(n => n.author.did),
      ].sort(),
    ).toEqual(['did:plc:a', 'did:plc:b'])
    // Repeated bites from one biter resolve to the newest one.
    expect(bite.notification.indexedAt).toBe(
      new Date(BIT_AT + 1000).toISOString(),
    )
  })

  it('takes a bite notification time from its rkey', async () => {
    const {client} = makeClient({
      bites: [{did: 'did:plc:a', rkey: rkey(BIT_AT)}],
      profiles: [],
    })

    const [item] = (await page(client)).items

    expect(item.notification.indexedAt).toBe(new Date(BIT_AT).toISOString())
  })

  it('leaves bites out where only their count is wanted', async () => {
    const {client, fetchMock} = makeClient({bites: [], profiles: []})

    await page(client, {fetchAdditionalData: false})

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('only puts bites on the first page', async () => {
    const {client, fetchMock} = makeClient({bites: [], profiles: []})

    await page(client, {cursor: 'next'})

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('leaves bites out of the mentions tab', async () => {
    const {client, fetchMock} = makeClient({bites: [], profiles: []})

    await page(client, {reasons: ['mention', 'reply', 'quote']})

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
