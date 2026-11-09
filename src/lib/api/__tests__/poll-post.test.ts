import {type Client} from '@atproto/lex'
import {type QueryClient} from '@tanstack/react-query'

import {fetchResolveLinkQuery} from '#/state/queries/resolve-link'
import {TOKIMEKI_POLL_COLLECTION} from '#/features/tokimeki/types'
import {app, com} from '#/lexicons'
import * as cid from '../computeCid'
import {post, resolveEmbed} from '../index'

jest.mock('#/state/gallery', () => ({compressImage: jest.fn()}))
jest.mock('#/state/queries/resolve-link', () => ({
  fetchResolveGifQuery: jest.fn(),
  fetchResolveLinkQuery: jest.fn(),
  RQKEY_LINK: (url: string) => ['resolve-link', url],
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

const queryClient = {invalidateQueries: jest.fn()} as unknown as QueryClient
const originalFetch = global.fetch
const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()
const thumbnail = new Blob(['poll image'], {type: 'image/png'})
const thumb = {
  $type: 'blob',
  ref: {$link: 'bafkreithumb'},
  mimeType: 'image/png',
  size: 10,
}

beforeEach(() => {
  global.fetch = mockFetch
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(thumbnail),
  } as Response)
})

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

type Write = {
  collection: string
  rkey: string
  value: {
    text: string
    createdAt: string
    embed?: {$type: string; external: unknown}
  }
}

function setup() {
  const events: string[] = []
  jest
    .mocked(fetchResolveLinkQuery)
    .mockImplementation((_query, _clients, uri) => {
      events.push('resolveLink')
      return Promise.resolve({
        type: 'external',
        uri,
        title: 'Poll from TOKIMEKI',
        description: 'Yes / No',
        thumb: {
          source: {path: 'data:image/png;base64,cG5n', mime: 'image/png'},
        },
      } as never)
    })
  const uploadBlob = jest.fn(() => {
    events.push('uploadBlob')
    return Promise.resolve({body: {blob: thumb}})
  })
  const applyWrites = jest.fn((_input: unknown) => {
    events.push('applyWrites')
    return Promise.resolve({})
  })
  const putRecord = jest.fn((record: Record<string, unknown>, rkey: string) => {
    events.push('putRecord')
    return Promise.resolve({
      body: {
        uri: `at://did:plc:alice/${String(record.$type)}/${rkey}`,
        cid: 'cid-poll',
      },
    })
  })
  const deleteRecord = jest.fn(() => {
    events.push('deleteRecord')
    return Promise.resolve({})
  })
  const pdsClient = {
    assertDid: 'did:plc:alice',
    call: jest.fn((def: {$nsid?: string}, input: unknown) => {
      if (def?.$nsid === com.atproto.repo.applyWrites.$nsid) {
        return applyWrites(input)
      }
      throw new Error('unexpected pds call')
    }),
    putRecord,
    deleteRecord,
    uploadBlob,
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
  return {
    pdsClient,
    appviewClient,
    applyWrites,
    putRecord,
    deleteRecord,
    uploadBlob,
    events,
  }
}

function draft(
  embed: Record<string, unknown>,
  text = 'Which one?',
  id = 'post-1',
) {
  return {
    id,
    richtext: {text, facets: []},
    shortenedGraphemeLength: text.length,
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

function writesOf(applyWrites: jest.Mock): Write[] {
  const [{writes}] = applyWrites.mock.calls[0] as unknown as [{writes: Write[]}]
  return writes
}

describe('publishing a post with a poll', () => {
  it('writes the poll record and links it from the post', async () => {
    const ctx = setup()
    const onPollRkey = jest.fn()

    const result = await post(queryClient, {
      ...clientsOf(ctx),
      thread: thread([
        draft({poll: {options: ['  Yes ', 'No'], duration: '1d'}}),
      ]),
      onPollRkey,
    })

    expect(onPollRkey).toHaveBeenCalledTimes(1)
    const [postId, rkey] = onPollRkey.mock.calls[0]
    expect(postId).toBe('post-1')

    expect(ctx.putRecord).toHaveBeenCalledTimes(2)
    const [record, writtenRkey] = ctx.putRecord.mock.calls[1]
    expect(writtenRkey).toBe(rkey)
    expect(record.$type).toBe(TOKIMEKI_POLL_COLLECTION)
    expect(record.options).toEqual(['Yes', 'No'])
    expect(record.subject).toMatchObject({cid: 'bafyreifake'})

    const writes = writesOf(ctx.applyWrites)
    expect(writes[0].value.embed).toStrictEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: `https://poll.tokimeki.tech/p/did:plc:alice/${rkey}`,
        title: 'Poll from TOKIMEKI',
        description: 'Yes / No',
        thumb,
        associatedRefs: undefined,
      },
    })
    expect(result.poll).toEqual({rkey, optionCount: 2})
    expect(ctx.uploadBlob).toHaveBeenCalledWith(thumbnail, {
      encoding: 'image/png',
    })
    expect(fetchResolveLinkQuery).toHaveBeenCalledWith(
      queryClient,
      {appviewClient: ctx.appviewClient, chatClient: ctx.appviewClient},
      `https://poll.tokimeki.tech/p/did:plc:alice/${rkey}`,
    )
    expect(ctx.events).toEqual([
      'putRecord',
      'resolveLink',
      'uploadBlob',
      'putRecord',
      'applyWrites',
    ])
  })

  it('does not publish a text-only card when thumbnail upload fails', async () => {
    const ctx = setup()
    ctx.uploadBlob.mockRejectedValue(new Error('Upload refused'))
    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({poll: {options: ['Yes', 'No'], duration: '1d'}}),
        ]),
      }),
    ).rejects.toThrow('Upload refused')
    expect(ctx.deleteRecord).toHaveBeenCalled()
    expect(ctx.applyWrites).not.toHaveBeenCalled()
  })

  it('cleans up an unindexed poll when its preview has no thumbnail', async () => {
    const ctx = setup()
    jest.mocked(fetchResolveLinkQuery).mockResolvedValue({
      type: 'external',
      uri: 'https://poll.tokimeki.tech/p/did:plc:alice/3mpoll',
      title: '',
      description: '',
      thumb: undefined,
    })
    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({poll: {options: ['Yes', 'No'], duration: '1d'}}),
        ]),
      }),
    ).rejects.toThrow('Could not load the poll link preview. Please try again.')
    expect(ctx.uploadBlob).not.toHaveBeenCalled()
    expect(ctx.deleteRecord).toHaveBeenCalled()
    expect(ctx.applyWrites).not.toHaveBeenCalled()
  })

  it('reuses the record key on a retry', async () => {
    const ctx = setup()
    const onPollRkey = jest.fn()

    await post(queryClient, {
      ...clientsOf(ctx),
      thread: thread([
        draft({poll: {options: ['Yes', 'No'], duration: '1d', rkey: '3mpoll'}}),
      ]),
      onPollRkey,
    })

    expect(onPollRkey).not.toHaveBeenCalled()
    expect(ctx.putRecord.mock.calls[0][1]).toBe('3mpoll')
  })

  it('finalizes the poll and following replies with the post CID including its preview', async () => {
    const ctx = setup()
    jest
      .spyOn(cid, 'computeCid')
      .mockImplementation(record =>
        Promise.resolve(
          record.embed ? 'cid-with-preview' : 'cid-without-preview',
        ),
      )
    await post(queryClient, {
      ...clientsOf(ctx),
      thread: thread([
        draft({poll: {options: ['Yes', 'No'], duration: '1d'}}),
        draft({}, 'Reply', 'post-2'),
      ]),
    })
    expect(ctx.putRecord.mock.calls[0][0].subject).toMatchObject({
      cid: 'cid-without-preview',
    })
    expect(ctx.putRecord.mock.calls[1][0].subject).toMatchObject({
      cid: 'cid-with-preview',
    })
    expect(writesOf(ctx.applyWrites)[1].value).toMatchObject({
      reply: {
        parent: {cid: 'cid-with-preview'},
        root: {cid: 'cid-with-preview'},
      },
    })
    expect(ctx.putRecord.mock.calls[1][0].endsAt).toBe(
      ctx.putRecord.mock.calls[0][0].endsAt,
    )
  })

  it('closes the poll at the chosen duration', async () => {
    const ctx = setup()
    jest.useFakeTimers({now: new Date('2026-11-07T12:00:00.000Z')})
    try {
      await post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({poll: {options: ['Yes', 'No'], duration: '3d'}}),
        ]),
      })
    } finally {
      jest.useRealTimers()
    }

    // The poll closes three days after the post's own timestamp.
    const createdAt = new Date(
      writesOf(ctx.applyWrites)[0].value.createdAt,
    ).getTime()
    expect(
      new Date(ctx.putRecord.mock.calls[0][0].endsAt as string).getTime(),
    ).toBe(createdAt + 3 * 24 * 60 * 60e3)
  })

  it('removes the poll when the post write is refused', async () => {
    const ctx = setup()
    ctx.applyWrites.mockImplementationOnce(() =>
      Promise.reject(new Error('InvalidRequest')),
    )

    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({
            poll: {options: ['Yes', 'No'], duration: '1d', rkey: '3mpoll'},
          }),
        ]),
      }),
    ).rejects.toThrow('InvalidRequest')

    expect(ctx.deleteRecord).toHaveBeenCalledWith(
      TOKIMEKI_POLL_COLLECTION,
      '3mpoll',
      expect.anything(),
    )
  })

  it('leaves a post without a poll alone', async () => {
    const ctx = setup()

    const result = await post(queryClient, {
      ...clientsOf(ctx),
      thread: thread([draft({}, 'hello')]),
    })

    expect(ctx.putRecord).not.toHaveBeenCalled()
    expect(writesOf(ctx.applyWrites)[0].value.embed).toBeUndefined()
    expect(result.poll).toBeUndefined()
  })

  it('refuses a poll that shares the post with media', async () => {
    const ctx = setup()

    await expect(
      post(queryClient, {
        ...clientsOf(ctx),
        thread: thread([
          draft({
            poll: {options: ['Yes', 'No'], duration: '1d'},
            media: {type: 'gif', gif: {}, alt: ''},
          }),
        ]),
      }),
    ).rejects.toThrow(
      'A poll cannot be combined with media, a link card or a quote.',
    )
    expect(ctx.putRecord).not.toHaveBeenCalled()
    expect(ctx.applyWrites).not.toHaveBeenCalled()
  })
})

describe('building the embed of a poll', () => {
  it('needs the record key', async () => {
    const ctx = setup()

    await expect(
      resolveEmbed(
        ctx.appviewClient,
        ctx.appviewClient,
        ctx.pdsClient,
        queryClient,
        draft({
          quote: undefined,
          media: undefined,
          link: undefined,
          poll: {options: ['Yes', 'No'], duration: '1d'},
        }) as never,
        undefined,
      ),
    ).rejects.toThrow('A poll cannot be posted without its record key')
  })
})
