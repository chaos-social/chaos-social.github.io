import {type ComposerImage} from '#/state/gallery'
import {
  type ComposerAction,
  composerReducer,
  type ComposerState,
  createComposerState,
  isEventPostable,
  isPollPostable,
  postHasAttachment,
  postHasContent,
} from '../composer'

jest.mock('#/state/gallery', () => ({createInitialImages: jest.fn()}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: jest.fn(() => []),
}))
jest.mock('../video', () => ({
  createVideoState: jest.fn(() => ({abortController: new AbortController()})),
  videoReducer: jest.fn(),
}))

const image = {
  source: {
    id: 'img-1',
    path: 'file://a',
    mime: 'image/jpeg',
    width: 1,
    height: 1,
  },
} as unknown as ComposerImage

type PostAction = Extract<ComposerAction, {type: 'update_post'}>['postAction']

function initialState(): ComposerState {
  return createComposerState({
    initText: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
}

function apply(state: ComposerState, actions: PostAction[]): ComposerState {
  for (const postAction of actions) {
    state = composerReducer(state, {
      type: 'update_post',
      postId: state.thread.posts[0].id,
      postAction,
    })
  }
  return state
}

function draftAfter(actions: PostAction[]) {
  return apply(initialState(), actions).thread.posts[0]
}

function updatePost(
  state: ComposerState,
  index: number,
  postAction: PostAction,
): ComposerState {
  return composerReducer(state, {
    type: 'update_post',
    postId: state.thread.posts[index].id,
    postAction,
  })
}

describe('event draft', () => {
  it('adds a draft seeded with a name-less default', () => {
    const event = draftAfter([{type: 'embed_add_event'}]).embed.event
    expect(event).toBeDefined()
    expect(event?.name).toBe('')
    expect(event?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(event?.time).toMatch(/^\d{2}:\d{2}$/)
    expect(event?.mode).toBe('inperson')
    expect(typeof event?.timezone).toBe('string')
  })

  it('patches and removes the draft', () => {
    const event = draftAfter([
      {type: 'embed_add_event'},
      {type: 'embed_update_event', patch: {name: 'Meetup', mode: 'virtual'}},
    ]).embed.event
    expect(event?.name).toBe('Meetup')
    expect(event?.mode).toBe('virtual')

    const removed = draftAfter([
      {type: 'embed_add_event'},
      {type: 'embed_remove_event'},
    ])
    expect(removed.embed.event).toBe(undefined)
  })

  it('writes the record back for retries', () => {
    const event = draftAfter([
      {type: 'embed_add_event'},
      {
        type: 'embed_set_event_record',
        record: {uri: 'at://did:plc:x/community.lexicon.calendar.event/1', cid: 'c'},
      },
    ]).embed.event
    expect(event?.record).toEqual({
      uri: 'at://did:plc:x/community.lexicon.calendar.event/1',
      cid: 'c',
    })
  })

  it('does nothing when updating a draft that is not there', () => {
    const state = draftAfter([{type: 'embed_update_event', patch: {name: 'x'}}])
    expect(state.embed.event).toBe(undefined)
  })
})

describe('event exclusivity', () => {
  it('cannot be added on top of media', () => {
    const base = initialState()
    const state = composerReducer(base, {
      type: 'update_post',
      postId: base.thread.posts[0].id,
      postAction: {type: 'embed_add_images', images: [image]},
    })
    const withEvent = apply(state, [{type: 'embed_add_event'}])
    expect(withEvent.thread.posts[0].embed.event).toBe(undefined)
  })

  it('blocks media, link and gif from being added afterwards', () => {
    const state = apply(initialState(), [{type: 'embed_add_event'}])
    const postId = state.thread.posts[0].id
    const withImages = composerReducer(state, {
      type: 'update_post',
      postId,
      postAction: {type: 'embed_add_images', images: [image]},
    })
    expect(withImages.thread.posts[0].embed.media).toBe(undefined)

    const withUri = updatePost(state, 0, {
      type: 'embed_add_uri',
      uri: 'https://example.com',
    })
    expect(withUri.thread.posts[0].embed.link).toBe(undefined)
  })

  it('cannot be combined with a poll', () => {
    const pollState = apply(initialState(), [{type: 'embed_add_poll'}])
    const withEvent = apply(pollState, [{type: 'embed_add_event'}])
    expect(withEvent.thread.posts[0].embed.event).toBe(undefined)
    expect(withEvent.thread.posts[0].embed.poll).toBeDefined()

    const eventState = apply(initialState(), [{type: 'embed_add_event'}])
    const withPoll = apply(eventState, [{type: 'embed_add_poll'}])
    expect(withPoll.thread.posts[0].embed.poll).toBe(undefined)
  })

  it('allows only one event per thread', () => {
    let state = composerReducer(initialState(), {type: 'add_post'})
    state = updatePost(state, 0, {type: 'embed_add_event'})
    state = updatePost(state, 1, {type: 'embed_add_event'})
    expect(state.thread.posts[0].embed.event).toBeDefined()
    expect(state.thread.posts[1].embed.event).toBe(undefined)
  })
})

describe('event publishability', () => {
  const filled = [
    {type: 'embed_add_event'},
    {
      type: 'embed_update_event',
      patch: {name: 'Meetup', date: '2026-10-01', time: '18:00'},
    },
  ] as PostAction[]

  it('counts as an attachment and as content', () => {
    const post = draftAfter([{type: 'embed_add_event'}])
    expect(postHasAttachment(post)).toBe(true)
    expect(postHasContent(post)).toBe(true)
  })

  it('is postable once it has a name', () => {
    expect(isEventPostable(draftAfter([{type: 'embed_add_event'}]))).toBe(false)
    expect(isEventPostable(draftAfter(filled))).toBe(true)
    expect(isPollPostable(draftAfter(filled))).toBe(true)
  })

  it('makes a poll post not postable by itself', () => {
    const event = draftAfter(filled).embed.event!
    // Force the invalid combination restoration could produce: an event and
    // a poll on the same post.
    const pollPost = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_statement', index: 0, text: 'Yes'},
    ])
    const forced = {
      ...pollPost,
      embed: {...pollPost.embed, event},
    }
    expect(isPollPostable(forced)).toBe(false)
    expect(isEventPostable(forced)).toBe(false)
  })
})
