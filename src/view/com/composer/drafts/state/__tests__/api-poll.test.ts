import {RichText} from '@bsky/sdk/richtext'

import {
  type ComposerState,
  type PostDraft,
} from '#/view/com/composer/state/composer'
import {type app} from '#/lexicons'
import {
  composerStateToDraft,
  draftToComposerPosts,
  draftViewToSummary,
} from '../api'

const CLIENTS = {} as never

jest.mock('../storage', () => ({
  mediaExists: jest.fn(() => true),
  loadMediaFromLocal: jest.fn(),
  saveMediaToLocal: jest.fn(),
}))
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))
jest.mock('#/lib/media/manip', () => ({getImageDim: jest.fn()}))
jest.mock('#/lib/media/video/util', () => ({mimeToExt: jest.fn(() => 'mp4')}))
jest.mock('#/lib/deviceName', () => ({getDeviceName: () => 'Test device'}))
jest.mock('#/analytics/identifiers', () => ({getDeviceId: () => 'device-1'}))
jest.mock('#/state/session/agent', () => ({createPublicAgent: jest.fn()}))
jest.mock('#/lib/api/resolve', () => ({resolveLink: jest.fn()}))
jest.mock('#/state/queries/threadgate/util', () => ({
  threadgateAllowUISettingToAllowRecordValue: jest.fn(() => undefined),
}))
jest.mock('#/state/gallery', () => ({}))
jest.mock('#/view/com/composer/state/composer', () => ({
  LEGACY_IMAGES_EMBED_MAX: 4,
}))

const POLL_KEY = 'communityBlackskyPoll'

function savedPoll(draft: app.bsky.draft.defs.Draft, index = 0): unknown {
  return (draft.posts[index] as unknown as Record<string, unknown>)[POLL_KEY]
}

function asStored(draft: app.bsky.draft.defs.Draft): app.bsky.draft.defs.Draft {
  return JSON.parse(JSON.stringify(draft)) as app.bsky.draft.defs.Draft
}

function post(embed: Partial<PostDraft['embed']>, text = ''): PostDraft {
  return {
    id: 'p',
    richtext: new RichText({text}),
    shortenedGraphemeLength: text.length,
    labels: [],
    tags: [],
    embed: {quote: undefined, link: undefined, media: undefined, ...embed},
  }
}

function state(posts: PostDraft[]): ComposerState {
  return {
    activePostIndex: 0,
    mutableNeedsFocusActive: false,
    isDirty: true,
    thread: {
      posts,
      postgate: {} as never,
      threadgate: [],
    },
  }
}

function draftPost(extra: Record<string, unknown>): app.bsky.draft.defs.DraftPost {
  return {
    $type: 'app.bsky.draft.defs#draftPost',
    text: 'hello',
    ...extra,
  }
}

function draftOf(posts: app.bsky.draft.defs.DraftPost[]): app.bsky.draft.defs.Draft {
  return {$type: 'app.bsky.draft.defs#draft', posts}
}

describe('draft polls', () => {
  it('serialises the choices and duration as an extra property', async () => {
    const {draft} = await composerStateToDraft(
      CLIENTS,
      state([post({poll: {options: ['one', ''], duration: '3d'}}, 'question')]),
    )
    expect(savedPoll(draft)).toStrictEqual({options: ['one', ''], duration: '3d'})
  })

  it('leaves the record key out, since it belongs to a publish attempt', async () => {
    const {draft} = await composerStateToDraft(
      CLIENTS,
      state([
        post(
          {poll: {options: ['one', 'two'], duration: '1d', rkey: '3mpoll'}},
          'question',
        ),
      ]),
    )
    expect(savedPoll(draft)).toStrictEqual({
      options: ['one', 'two'],
      duration: '1d',
    })
  })

  it('omits the property when there is no poll', async () => {
    const {draft} = await composerStateToDraft(
      CLIENTS,
      state([post({}, 'text only')]),
    )
    expect(POLL_KEY in draft.posts[0]).toBe(false)
  })

  it('restores a poll, including unfinished choices', async () => {
    const {posts} = await draftToComposerPosts(
      draftOf([
        draftPost({[POLL_KEY]: {options: ['', 'a'.repeat(150)], duration: '1h'}}),
      ]),
      new Map(),
    )
    expect(posts[0].embed.poll).toEqual({
      options: ['', 'a'.repeat(150)],
      duration: '1h',
    })
  })

  it('round-trips a poll through save and restore', async () => {
    const {draft} = await composerStateToDraft(
      CLIENTS,
      state([
        post(
          {poll: {options: ['first', 'second'], duration: '1d', rkey: '3mpoll'}},
          'question',
        ),
      ]),
    )
    const {posts} = await draftToComposerPosts(asStored(draft), new Map())
    expect(posts[0].embed.poll).toEqual({
      options: ['first', 'second'],
      duration: '1d',
    })
    expect(posts[0].richtext.text).toBe('question')
  })

  it('restores a poll saved as statements before the switch', async () => {
    const {posts} = await draftToComposerPosts(
      draftOf([
        draftPost({
          [POLL_KEY]: {
            statements: ['first', 'second', 'third'],
            assembly: {rkey: '3k', createdAt: '2026-09-27T12:00:00.000Z'},
          },
        }),
      ]),
      new Map(),
    )
    expect(posts[0].embed.poll).toEqual({
      options: ['first', 'second', 'third'],
      duration: '1d',
    })
  })

  it('ignores a malformed poll property', async () => {
    const {posts} = await draftToComposerPosts(
      draftOf([
        draftPost({[POLL_KEY]: {options: null}}),
        draftPost({[POLL_KEY]: {options: [42, 'b']}}),
        draftPost({[POLL_KEY]: 'nope'}),
        draftPost({[POLL_KEY]: {options: ['a', 'b', 'c', 'd', 'e']}}),
      ]),
      new Map(),
    )
    expect(posts.map(p => p.embed.poll)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it('drops the poll when the restored post also has a gif', async () => {
    const {posts} = await draftToComposerPosts(
      draftOf([
        draftPost({
          [POLL_KEY]: {options: ['a', 'b']},
          embedExternals: [
            {uri: 'https://media.tenor.com/abc/clip.gif?hh=100&ww=200&alt=hi'},
          ],
        }),
      ]),
      new Map(),
    )
    expect(posts[0].embed.media?.type).toBe('gif')
    expect(posts[0].embed.poll).toBeUndefined()
  })

  it('drops the poll when the restored post also has a quote', async () => {
    const {posts} = await draftToComposerPosts(
      draftOf([
        draftPost({
          [POLL_KEY]: {options: ['a', 'b']},
          embedRecords: [
            {
              record: {
                uri: 'at://did:plc:abc/app.bsky.feed.post/3kabc',
                cid: 'bafyreicid',
              },
            },
          ],
        }),
      ]),
      new Map(),
    )
    expect(posts[0].embed.quote).toBeDefined()
    expect(posts[0].embed.poll).toBeUndefined()
  })

  it('drops the poll when the restored post also has a link', async () => {
    const {posts} = await draftToComposerPosts(
      draftOf([
        draftPost({
          [POLL_KEY]: {options: ['a', 'b']},
          embedExternals: [{uri: 'https://example.com/article'}],
        }),
      ]),
      new Map(),
    )
    expect(posts[0].embed.link).toBeDefined()
    expect(posts[0].embed.poll).toBeUndefined()
  })

  it('drops the poll when a video is pending restoration', async () => {
    const path = 'video:video/mp4:abc.mp4'
    const {posts, restoredVideos} = await draftToComposerPosts(
      draftOf([
        draftPost({
          [POLL_KEY]: {options: ['a', 'b']},
          embedVideos: [{localRef: {path}}],
        }),
      ]),
      new Map([[path, 'file://abc.mp4']]),
    )
    expect(restoredVideos.has(0)).toBe(true)
    expect(posts[0].embed.media).toBeUndefined()
    expect(posts[0].embed.poll).toBeUndefined()
  })

  it('includes the poll in the draft list summary', () => {
    const summary = draftViewToSummary({
      view: {
        id: 'draft-1',
        createdAt: '2026-09-27T00:00:00.000Z',
        updatedAt: '2026-09-27T00:00:00.000Z',
        draft: draftOf([
          draftPost({[POLL_KEY]: {options: ['shown', ''], duration: '6h'}}),
          draftPost({}),
        ]),
      },
      analytics: {logger: {warn: jest.fn()}} as never,
    })
    expect(summary.posts[0].poll).toEqual({
      options: ['shown', ''],
      duration: '6h',
    })
    expect(summary.posts[1].poll).toBeUndefined()
  })
})
