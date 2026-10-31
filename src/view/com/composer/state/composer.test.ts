import {composerReducer, createComposerState} from './composer'

jest.mock('#/state/gallery', () => ({
  createInitialImages: jest.fn(),
}))
jest.mock('#/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}))
jest.mock('#/state/queries/postgate/util', () => ({
  createPostgateRecord: jest.fn(() => ({})),
}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: jest.fn(() => []),
}))

function createState() {
  return createComposerState({
    initText: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
}

describe('composerReducer', () => {
  describe('retarget', () => {
    it.each(['reply', 'quote'])(
      'switches to a %s while preserving thread contents and media',
      kind => {
        const initial = createComposerState({
          initText: 'keep my words',
          initMention: undefined,
          initImageUris: undefined,
          initQuoteUri: 'at://did:plc:alice/app.bsky.feed.post/original',
          initInteractionSettings: undefined,
        })
        initial.thread.posts[0].embed.media = {type: 'images', images: []}
        initial.draftId = 'saved-draft'
        initial.loadedMediaMap = new Map([['photo', 'cached-photo']])
        const state = composerReducer(initial, {type: 'add_post'})
        const first = state.thread.posts[0]
        const next = composerReducer(state, {
          type: 'retarget',
          quoteUri:
            kind === 'quote'
              ? 'at://did:plc:bob/app.bsky.feed.post/target'
              : undefined,
        })

        expect(next.thread.posts[0].richtext).toBe(first.richtext)
        expect(next.thread.posts[0].embed.media).toBe(first.embed.media)
        expect(next.thread.posts[0].embed.link).toBe(first.embed.link)
        if (kind === 'quote') {
          expect(next.thread.posts[0].embed.quote?.uri).toContain(
            '/post/target',
          )
        } else {
          expect(next.thread.posts[0].embed.quote).toBeUndefined()
        }
        expect(next.thread.posts[1]).toBe(state.thread.posts[1])
        expect(next.draftId).toBe('saved-draft')
        expect(next.loadedMediaMap).toBe(state.loadedMediaMap)
        expect(next.activePostIndex).toBe(0)
        expect(next.isDirty).toBe(true)
        expect(next.mutableNeedsFocusActive).toBe(true)
      },
    )
  })
  describe('add_post', () => {
    it('selects the appended post and requests focus', () => {
      const state = createState()

      const nextState = composerReducer(state, {type: 'add_post'})

      expect(nextState.thread.posts).toHaveLength(2)
      expect(nextState.activePostIndex).toBe(1)
      expect(nextState.mutableNeedsFocusActive).toBe(true)
    })

    it('selects a post inserted in the middle of a thread', () => {
      let state = createState()
      state = composerReducer(state, {type: 'add_post'})
      state = composerReducer(state, {type: 'add_post'})

      const lastPostId = state.thread.posts[2].id
      state = composerReducer(state, {
        type: 'focus_post',
        postId: state.thread.posts[0].id,
      })

      const nextState = composerReducer(state, {type: 'add_post'})

      expect(nextState.thread.posts).toHaveLength(4)
      expect(nextState.activePostIndex).toBe(1)
      expect(nextState.thread.posts[2].id).not.toBe(lastPostId)
      expect(nextState.thread.posts[3].id).toBe(lastPostId)
      expect(nextState.mutableNeedsFocusActive).toBe(true)
    })
  })
})

it('focuses adjacent posts without moving or dirtying the thread', () => {
  let state = composerReducer(createState(), {type: 'add_post'})
  state = {...state, isDirty: false}
  const focused = composerReducer(state, {
    type: 'focus_adjacent_post',
    direction: 'up',
  })
  expect(focused.activePostIndex).toBe(0)
  expect(focused.thread).toBe(state.thread)
  expect(focused.isDirty).toBe(false)
  expect(focused.mutableNeedsFocusActive).toBe(true)
  expect(
    composerReducer(focused, {type: 'focus_adjacent_post', direction: 'up'}),
  ).toBe(focused)
})

it('restores video ownership, alt text and caption tracks when redrafting', () => {
  const captions = [
    {lang: 'en', file: {name: 'en.vtt'} as File},
    {lang: 'fr', file: {name: 'fr.vtt'} as File},
  ]
  const state = createComposerState({
    initText: 'Redrafted post',
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
    initVideoUri: {
      uri: 'https://video.test/playlist.m3u8',
      width: 1920,
      height: 1080,
      blobRef: {cid: 'original', mimeType: 'video/mp4'} as never,
      ownerDid: 'did:plc:source',
      altText: 'Video description',
      captions,
      originalCaptions: [
        {lang: 'de', file: {cid: 'caption', mimeType: 'text/vtt'}},
      ],
    },
  })
  const media = state.thread.posts[0].embed.media
  expect(media?.type).toBe('video')
  if (media?.type !== 'video') throw new Error('Missing video')
  expect(media.video.status).toBe('done')
  expect(media.video.captions).toEqual(captions)
  expect(media.video.altText).toBe('Video description')
  if (media.video.status !== 'done') throw new Error('Video not ready')
  expect(media.video.pendingPublish.ownerDid).toBe('did:plc:source')
  expect(
    'originalCaptions' in media.video && media.video.originalCaptions?.[0].lang,
  ).toBe('de')
})
