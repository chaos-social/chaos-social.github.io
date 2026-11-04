import {RichText} from '@bsky/sdk/richtext'

import {type AssemblyRef} from '#/lib/api/poll'
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

const pendingRef: AssemblyRef = {
  rkey: '3kassembly',
  createdAt: '2026-09-27T12:00:00.000Z',
  fingerprint: '["question",["first"]]',
}

const createdRef: AssemblyRef = {
  ...pendingRef,
  conversationId: '7abcde',
  reportId: 'r7abcde',
}

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
    embed: {...post.embed, poll: {statements: [`statement ${index}`]}},
  }))
}


describe('composer polls', () => {
  it('adds a poll with one empty statement', () => {
    const post = draftAfter([{type: 'embed_add_poll'}])
    expect(post.embed.poll).toEqual({statements: ['']})
  })

  it('edits, adds and removes statements', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_statement', index: 0, text: 'first'},
      {type: 'embed_add_poll_statement'},
      {type: 'embed_update_poll_statement', index: 1, text: 'second'},
      {type: 'embed_add_poll_statement'},
      {type: 'embed_remove_poll_statement', index: 0},
    ])
    expect(post.embed.poll).toEqual({statements: ['second', '']})
  })

  it('ignores an out-of-range statement update', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_statement', index: 3, text: 'nope'},
    ])
    expect(post.embed.poll).toEqual({statements: ['']})
  })

  it('caps statements at ten', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      ...Array.from({length: 12}, () => ({
        type: 'embed_add_poll_statement' as const,
      })),
    ])
    expect(post.embed.poll?.statements).toHaveLength(10)
  })

  it('never removes the last statement', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_remove_poll_statement', index: 0},
    ])
    expect(post.embed.poll?.statements).toHaveLength(1)
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
    expect(post.embed.poll).toEqual({statements: ['']})
    expect(post.embed.media).toBeUndefined()
    expect(post.embed.link).toBeUndefined()
    expect(post.embed.quote).toBeUndefined()
  })

  it('keeps a poll on a new thread post independent of the first', () => {
    let state = apply(initialState(), [{type: 'embed_add_poll'}])
    state = composerReducer(state, {type: 'add_post'})
    expect(state.thread.posts).toHaveLength(2)
    expect(state.thread.posts[0].embed.poll).toEqual({statements: ['']})
    expect(state.thread.posts[1].embed.poll).toBeUndefined()
  })
})

describe('one poll per thread', () => {
  it('refuses a second poll while another post has one', () => {
    const state = updatePost(threadOfTwo(), 0, {type: 'embed_add_poll'})
    const next = updatePost(state, 1, {type: 'embed_add_poll'})

    expect(next).toBe(state)
    expect(next.thread.posts.map(post => post.embed.poll)).toEqual([
      {statements: ['']},
      undefined,
    ])
  })

  it('refuses a second poll whichever post holds the first', () => {
    const state = updatePost(threadOfTwo(), 1, {type: 'embed_add_poll'})
    const next = updatePost(state, 0, {type: 'embed_add_poll'})

    expect(next).toBe(state)
    expect(next.thread.posts.map(post => post.embed.poll)).toEqual([
      undefined,
      {statements: ['']},
    ])
  })

  it('accepts a poll on another post once the first is removed', () => {
    let state = updatePost(threadOfTwo(), 0, {type: 'embed_add_poll'})
    state = updatePost(state, 0, {type: 'embed_remove_poll'})
    state = updatePost(state, 1, {type: 'embed_add_poll'})

    expect(state.thread.posts.map(post => post.embed.poll)).toEqual([
      undefined,
      {statements: ['']},
    ])
  })

  it('accepts a poll on another post once the post with one is removed', () => {
    let state = updatePost(threadOfTwo(), 0, {type: 'embed_add_poll'})
    state = composerReducer(state, {
      type: 'remove_post',
      postId: state.thread.posts[0].id,
    })
    state = updatePost(state, 0, {type: 'embed_add_poll'})

    expect(state.thread.posts.map(post => post.embed.poll)).toEqual([
      {statements: ['']},
    ])
  })

  it('still edits the poll that exists', () => {
    let state = updatePost(threadOfTwo(), 0, {type: 'embed_add_poll'})
    state = updatePost(state, 0, {
      type: 'embed_update_poll_statement',
      index: 0,
      text: 'first',
    })
    state = updatePost(state, 0, {type: 'embed_add_poll_statement'})

    expect(state.thread.posts[0].embed.poll).toEqual({
      statements: ['first', ''],
    })
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
      {statements: ['statement 1']},
      undefined,
    ])
    expect(next.thread.posts[0]).toBe(textOnly)
    expect(next.thread.posts[1]).toBe(posts[1])
  })
})

describe('assembly reference', () => {
  it('stores the reference on the poll', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_update_poll_statement', index: 0, text: 'first'},
      {type: 'embed_set_poll_assembly', assembly: pendingRef},
    ])
    expect(post.embed.poll).toEqual({
      statements: ['first'],
      assembly: pendingRef,
    })
  })

  it('replaces an earlier reference', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_assembly', assembly: pendingRef},
      {type: 'embed_set_poll_assembly', assembly: createdRef},
    ])
    expect(post.embed.poll).toEqual({statements: [''], assembly: createdRef})
  })

  it('stores the reference on the post it names', () => {
    const state = updatePost(threadOfTwo(), 1, {type: 'embed_add_poll'})
    const next = updatePost(state, 1, {
      type: 'embed_set_poll_assembly',
      assembly: createdRef,
    })

    expect(next.thread.posts[0]).toBe(state.thread.posts[0])
    expect(next.thread.posts[1].embed.poll).toEqual({
      statements: [''],
      assembly: createdRef,
    })
  })

  it('is ignored when the post has no poll', () => {
    const state = initialState()
    const next = updatePost(state, 0, {
      type: 'embed_set_poll_assembly',
      assembly: createdRef,
    })

    expect(next.thread.posts[0]).toBe(state.thread.posts[0])
    expect(next.thread.posts[0].embed.poll).toBeUndefined()
  })

  it('survives editing, adding and removing statements', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_assembly', assembly: createdRef},
      {type: 'embed_update_poll_statement', index: 0, text: 'first'},
      {type: 'embed_add_poll_statement'},
      {type: 'embed_update_poll_statement', index: 1, text: 'second'},
      {type: 'embed_remove_poll_statement', index: 0},
    ])
    expect(post.embed.poll).toEqual({
      statements: ['second'],
      assembly: createdRef,
    })
  })

  it('survives each statement action on its own', () => {
    const seeded: PostAction[] = [
      {type: 'embed_add_poll'},
      {type: 'embed_add_poll_statement'},
      {type: 'embed_set_poll_assembly', assembly: createdRef},
    ]
    expect(
      draftAfter([
        ...seeded,
        {type: 'embed_update_poll_statement', index: 1, text: 'edited'},
      ]).embed.poll,
    ).toEqual({statements: ['', 'edited'], assembly: createdRef})
    expect(
      draftAfter([...seeded, {type: 'embed_add_poll_statement'}]).embed.poll,
    ).toEqual({statements: ['', '', ''], assembly: createdRef})
    expect(
      draftAfter([...seeded, {type: 'embed_remove_poll_statement', index: 1}])
        .embed.poll,
    ).toEqual({statements: [''], assembly: createdRef})
  })

  it('goes away with the poll', () => {
    const post = draftAfter([
      {type: 'embed_add_poll'},
      {type: 'embed_set_poll_assembly', assembly: createdRef},
      {type: 'embed_remove_poll'},
      {type: 'embed_add_poll'},
    ])
    expect(post.embed.poll).toEqual({statements: ['']})
    expect(post.embed.poll).not.toHaveProperty('assembly')
  })
})

describe('isPollPostable', () => {
  function pollPost(text: string, statements: string[]): PostDraft {
    return {
      ...draftAfter([
        {type: 'update_richtext', richtext: new RichText({text})},
        {type: 'embed_add_poll'},
      ]),
      embed: {
        quote: undefined,
        media: undefined,
        link: undefined,
        poll: {statements},
      },
    }
  }

  it.each([
    {
      kind: 'text and distinct statements',
      post: pollPost('Which one?', ['first', 'second']),
      expected: true,
    },
    {
      kind: 'a single statement',
      post: pollPost('Which one?', ['only']),
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
      kind: 'text with a null character',
      post: pollPost('Which\u0000one?', ['first', 'second']),
      expected: false,
    },
    {
      kind: 'a blank statement',
      post: pollPost('Which one?', ['first', ' ']),
      expected: false,
    },
    {
      kind: 'a repeated statement',
      post: pollPost('Which one?', ['first', ' FIRST ']),
      expected: false,
    },
    {
      kind: 'a statement over the limit',
      post: pollPost('Which one?', ['a'.repeat(401)]),
      expected: false,
    },
    {
      kind: 'more than ten statements',
      post: pollPost(
        'Which one?',
        [...Array(11).keys()].map(index => `statement ${index}`),
      ),
      expected: false,
    },
  ])('is $expected for a poll with $kind', ({post, expected}) => {
    expect(isPollPostable(post)).toBe(expected)
  })

  it('accepts post text longer than a topic, which is shortened', () => {
    expect(isPollPostable(pollPost('a'.repeat(300), ['first']))).toBe(true)
  })

  it('is true for a post without a poll', () => {
    expect(isPollPostable(draftAfter([]))).toBe(true)
  })

  it('is false when the poll shares the post with another attachment', () => {
    const post = pollPost('Which one?', ['first'])
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
