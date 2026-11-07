import {RichText} from '@bsky/sdk/richtext'

import {type ComposerImage} from '#/state/gallery'
import {type Gif} from '#/features/gifPicker/types'
import {
  type ComposerAction,
  composerReducer,
  type ComposerState,
  createComposerState,
  isPollPostable,
  type PostDraft,
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

function threadOfTwo(): ComposerState {
  return composerReducer(initialState(), {type: 'add_post'})
}

function withPosts(
  state: ComposerState,
  change: (post: PostDraft, index: number) => PostDraft,
): ComposerState {
  return {
    ...state,
    thread: {...state.thread, posts: state.thread.posts.map(change)},
  }
}

function withPollOnEveryPost(state: ComposerState): ComposerState {
  return withPosts(state, (post, index) => ({
    ...post,
    embed: {
      ...post.embed,
      poll: {options: [`option ${index}`, 'other'], duration: '1d'},
    },
  }))
}

const TWO_CHOICES: PostAction[] = [
  {type: 'embed_add_poll'},
  {type: 'embed_update_poll_option', index: 0, text: 'first'},
  {type: 'embed_update_poll_option', index: 1, text: 'second'},
]

describe('composer polls', () => {
  it('adds a poll with two empty choices', () => {
    const post = draftAfter([{type: 'embed_add_poll'}])
    expect(post.embed.poll).toEqual({options: ['', ''], duration: '1d'})
  })

  it('edits, adds and removes choices', () => {
    const post = draftAfter([
      ...TWO_CHOICES,
      {type: 'embed_add_poll_option'},
      {type: 'embed_update_poll_option', index: 2, text: 'third'},
      {type: 'embed_remove_poll_option', index: 0},
    ])
    expect(post.embed.poll?.options).toEqual(['second', 'third'])
  })

  it('ignores an out-of-range choice update', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_option', index: 3, text: 'nope'},
    ])
    expect(post.embed.poll?.options).toEqual(['', ''])
  })

  it('caps choices at four', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      ...Array.from({length: 5}, () => ({
        type: 'embed_add_poll_option' as const,
      })),
    ])
    expect(post.embed.poll?.options).toHaveLength(4)
  })

  it('never removes a choice below two', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_remove_poll_option', index: 0},
    ])
    expect(post.embed.poll?.options).toHaveLength(2)
  })

  it('sets the closing duration', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_duration', duration: '7d'},
    ])
    expect(post.embed.poll?.duration).toBe('7d')
  })

  it('removes the poll', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_remove_poll'},
    ])
    expect(post.embed.poll).toBeUndefined()
  })

  it('refuses a poll when images, a gif or a link are attached', () => {
    expect(
      draftAfter([
        {type: 'embed_add_images', images: [image]},
        {type: 'embed_add_poll'},
      ]).embed.poll,
    ).toBeUndefined()
    expect(
      draftAfter([
        {type: 'embed_add_gif', gif: {} as Gif},
        {type: 'embed_add_poll'},
      ]).embed.poll,
    ).toBeUndefined()
    expect(
      draftAfter([
        {type: 'embed_add_uri', uri: 'https://example.com/article'},
        {type: 'embed_add_poll'},
      ]).embed.poll,
    ).toBeUndefined()
  })

  it('refuses a poll when a quote is attached', () => {
    const post = draftAfter([
      {
        type: 'embed_add_uri',
        uri: 'https://bsky.app/profile/alice.test/post/3kabc',
      },
      {type: 'embed_add_poll'},
    ])
    expect(post.embed.quote).toBeDefined()
    expect(post.embed.poll).toBeUndefined()
  })

  it('refuses media, gifs, video, links and quotes once a poll exists', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_add_images', images: [image]},
      {type: 'embed_add_gif', gif: {} as Gif},
      {
        type: 'embed_add_video',
        asset: {} as never,
        abortController: new AbortController(),
        telemetry: {} as never,
      },
      {type: 'embed_add_uri', uri: 'https://example.com/article'},
      {
        type: 'embed_add_uri',
        uri: 'https://bsky.app/profile/alice.test/post/3kabc',
      },
    ])
    expect(post.embed.poll).toEqual({options: ['', ''], duration: '1d'})
    expect(post.embed.media).toBeUndefined()
    expect(post.embed.link).toBeUndefined()
    expect(post.embed.quote).toBeUndefined()
  })

  it('keeps a poll on a new thread post independent of the first', () => {
    let state = apply(initialState(), [{type: 'embed_add_poll'}])
    state = composerReducer(state, {type: 'add_post'})
    expect(state.thread.posts).toHaveLength(2)
    expect(state.thread.posts[0].embed.poll).toBeDefined()
    expect(state.thread.posts[1].embed.poll).toBeUndefined()
  })
})

describe('one poll per thread', () => {
  it('refuses a second poll while another post has one', () => {
    const state = updatePost(threadOfTwo(), 0, {type: 'embed_add_poll'})
    const next = updatePost(state, 1, {type: 'embed_add_poll'})

    expect(next).toBe(state)
    expect(next.thread.posts.map(post => post.embed.poll)).toEqual([
      {options: ['', ''], duration: '1d'},
      undefined,
    ])
  })

  it('refuses a second poll whichever post holds the first', () => {
    const state = updatePost(threadOfTwo(), 1, {type: 'embed_add_poll'})
    const next = updatePost(state, 0, {type: 'embed_add_poll'})

    expect(next).toBe(state)
  })

  it('accepts a poll on another post once the first is removed', () => {
    let state = updatePost(threadOfTwo(), 0, {type: 'embed_add_poll'})
    state = updatePost(state, 0, {type: 'embed_remove_poll'})
    state = updatePost(state, 1, {type: 'embed_add_poll'})

    expect(state.thread.posts.map(post => post.embed.poll)).toEqual([
      undefined,
      {options: ['', ''], duration: '1d'},
    ])
  })

  it('keeps only the first poll of a restored draft', () => {
    const posts = withPollOnEveryPost(
      composerReducer(threadOfTwo(), {type: 'add_post'}),
    ).thread.posts
    const textOnly = {
      ...posts[0],
      embed: {...posts[0].embed, poll: undefined},
    }
    const next = composerReducer(initialState(), {
      type: 'restore_from_draft',
      draftId: 'draft-1',
      posts: [textOnly, posts[1], posts[2]],
      threadgateAllow: undefined,
      postgateEmbeddingRules: undefined,
      loadedMedia: new Map(),
      originalLocalRefs: new Set(),
    })

    expect(next.thread.posts.map(post => post.embed.poll)).toEqual([
      undefined,
      {options: ['option 1', 'other'], duration: '1d'},
      undefined,
    ])
    expect(next.thread.posts[0]).toBe(textOnly)
  })
})

describe('the poll record key', () => {
  it('is stored on the poll', () => {
    const post = draftAfter([
      ...TWO_CHOICES,
      {type: 'embed_set_poll_rkey', rkey: '3mpoll'},
    ])
    expect(post.embed.poll?.rkey).toBe('3mpoll')
  })

  it('survives editing the choices', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_rkey', rkey: '3mpoll'},
      {type: 'embed_update_poll_option', index: 0, text: 'first'},
    ])
    expect(post.embed.poll?.rkey).toBe('3mpoll')
  })

  it('goes away with the poll', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_rkey', rkey: '3mpoll'},
      {type: 'embed_remove_poll'},
      {type: 'embed_add_poll'},
    ])
    expect(post.embed.poll).not.toHaveProperty('rkey')
  })
})

describe('isPollPostable', () => {
  function pollPost(text: string, options: string[]): PostDraft {
    return {
      ...draftAfter([
        {type: 'update_richtext', richtext: new RichText({text})},
        {type: 'embed_add_poll'},
      ]),
      embed: {
        quote: undefined,
        media: undefined,
        link: undefined,
        poll: {options, duration: '1d'},
      },
    }
  }

  it.each([
    {
      kind: 'text and two choices',
      post: pollPost('Which one?', ['first', 'second']),
      expected: true,
    },
    {
      kind: 'four choices',
      post: pollPost('Which one?', ['a', 'b', 'c', 'd']),
      expected: true,
    },
    {
      kind: 'no text',
      post: pollPost('', ['first', 'second']),
      expected: false,
    },
    {
      kind: 'text that is only whitespace',
      post: pollPost(' \n ', ['first', 'second']),
      expected: false,
    },
    {
      kind: 'a single choice',
      post: pollPost('Which one?', ['only']),
      expected: false,
    },
    {
      kind: 'five choices',
      post: pollPost('Which one?', ['a', 'b', 'c', 'd', 'e']),
      expected: false,
    },
    {
      kind: 'a blank choice',
      post: pollPost('Which one?', ['first', ' ']),
      expected: false,
    },
    {
      kind: 'a choice over the limit',
      post: pollPost('Which one?', ['a'.repeat(101), 'b']),
      expected: false,
    },
  ])('is $expected for a poll with $kind', ({post, expected}) => {
    expect(isPollPostable(post)).toBe(expected)
  })

  it('is true for a post without a poll', () => {
    expect(isPollPostable(draftAfter([]))).toBe(true)
  })

  it('is false when the poll shares the post with another attachment', () => {
    const post = pollPost('Which one?', ['first', 'second'])
    const link = {
      type: 'link' as const,
      uri: 'https://example.com/article' as `${string}:${string}`,
    }

    expect(isPollPostable({...post, embed: {...post.embed, link}})).toBe(false)
    expect(isPollPostable({...post, embed: {...post.embed, quote: link}})).toBe(
      false,
    )
    expect(
      isPollPostable({
        ...post,
        embed: {...post.embed, media: {type: 'gif', gif: {} as Gif, alt: ''}},
      }),
    ).toBe(false)
  })
})

describe('post content predicates', () => {
  it('treats a poll as an attachment and as content', () => {
    const empty = draftAfter([])
    const withPoll = draftAfter([{type: 'embed_add_poll'}])
    expect(postHasAttachment(empty)).toBe(false)
    expect(postHasContent(empty)).toBe(false)
    expect(postHasAttachment(withPoll)).toBe(true)
    expect(postHasContent(withPoll)).toBe(true)
  })
})
