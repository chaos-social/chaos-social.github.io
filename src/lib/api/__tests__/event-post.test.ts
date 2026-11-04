import {type Client} from '@atproto/lex'
import {type QueryClient} from '@tanstack/react-query'

import {app, com} from '#/lexicons'
import {type EventDraft} from '../event'
import {post, resolveEmbed} from '../index'

jest.mock('#/state/gallery', () => ({compressImage: jest.fn()}))
jest.mock('#/state/queries/resolve-link', () => ({
  fetchResolveGifQuery: jest.fn(),
  fetchResolveLinkQuery: jest.fn(),
}))
jest.mock('#/state/queries/threadgate', () => ({
  createThreadgateRecord: jest.fn(),
  threadgateAllowUISettingToAllowRecordValue: jest.fn(() => []),
}))
jest.mock(
  '@ipld/dag-cbor',
  () => ({encode: (v: unknown) => Buffer.from(JSON.stringify(v))}),
  {virtual: true},
)
jest.mock('multiformats/cid', () => ({
  CID: {createV1: () => ({toString: () => 'bafyreifake'})},
}))
jest.mock('../resolve', () => ({imageToThumb: jest.fn()}))

const EVENT_URI = 'at://did:plc:alice/community.lexicon.calendar.event/3kevent'
const queryClient = {invalidateQueries: jest.fn()} as unknown as QueryClient

const EVENT: EventDraft = {
  name: 'Garden party',
  date: '2026-10-01',
  time: '18:00',
  timezone: 'Europe/Berlin',
  mode: 'inperson',
  place: 'The park',
}

function setup() {
  const calls: {
    create: Record<string, unknown>[]
    put: unknown[]
    delete: string[]
  } = {
    create: [],
    put: [],
    delete: [],
  }
  const applyWrites = jest.fn(() => Promise.resolve({}))
  const createRecord = jest.fn((record: Record<string, unknown>) => {
    calls.create.push(record)
    if (record.$type === 'community.lexicon.calendar.event') {
      return Promise.resolve({body: {uri: EVENT_URI, cid: 'cid-event'}})
    }
    return Promise.resolve({body: {uri: 'at://rsvp', cid: 'cid-rsvp'}})
  })
  const putRecord = jest.fn((record: Record<string, unknown>, rkey: string) => {
    calls.put.push({record, rkey})
    return Promise.resolve({body: {uri: EVENT_URI, cid: 'cid-final'}})
  })
  const deleteRecord = jest.fn((_collection: string, rkey: string) => {
    calls.delete.push(rkey)
    return Promise.resolve({})
  })
  const pdsClient = {
    assertDid: 'did:plc:alice',
    call: jest.fn((def: {$nsid?: string}, _input: unknown) => {
      if (def?.$nsid === com.atproto.repo.applyWrites.$nsid) {
        return applyWrites()
      }
      throw new Error('unexpected pds call')
    }),
    createRecord,
    putRecord,
    deleteRecord,
  } as unknown as Client
  const appviewClient = {
    assertDid: 'did:plc:alice',
    call: jest.fn((def: {$nsid?: string}) => {
      if (def?.$nsid === app.bsky.feed.getPosts.$nsid) {
        return Promise.resolve({posts: []})
      }
      throw new Error('unexpected appview call')
    }),
  } as unknown as Client
  return {pdsClient, appviewClient, applyWrites, calls, createRecord, putRecord}
}

function draft(embed: Record<string, unknown>) {
  return {
    id: 'post-1',
    richtext: {text: '', facets: []},
    shortenedGraphemeLength: 0,
    labels: [],
    tags: [],
    embed,
  }
}

function thread(posts: unknown[]) {
  return {posts, postgate: {}, threadgate: []} as never
}

function clientsOf(ctx: ReturnType<typeof setup>) {
  return {
    appviewClient: ctx.appviewClient,
    chatClient: ctx.appviewClient,
    pdsClient: ctx.pdsClient,
  }
}

describe('creating an event with a post', () => {
  it('writes the event, the post card, then attaches and RSVPs with the final cid', async () => {
    const ctx = setup()
    const onEvent = jest.fn()

    const result = await post(queryClient, {
      ...clientsOf(ctx),
      thread: thread([draft({event: {...EVENT}})]),
      onEvent,
    })

    // Event created before the post, then attached with the post ref.
    expect(ctx.calls.create[0]).toMatchObject({
      $type: 'community.lexicon.calendar.event',
      name: 'Garden party',
    })
    expect(ctx.applyWrites).toHaveBeenCalled()
    expect(onEvent).toHaveBeenCalledWith('post-1', {
      uri: EVENT_URI,
      cid: 'cid-event',
    })
    expect(ctx.calls.put).toHaveLength(1)
    expect(ctx.calls.put[0]).toMatchObject({rkey: '3kevent'})

    // RSVP written against the finalized cid, not the create-time one.
    const rsvp = ctx.calls.create.find(
      (r: Record<string, unknown>) =>
        r.$type === 'community.lexicon.calendar.rsvp',
    )
    expect(rsvp?.subject).toEqual({uri: EVENT_URI, cid: 'cid-final'})
    expect(result.event).toEqual({uri: EVENT_URI, cid: 'cid-final'})
  })

  it('reuses a saved event instead of creating a second one', async () => {
    const ctx = setup()
    await post(queryClient, {
      ...clientsOf(ctx),
      thread: thread([
        draft({event: {...EVENT, record: {uri: EVENT_URI, cid: 'saved'}}}),
      ]),
    })
    const eventCreates = ctx.calls.create.filter(
      (r: Record<string, unknown>) =>
        r.$type === 'community.lexicon.calendar.event',
    )
    expect(eventCreates).toHaveLength(0)
    // Reuse overwrites in place, then finalize adds the post ref.
    expect(ctx.calls.put).toHaveLength(2)
  })

  it('deletes the event only when this attempt created it and the post fails', async () => {
    const ctx = setup()
    ctx.applyWrites.mockImplementationOnce(() =>
      Promise.reject(new Error('nope')),
    )

    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([draft({event: {...EVENT}})]),
      }),
    ).rejects.toThrow()

    expect(ctx.calls.delete).toEqual(['3kevent'])
  })

  it('leaves the event in place when the failure may have committed', async () => {
    const ctx = setup()
    ctx.applyWrites.mockImplementationOnce(() =>
      Promise.reject(new Error('Network request failed')),
    )

    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([draft({event: {...EVENT}})]),
      }),
    ).rejects.toThrow()

    expect(ctx.calls.delete).toEqual([])
  })

  it('leaves a reused event in place when the post fails', async () => {
    const ctx = setup()
    ctx.applyWrites.mockImplementationOnce(() =>
      Promise.reject(new Error('nope')),
    )

    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({event: {...EVENT, record: {uri: EVENT_URI, cid: 'saved'}}}),
        ]),
      }),
    ).rejects.toThrow()

    expect(ctx.calls.delete).toEqual([])
  })

  it('refuses an event combined with another attachment', async () => {
    const ctx = setup()
    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({event: {...EVENT}, media: {type: 'gif', gif: {}, alt: ''}}),
        ]),
      }),
    ).rejects.toThrow(/cannot be combined/)
  })
})

describe('the event card', () => {
  it('links to the witchsky event URL and carries the description', async () => {
    const ctx = setup()
    const embed = await resolveEmbed(
      ctx.appviewClient,
      ctx.appviewClient,
      ctx.pdsClient,
      queryClient,
      draft({
        event: {
          ...EVENT,
          description: 'Bring snacks',
          record: {uri: EVENT_URI, cid: 'c'},
        },
      }) as never,
      undefined,
    )
    expect(embed).toMatchObject({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://witchsky.app/profile/did:plc:alice/event/3kevent',
        title: 'Garden party',
      },
    })
    expect(
      (embed as {external: {description: string}}).external.description,
    ).toContain('Bring snacks')
  })
})
