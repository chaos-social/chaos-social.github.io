import {toDatetimeString} from '@atproto/syntax'
import {RichText} from '@bsky/sdk/richtext'
import {act, render, waitFor} from '@testing-library/react-native'

import {
  type ComposerOpts,
  Provider,
  useComposerControls,
  useComposerState,
  useOpenComposer,
} from '#/state/shell/composer'
import {type ComposerState} from '#/view/com/composer/state/composer'
import {type VideoState} from '#/view/com/composer/state/video'
import {encodeRecovery} from './codec'
import {clearRecovery, readRecovery, saveRecovery} from './index.web'

let mockCurrentDid: string | undefined = 'alice'
const mockRemoveQueries = jest.fn()
const mockSessionStorage = new Map<string, string>()
const mockMediaStorage = new Map<string, Record<string, Blob>>()
let mockReadRecovery: typeof readRecovery | undefined
const mockSwitchOpen = jest.fn()
let mockSwitchPrompt: {
  title: string
  onConfirm: () => void
  onClose: () => void
}

jest.mock('#/components/Prompt', () => ({
  usePromptControl: () => ({open: mockSwitchOpen}),
  Basic: (props: typeof mockSwitchPrompt) => {
    mockSwitchPrompt = props
    return null
  },
}))

jest.unmock('multiformats/cid')

jest.mock('idb-keyval', () => ({
  createStore: jest.fn(),
  get: jest.fn((key: string) => Promise.resolve(mockMediaStorage.get(key))),
  update: jest.fn(
    (
      key: string,
      updater: (
        previous: Record<string, Blob> | undefined,
      ) => Record<string, Blob>,
    ) => {
      mockMediaStorage.set(key, updater(mockMediaStorage.get(key)))
      return Promise.resolve()
    },
  ),
  del: jest.fn((key: string) => {
    mockMediaStorage.delete(key)
    return Promise.resolve()
  }),
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/lib/media/video/telemetry', () => ({
  createVideoTelemetry: jest.fn(),
}))

jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: (message: {message: string}) => message.message}),
}))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({removeQueries: mockRemoveQueries}),
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({
    currentAccount: mockCurrentDid ? {did: mockCurrentDid} : undefined,
    accounts: [{did: 'alice'}, {did: 'bob'}],
  }),
}))
jest.mock('#/state/gallery', () => ({
  purgeTemporaryImageFiles: jest.fn(),
}))
jest.mock('#/state/queries/resolve-link', () => ({
  precacheResolveLinkQuery: jest.fn(),
  RQKEY_GIF_ROOT: 'gif',
  RQKEY_LINK_ROOT: 'link',
}))
jest.mock('#/state/shell/composer/recovery', () => {
  const actual = jest.requireActual<typeof import('./index.web')>('./index.web')
  return {
    ...actual,
    readRecovery: (did: string) =>
      (mockReadRecovery ?? actual.readRecovery)(did),
  }
})
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

function composition(text: string): ComposerState {
  return {
    activePostIndex: 0,
    mutableNeedsFocusActive: false,
    isDirty: true,
    loadedMediaMap: new Map(),
    originalLocalRefs: new Set(['photo']),
    thread: {
      postgate: {
        $type: 'app.bsky.feed.postgate',
        post: 'at://did:plc:alice/app.bsky.feed.post/test',
        createdAt: toDatetimeString(new Date()),
      },
      threadgate: [],
      posts: [
        {
          id: 'post',
          richtext: new RichText({text}),
          shortenedGraphemeLength: text.length,
          labels: [],
          tags: ['tag'],
          embed: {quote: undefined, media: undefined, link: undefined},
        },
      ],
    },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['cached media'])),
      }),
    ),
  })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'blob:restored-media'),
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => mockSessionStorage.get(key) ?? null,
      setItem: (key: string, value: string) =>
        mockSessionStorage.set(key, value),
      removeItem: (key: string) => mockSessionStorage.delete(key),
    },
  })
})

afterEach(() => {
  clearRecovery('alice')
  mockSessionStorage.clear()
  mockMediaStorage.clear()
  mockCurrentDid = 'alice'
  mockReadRecovery = undefined
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it('retains the latest composition and its browser media references', async () => {
  saveRecovery('alice', {activeAccountDid: 'alice'}, composition('first'))
  const state = composition('latest')
  state.loadedMediaMap = new Map([['photo', 'blob:photo']])
  saveRecovery('alice', {activeAccountDid: 'bob', onPost: jest.fn()}, state)

  const recovery = (await readRecovery('alice'))!
  expect(recovery.opts).toEqual({activeAccountDid: 'bob'})
  expect(recovery.state.thread).toBe(state.thread)
  expect(recovery.state.thread.posts[0].richtext.text).toBe('latest')
  expect(recovery.state.thread.posts[0].richtext).toBeInstanceOf(RichText)
  expect(recovery.state.loadedMediaMap?.get('photo')).toBe('blob:photo')
  expect(recovery.state.originalLocalRefs?.has('photo')).toBe(true)
  expect(recovery.state.mutableNeedsFocusActive).toBe(true)
  expect(state.mutableNeedsFocusActive).toBe(false)
})

function reloadedTab() {
  let tab: typeof import('./index.web') | undefined
  jest.isolateModules(() => {
    tab = jest.requireActual<typeof import('./index.web')>('./index.web')
  })
  return tab!
}

it.each(['', ' \n\t '])(
  'does not reopen an empty composer (%j)',
  async text => {
    saveRecovery('alice', {activeAccountDid: 'alice'}, composition(text))
    expect(await readRecovery('alice')).toBeUndefined()
    expect(await reloadedTab().readRecovery('alice')).toBeUndefined()
    expect(mockSessionStorage.size).toBe(0)
    expect(observeComposer().state).toBeUndefined()
  },
)

it('clears the previous recovery when all contents are removed', async () => {
  saveRecovery('alice', {activeAccountDid: 'alice'}, composition('remove me'))
  expect(mockSessionStorage.size).toBe(1)
  saveRecovery('alice', {activeAccountDid: 'alice'}, composition(''))
  expect(await readRecovery('alice')).toBeUndefined()
  expect(await reloadedTab().readRecovery('alice')).toBeUndefined()
  expect(mockSessionStorage.size).toBe(0)
})

it('ignores and clears empty snapshots saved by previous versions', () => {
  mockSessionStorage.set(
    'composerRecovery',
    JSON.stringify({
      id: 'old-snapshot',
      raw: encodeRecovery({activeAccountDid: 'alice'}, composition('')),
    }),
  )
  mockReadRecovery = reloadedTab().readRecovery
  expect(observeComposer().state).toBeUndefined()
  expect(mockSessionStorage.size).toBe(0)
})

it('restores content in later posts even when the first post is empty', async () => {
  const state = composition('')
  state.thread.posts.push({
    ...composition('second post').thread.posts[0],
    id: 'second',
  })
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)
  const restored = await reloadedTab().readRecovery('alice')
  expect(restored?.state.thread.posts[1].richtext.text).toBe('second post')
})

it.each(['link', 'quote'] as const)(
  'restores a %s without accompanying text',
  async embed => {
    const state = composition('')
    state.thread.posts[0].embed[embed] = {
      type: 'link',
      uri: 'https://example.com',
    }
    saveRecovery('alice', {activeAccountDid: 'alice'}, state)
    const restored = await reloadedTab().readRecovery('alice')
    expect(restored?.state.thread.posts[0].embed[embed]?.uri).toBe(
      'https://example.com',
    )
  },
)

it('reopens the latest thread after a page reload', async () => {
  const state = composition('unfinished post')
  state.loadedMediaMap = new Map()
  state.thread.posts.push({
    ...state.thread.posts[0],
    id: 'second',
    richtext: new RichText({text: 'second post'}),
  })
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)

  const restored = await reloadedTab().readRecovery('alice')
  expect(restored?.state.thread.posts.map(post => post.richtext.text)).toEqual([
    'unfinished post',
    'second post',
  ])
  expect(restored?.state.mutableNeedsFocusActive).toBe(true)
  mockReadRecovery = reloadedTab().readRecovery
  const session = observeComposer()
  expect(session.state?.recoveredState?.thread.posts[0].richtext.text).toBe(
    'unfinished post',
  )
})

it('keeps recovery isolated to the browser tab', async () => {
  saveRecovery(
    'alice',
    {activeAccountDid: 'alice'},
    composition('only this tab'),
  )
  const saved = new Map(mockSessionStorage)
  mockSessionStorage.clear()
  expect(await reloadedTab().readRecovery('alice')).toBeUndefined()
  for (const [key, value] of saved) mockSessionStorage.set(key, value)
  expect(
    (await reloadedTab().readRecovery('alice'))?.state.thread.posts[0].richtext
      .text,
  ).toBe('only this tab')
})

it('does not restore an explicitly closed composition after reloading', async () => {
  saveRecovery('alice', {activeAccountDid: 'alice'}, composition('discard me'))
  clearRecovery('alice')
  expect(await reloadedTab().readRecovery('alice')).toBeUndefined()
})

it('restores cached image bytes with fresh blob URLs before reopening', async () => {
  const blob = new Blob(['photo'], {type: 'image/jpeg'})
  const mockFetch = jest.fn(() =>
    Promise.resolve({ok: true, blob: () => Promise.resolve(blob)}),
  )
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: mockFetch,
  })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'blob:restored-photo'),
  })
  const state = composition('')
  state.loadedMediaMap = new Map([['photo', 'blob:photo']])
  state.thread.posts[0].embed.media = {
    type: 'images',
    images: [
      {
        alt: 'photo description',
        source: {
          id: 'photo',
          path: 'blob:photo',
          width: 100,
          height: 100,
          mime: 'image/jpeg',
        },
      },
    ],
  }
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)
  await waitFor(() => expect(mockMediaStorage.size).toBe(1))
  expect(mockFetch).toHaveBeenCalledTimes(1)
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)
  expect(mockFetch).toHaveBeenCalledTimes(1)

  mockReadRecovery = reloadedTab().readRecovery
  const session = observeComposer()
  expect(session.state).toBeUndefined()
  await waitFor(() => expect(session.state?.recoveredState).toBeDefined())
  const media = session.state?.recoveredState?.thread.posts[0].embed.media
  expect(media?.type === 'images' && media.images[0].source.path).toBe(
    'blob:restored-photo',
  )
  expect(media?.type === 'images' && media.images[0].alt).toBe(
    'photo description',
  )
  expect(session.state?.recoveredState?.loadedMediaMap?.get('photo')).toBe(
    'blob:restored-photo',
  )
  act(() => {
    session.controls!.closeComposer()
  })
  expect(mockMediaStorage.size).toBe(0)
})

it('does not replace a new composition with a delayed recovery', async () => {
  let finish: (
    recovery: Awaited<ReturnType<typeof readRecovery>>,
  ) => void = () => {}
  mockReadRecovery = () =>
    new Promise(resolve => {
      finish = resolve
    })
  const session = observeComposer()
  act(() => session.open!({text: 'new composition'}))
  await act(() => {
    finish({
      version: 1,
      opts: {activeAccountDid: 'alice'},
      state: composition('old composition'),
    })
    return Promise.resolve()
  })
  expect(session.state?.text).toBe('new composition')
  expect(session.state?.recoveredState).toBeUndefined()
})

it('restores browser files and caption metadata after a reload', async () => {
  const file = new File(['WEBVTT\n\ncaption'], 'captions.vtt', {
    type: 'text/vtt',
    lastModified: 123,
  })
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(() =>
      Promise.resolve({ok: true, blob: () => Promise.resolve(file)}),
    ),
  })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'blob:caption-file'),
  })
  const state = composition('captioned video')
  state.thread.posts[0].embed.media = {
    type: 'video',
    video: {
      status: 'done',
      progress: 100,
      abortController: new AbortController(),
      asset: null,
      altText: 'video description',
      captions: [{lang: 'en', file}],
    } as VideoState,
  }
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)
  await waitFor(() => expect(mockMediaStorage.size).toBe(1))
  const restored = await reloadedTab().readRecovery('alice')
  const media = restored?.state.thread.posts[0].embed.media
  expect(media?.type).toBe('video')
  if (media?.type !== 'video') throw new Error('missing video')
  expect(media.video.altText).toBe('video description')
  expect(media.video.captions[0].lang).toBe('en')
  expect(media.video.captions[0].file).toBeInstanceOf(File)
  expect(media.video.captions[0].file.name).toBe('captions.vtt')
  expect(media.video.captions[0].file.type).toBe('text/vtt')
  expect(media.video.captions[0].file.lastModified).toBe(123)
  expect(await media.video.captions[0].file.text()).toBe('WEBVTT\n\ncaption')
})

it('preserves post text that happens to match an attachment URL', async () => {
  const state = composition('blob:photo')
  state.loadedMediaMap = new Map([['photo', 'blob:photo']])
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)
  await waitFor(() => expect(mockMediaStorage.size).toBe(1))
  const restored = await reloadedTab().readRecovery('alice')
  expect(restored?.state.thread.posts[0].richtext.text).toBe('blob:photo')
  expect(restored?.state.loadedMediaMap?.get('photo')).not.toBe('blob:photo')
})

it('does not resurrect a cleared composition when a media copy finishes', async () => {
  let finish: (blob: Blob) => void = () => {}
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: jest.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () =>
          new Promise<Blob>(resolve => {
            finish = resolve
          }),
      }),
    ),
  })
  const state = composition('discard me')
  state.loadedMediaMap = new Map([['photo', 'blob:photo']])
  saveRecovery('alice', {activeAccountDid: 'alice'}, state)
  await Promise.resolve()
  clearRecovery('alice')
  finish(new Blob(['photo']))
  await Promise.resolve()
  expect(mockMediaStorage.size).toBe(0)
  expect(await reloadedTab().readRecovery('alice')).toBeUndefined()
})

it('keeps the composer usable if browser storage is unavailable', async () => {
  jest.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
    throw new Error('quota exceeded')
  })
  saveRecovery(
    'alice',
    {activeAccountDid: 'alice'},
    composition('keep in memory'),
  )
  expect(
    (await readRecovery('alice'))?.state.thread.posts[0].richtext.text,
  ).toBe('keep in memory')
})

it('restores the tab composer through a signed-out transition into another account', () => {
  let composer: ReturnType<typeof useComposerState>
  let openComposer: ReturnType<typeof useOpenComposer>['openComposer']
  let closeComposer: ReturnType<typeof useComposerControls>['closeComposer']

  function Observer() {
    composer = useComposerState()
    ;({openComposer} = useOpenComposer())
    ;({closeComposer} = useComposerControls())
    return null
  }

  function Shell({did}: {did: string | undefined}) {
    return (
      <Provider key={did}>
        <Observer />
      </Provider>
    )
  }

  const screen = render(<Shell did={mockCurrentDid} />)
  act(() => openComposer({activeAccountDid: 'alice'}))
  const state = composition('unfinished thread')
  saveRecovery('alice', composer!, state)

  mockCurrentDid = undefined
  screen.rerender(<Shell did={mockCurrentDid} />)
  expect(composer).toBeUndefined()

  mockCurrentDid = 'bob'
  screen.rerender(<Shell did={mockCurrentDid} />)
  expect(composer?.activeAccountDid).toBe('alice')
  expect(composer?.recoveredState?.thread).toBe(state.thread)
  expect(composer?.recoveredState?.mutableNeedsFocusActive).toBe(true)

  act(() => {
    closeComposer()
  })
  mockCurrentDid = undefined
  screen.rerender(<Shell did={mockCurrentDid} />)
  mockCurrentDid = 'alice'
  screen.rerender(<Shell did={mockCurrentDid} />)
  expect(composer).toBeUndefined()
})

function observeComposer() {
  const session: {
    state?: ReturnType<typeof useComposerState>
    controls?: ReturnType<typeof useComposerControls>
    open?: ReturnType<typeof useOpenComposer>['openComposer']
  } = {}

  function Observer() {
    session.state = useComposerState()
    session.controls = useComposerControls()
    session.open = useOpenComposer().openComposer
    return null
  }

  render(
    <Provider>
      <Observer />
    </Provider>,
  )
  return session
}

it('keeps minimized content and callbacks through navigation and restores it', () => {
  const session = observeComposer()
  const onPost = jest.fn()
  const recoveredState = composition('unfinished post')
  act(() => session.open!({text: 'original', onPost, recoveredState}))
  act(() => session.controls!.minimizeComposer())

  expect(session.state?.isMinimized).toBe(true)
  expect(session.state?.recoveredState).toBe(recoveredState)
  act(() => expect(session.controls!.closeComposer()).toBe(false))
  expect(mockRemoveQueries).not.toHaveBeenCalled()

  act(() => session.controls!.restoreComposer())
  expect(session.state?.isMinimized).toBe(false)
  expect(session.state?.onPost).toBe(onPost)

  act(() => expect(session.controls!.closeComposer()).toBe(true))
  expect(session.state).toBeUndefined()
  expect(mockRemoveQueries).toHaveBeenCalledTimes(2)
})

it('reopens a minimized session instead of replacing it with a new composition', () => {
  const session = observeComposer()
  act(() =>
    session.open!({
      text: 'keep me',
      openGallery: true,
      openAccountSwitcher: true,
    }),
  )
  act(() => session.controls!.minimizeComposer())
  act(() => session.open!({text: 'replacement'}))

  expect(session.state?.isMinimized).toBe(false)
  expect(session.state?.text).toBe('keep me')
  expect(session.state?.openGallery).toBe(false)
  expect(session.state?.openAccountSwitcher).toBe(false)
})

it('does not create a session when minimizing or restoring a closed composer', () => {
  const session = observeComposer()
  act(() => session.controls!.minimizeComposer())
  act(() => session.controls!.restoreComposer())
  expect(session.state).toBeUndefined()
})

it('can finish and clean up a post that publishes while minimized', () => {
  const session = observeComposer()
  act(() => session.open!({text: 'publishing in the background'}))
  act(() => session.controls!.minimizeComposer())
  act(() =>
    expect(session.controls!.closeComposer({includeMinimized: true})).toBe(
      true,
    ),
  )
  expect(session.state).toBeUndefined()
  expect(mockRemoveQueries).toHaveBeenCalledTimes(2)
})

function targetPost(): NonNullable<ComposerOpts['quote']> {
  return {
    uri: 'at://did:plc:bob/app.bsky.feed.post/target',
    cid: 'target-cid',
    author: {did: 'did:plc:bob', handle: 'bob.test'},
    record: {text: 'target post'},
    indexedAt: '2026-10-31T12:00:00.000Z',
  }
}

it.each(['replyTo', 'quote'] as const)(
  'confirms switching a minimized post to %s without replacing its contents',
  kind => {
    const session = observeComposer()
    const recoveredState = composition('keep this post')
    const oldOnPost = jest.fn()
    const onPost = jest.fn()
    const post = targetPost()
    const target =
      kind === 'quote'
        ? {quote: post}
        : {replyTo: {...post, text: 'target post'}}
    act(() => session.open!({recoveredState, onPost: oldOnPost}))
    act(() => session.controls!.minimizeComposer())
    act(() => session.open!({...target, onPost, logContext: 'PostReply'}))

    expect(mockSwitchOpen).toHaveBeenCalledTimes(1)
    expect(session.state?.isMinimized).toBe(true)
    expect(session.state?.target).toBeUndefined()
    expect(session.state?.onPost).toBe(oldOnPost)

    const confirm = mockSwitchPrompt.onConfirm
    act(() => mockSwitchPrompt.onClose())
    act(() => confirm())

    expect(session.state?.isMinimized).toBe(false)
    expect(session.state?.recoveredState).toBe(recoveredState)
    expect(session.state?.target).toEqual(target)
    expect(session.state?.[kind]?.uri).toBe(post.uri)
    expect(session.state?.onPost).toBe(onPost)
  },
)

it('keeps the original target and contents minimized when switching is cancelled', () => {
  const session = observeComposer()
  const recoveredState = composition('keep this post')
  const original = targetPost()
  act(() => session.open!({quote: original, recoveredState}))
  act(() => session.controls!.minimizeComposer())
  const minimized = session.state
  act(() =>
    session.open!({replyTo: {...targetPost(), text: 'new reply target'}}),
  )
  act(() => mockSwitchPrompt.onClose())

  expect(session.state).toBe(minimized)
  act(() => session.open!({}))
  expect(session.state?.quote).toBe(original)
  expect(session.state?.recoveredState).toBe(recoveredState)
})

it('does not apply a pending target to a different composition', () => {
  const session = observeComposer()
  act(() => session.open!({text: 'first post'}))
  act(() => session.controls!.minimizeComposer())
  act(() => session.open!({quote: targetPost()}))
  const confirm = mockSwitchPrompt.onConfirm
  act(() => {
    session.controls!.closeComposer({includeMinimized: true})
  })
  act(() => session.open!({text: 'another post'}))
  act(() => confirm())

  expect(session.state?.text).toBe('another post')
  expect(session.state?.quote).toBeUndefined()
})
