/** @jest-environment jsdom */

import 'fast-text-encoding'

import {act, createElement} from 'react'
import {createRoot} from 'react-dom/client'

import {EphemeralAccountPicker} from '#/components/EphemeralAccountPicker/index.web'
import {RepostButton} from '#/components/PostControls/RepostButton.web'
import {POST_KEYBOARD_ACTION_EVENT} from './postActions.web'
import {
  clickPostAction,
  getInitialVisiblePost,
  getNavigablePosts,
  getPostActivityRoute,
  getPostActivityShortcut,
  getPostAuthorRoute,
  getPostMediaTargets,
  getRevealedPostWarning,
  openPostMediaTarget,
  setPostSelected,
  switchPageTab,
} from './postNavigation.web'

jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: true}),
}))

jest.mock('#/components/Menu', () => ({
  Root: ({
    children,
    control,
  }: React.PropsWithChildren<{control: {isOpen: boolean}}>) => {
    const {createElement} = jest.requireActual<typeof import('react')>('react')
    const {Root} = jest.requireActual<
      typeof import('@radix-ui/react-dropdown-menu')
    >('@radix-ui/react-dropdown-menu')
    return createElement(Root, {open: control.isOpen}, children)
  },
}))

jest.mock('#/view/shell/desktop/LeftNav', () => ({
  SwitchMenuItems: () => null,
}))

jest.mock('#/components/PostControls/RepostButtonMenu', () => ({
  RepostButtonMenu: () => {
    const {createElement} = jest.requireActual<typeof import('react')>('react')
    return createElement('button', {'data-testid': 'repostBtn'})
  },
}))

function createPost({
  top,
  left = 0,
}: {
  top: number
  left?: number
}): HTMLElement {
  const element = document.createElement('div')
  element.dataset.keyboardNavigationPost = `post-${top}`
  element.getBoundingClientRect = () => ({
    top,
    bottom: top + 100,
    left,
    right: left + 500,
    width: 500,
    height: 100,
    x: left,
    y: top,
    toJSON() {},
  })
  document.body.appendChild(element)
  return element
}

it('remeasures the account picker when the same post button reopens after scrolling', () => {
  const post = createPost({top: 20})
  const target = document.createElement('button')
  document.body.appendChild(target)
  let top = 300
  target.getBoundingClientRect = () => ({
    top,
    bottom: top + 30,
    left: 100,
    right: 130,
    width: 30,
    height: 30,
    x: 100,
    y: top,
    toJSON() {},
  })
  const root = createRoot(post)
  const renderPicker = (isOpen: boolean) => {
    const control = {
      id: 'account-picker',
      ref: {current: null},
      isOpen,
      open: jest.fn(),
      close: jest.fn(),
    }
    act(() => {
      root.render(
        createElement(EphemeralAccountPicker, {
          control,
          request: {target, title: 'Reply as', onSelectAccount: jest.fn()},
          accounts: [],
          signOutPromptControl: control,
        }),
      )
    })
  }

  try {
    renderPicker(true)
    const trigger = post.querySelector<HTMLElement>('[aria-haspopup="menu"]')
    expect(trigger?.style.top).toBe('300px')
    renderPicker(false)
    top = 120
    renderPicker(true)
    expect(trigger?.style.top).toBe('120px')
  } finally {
    act(() => root.unmount())
    post.remove()
    target.remove()
  }
})

describe('post keyboard navigation', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('returns rendered posts in visual order', () => {
    const second = createPost({top: 200})
    const first = createPost({top: 20})
    createPost({top: 0, left: window.innerWidth + 100})

    expect(getNavigablePosts()).toEqual([first, second])
  })

  it('finds the first post visible in the viewport', () => {
    createPost({top: -200})
    const firstVisible = createPost({top: -50})
    createPost({top: 100})

    expect(getInitialVisiblePost(getNavigablePosts())).toBe(firstVisible)
  })

  it('marks selection and invokes a post control', () => {
    const post = createPost({top: 20})
    const like = document.createElement('button')
    const onLike = jest.fn()
    like.dataset.testid = 'likeBtn'
    like.addEventListener('click', onLike)
    post.appendChild(like)

    setPostSelected(post, true)
    expect(post.dataset.keyboardNavigationSelected).toBe('true')
    expect(clickPostAction(post, 'like')).toBe(true)
    expect(onLike).toHaveBeenCalledTimes(1)

    setPostSelected(post, false)
    expect(post.dataset.keyboardNavigationSelected).toBeUndefined()
  })
})

it('opens image media using the existing embed control', () => {
  const post = createPost({top: 20})
  const embed = document.createElement('div')
  embed.className = 'wsky-post__media'
  const button = document.createElement('button')
  button.setAttribute('role', 'button')
  const open = jest.fn()
  button.addEventListener('click', open)
  embed.appendChild(button)
  post.appendChild(embed)
  expect(clickPostAction(post, 'media')).toBe(true)
  expect(open).toHaveBeenCalledTimes(1)
})

it('does not perform an interaction when its dropdown is unavailable', () => {
  const post = createPost({top: 20})
  const button = document.createElement('button')
  button.dataset.testid = 'likeBtn'
  const like = jest.fn()
  button.addEventListener('click', like)
  post.appendChild(button)

  expect(clickPostAction(post, 'like', true)).toBe(false)
  expect(like).not.toHaveBeenCalled()
})

it('requests the account dropdown with a shifted click', () => {
  const post = createPost({top: 20})
  const button = document.createElement('button')
  button.dataset.testid = 'postBookmarkBtn'
  button.dataset.keyboardDropdown = 'true'
  const open = jest.fn()
  button.addEventListener('click', event => open(event.shiftKey))
  post.appendChild(button)

  expect(clickPostAction(post, 'save', true)).toBe(true)
  expect(open).toHaveBeenCalledWith(true)
})

it('opens the repost menu without reposting when shifted', () => {
  const post = createPost({top: 20})
  const button = document.createElement('button')
  button.dataset.testid = 'repostBtn'
  const openMenu = jest.fn()
  button.addEventListener('click', openMenu)
  post.appendChild(button)

  expect(clickPostAction(post, 'repost', true)).toBe(true)
  expect(openMenu).toHaveBeenCalledTimes(1)
})

it.each([
  ['repost', false],
  ['quote', false],
  ['quote', true],
] as const)(
  'dispatches %s (switcher: %s) without opening the post menu',
  (action, dropdown) => {
    const post = createPost({top: 20})
    const button = document.createElement('button')
    button.dataset.testid = 'repostBtn'
    const openMenu = jest.fn()
    const runAction = jest.fn()
    button.addEventListener('click', openMenu)
    post.addEventListener(POST_KEYBOARD_ACTION_EVENT, event => {
      event.preventDefault()
      runAction((event as CustomEvent).detail)
    })
    post.appendChild(button)

    expect(clickPostAction(post, action, dropdown)).toBe(true)
    expect(runAction).toHaveBeenCalledWith({
      action,
      openAccountSwitcher: dropdown,
    })
    expect(openMenu).not.toHaveBeenCalled()
  },
)

it.each([
  ['repost', false, false],
  ['quote', false, false],
  ['quote', true, false],
  ['quote', false, true],
] as const)(
  'connects the web repost control to %s (switcher: %s, quote disabled: %s)',
  (action, dropdown, embeddingDisabled) => {
    const post = createPost({top: 20})
    const root = createRoot(post)
    const onRepost = jest.fn()
    const onQuote = jest.fn()

    try {
      act(() => {
        root.render(
          createElement(RepostButton, {
            isReposted: false,
            onRepost,
            onQuote,
            embeddingDisabled,
          }),
        )
      })
      act(() => {
        clickPostAction(post, action, dropdown)
      })

      if (action === 'repost') {
        expect(onRepost).toHaveBeenCalledTimes(1)
        expect(onQuote).not.toHaveBeenCalled()
      } else if (embeddingDisabled) {
        expect(onQuote).not.toHaveBeenCalled()
      } else {
        expect(onQuote).toHaveBeenCalledTimes(1)
        expect(onQuote).toHaveBeenCalledWith(dropdown)
        expect(onRepost).not.toHaveBeenCalled()
      }
    } finally {
      act(() => root.unmount())
      post.remove()
    }
  },
)

it('activates the video play control and then focuses the player', () => {
  const post = createPost({top: 20})
  const video = document.createElement('div')
  video.dataset.testid = 'postVideoFocusTarget'
  video.tabIndex = -1
  const play = document.createElement('button')
  play.dataset.testid = 'postMediaOpenBtn'
  const click = jest.fn()
  play.addEventListener('click', click)
  video.appendChild(play)
  post.appendChild(video)

  expect(clickPostAction(post, 'media')).toBe(true)
  expect(document.activeElement).toBe(video)
  expect(click).toHaveBeenCalledTimes(1)
})

it('keeps video focus after the media picker restores focus to the post', () => {
  jest.useFakeTimers()
  try {
    const post = createPost({top: 20})
    post.tabIndex = -1
    post.innerHTML = `
      <div data-keyboard-navigation-embed-target="media">
        <div data-testid="postVideoFocusTarget" tabindex="-1">
          <button data-testid="postMediaOpenBtn">Play</button>
        </div>
      </div>
      <div data-keyboard-navigation-embed-target="quote">
        <button data-testid="quotedPostOpenBtn">Quote</button>
      </div>
    `
    const player = post.querySelector<HTMLElement>(
      '[data-testid="postVideoFocusTarget"]',
    )!
    const targets = getPostMediaTargets(post)
    expect(targets).toHaveLength(2)
    const play = jest.fn()
    targets[0].control.addEventListener('click', play)

    // Dialog.close runs the chosen action before Radix restores trigger focus.
    setTimeout(() => openPostMediaTarget(targets[0]))
    setTimeout(() => post.focus())
    jest.advanceTimersByTime(1)
    expect(document.activeElement).toBe(post)
    jest.runAllTimers()
    expect(document.activeElement).toBe(player)
    expect(play).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
})

it('focuses the video even when playback replaces the clicked control', () => {
  jest.useFakeTimers()
  try {
    const post = createPost({top: 20})
    post.innerHTML = `
      <div data-testid="postVideoFocusTarget" tabindex="-1">
        <button data-testid="postMediaOpenBtn">Play</button>
      </div>
    `
    const player = post.querySelector<HTMLElement>(
      '[data-testid="postVideoFocusTarget"]',
    )!
    const play = player.querySelector('button')!
    play.addEventListener('click', () => play.remove())

    expect(clickPostAction(post, 'media')).toBe(true)
    expect(document.activeElement).toBe(player)
    player.remove()
    const focus = jest.spyOn(player, 'focus')
    jest.runAllTimers()
    expect(focus).not.toHaveBeenCalled()
    focus.mockRestore()
  } finally {
    jest.useRealTimers()
  }
})

it('uses the external player control so consent can be requested before playback', () => {
  const post = createPost({top: 20})
  const link = document.createElement('a')
  link.dataset.testid = 'postEmbedOpenBtn'
  const play = document.createElement('button')
  play.dataset.testid = 'postMediaOpenBtn'
  const consent = jest.fn()
  const openLink = jest.fn()
  play.addEventListener('click', event => {
    event.preventDefault()
    consent()
  })
  link.addEventListener('click', event => {
    if (!event.defaultPrevented) openLink()
  })
  link.appendChild(play)
  post.appendChild(link)

  expect(clickPostAction(post, 'media')).toBe(true)
  expect(consent).toHaveBeenCalledTimes(1)
  expect(openLink).not.toHaveBeenCalled()
})

it('opens the embed link without activating unrelated post controls', () => {
  const post = createPost({top: 20})
  const unrelated = document.createElement('button')
  unrelated.setAttribute('role', 'button')
  const interact = jest.fn()
  unrelated.addEventListener('click', interact)
  post.appendChild(unrelated)
  const embed = document.createElement('div')
  embed.dataset.keyboardNavigationEmbed = ''
  const link = document.createElement('a')
  link.href = '#embed'
  const open = jest.fn((event: MouseEvent) => event.preventDefault())
  link.addEventListener('click', open)
  embed.appendChild(link)
  post.appendChild(embed)

  expect(clickPostAction(post, 'media')).toBe(true)
  expect(open).toHaveBeenCalledTimes(1)
  expect(interact).not.toHaveBeenCalled()
})

it('focuses an already loaded external player', () => {
  const post = createPost({top: 20})
  const embed = document.createElement('div')
  embed.dataset.keyboardNavigationEmbed = ''
  const frame = document.createElement('iframe')
  embed.appendChild(frame)
  post.appendChild(embed)

  expect(clickPostAction(post, 'media')).toBe(true)
  expect(document.activeElement).toBe(frame)
})

it.each([
  ['l', 'PostLikedBy'],
  ['t', 'PostRepostedBy'],
  ['q', 'PostQuotes'],
])('resolves the selected post’s %s activity page', (key, name) => {
  const post = createPost({top: 20})
  post.dataset.keyboardNavigationPost =
    'at://did:plc:author/app.bsky.feed.post/record'
  expect(getPostActivityRoute(post, key)).toEqual({
    name,
    params: {name: 'did:plc:author', rkey: 'record'},
  })
})

it('ignores unsupported activity keys and invalid post URIs', () => {
  const post = createPost({top: 20})
  expect(getPostActivityRoute(post, 'l')).toBeUndefined()
  post.dataset.keyboardNavigationPost =
    'at://did:plc:author/app.bsky.feed.post/record'
  expect(getPostActivityRoute(post, 's')).toBeUndefined()
  post.dataset.keyboardNavigationPost =
    'at://did:plc:author/app.bsky.feed.like/record'
  expect(getPostActivityRoute(post, 'l')).toBeUndefined()
})

it.each([
  ['KeyL', '¬', 'PostLikedBy'],
  ['KeyT', '†', 'PostRepostedBy'],
  ['KeyQ', 'œ', 'PostQuotes'],
])('handles macOS Option with AltGraph for %s', (code, key, name) => {
  const post = createPost({top: 20})
  post.dataset.keyboardNavigationPost =
    'at://did:plc:author/app.bsky.feed.post/record'
  const event = new KeyboardEvent('keydown', {
    code,
    key,
    altKey: true,
    modifierAltGraph: true,
  })
  expect(event.getModifierState('AltGraph')).toBe(true)
  expect(getPostActivityShortcut(post, event)).toEqual({
    name,
    params: {name: 'did:plc:author', rkey: 'record'},
  })
})

it.each([
  {ctrlKey: true},
  {metaKey: true},
  {shiftKey: true},
  {repeat: true},
  {altKey: false},
])('ignores other modifiers and repeats: %j', modifiers => {
  const post = createPost({top: 20})
  post.dataset.keyboardNavigationPost =
    'at://did:plc:author/app.bsky.feed.post/record'
  const event = new KeyboardEvent('keydown', {
    code: 'KeyL',
    key: 'l',
    altKey: true,
    ...modifiers,
  })
  expect(getPostActivityShortcut(post, event)).toBeUndefined()
})

it.each(['image', 'video', 'link', 'nested quote'])(
  'opens the quoted child post instead of its %s',
  kind => {
    const post = createPost({top: 20})
    const quote = document.createElement('a')
    quote.dataset.testid = 'quotedPostOpenBtn'
    quote.href = '#quoted-post'
    const openQuote = jest.fn((event: MouseEvent) => event.preventDefault())
    quote.addEventListener('click', openQuote)
    const embed = document.createElement('div')
    embed.className = 'wsky-post__media'
    embed.dataset.keyboardNavigationEmbed = ''
    const child = document.createElement('button')
    child.setAttribute('role', 'button')
    child.dataset.testid =
      kind === 'nested quote'
        ? 'quotedPostOpenBtn'
        : kind === 'link'
          ? 'postEmbedOpenBtn'
          : kind === 'video'
            ? 'postMediaOpenBtn'
            : ''
    const openChildEmbed = jest.fn()
    child.addEventListener('click', openChildEmbed)
    embed.appendChild(child)
    quote.appendChild(embed)
    post.appendChild(quote)

    expect(clickPostAction(post, 'media')).toBe(true)
    expect(openQuote).toHaveBeenCalledTimes(1)
    expect(openChildEmbed).not.toHaveBeenCalled()
  },
)

it('offers each top-level attachment without exposing a quoted post’s media', () => {
  const post = createPost({top: 20})
  const controls: HTMLButtonElement[] = []
  const actions = [jest.fn(), jest.fn(), jest.fn()]
  const kinds = ['media', 'embed', 'quote'] as const
  const ids = ['postMediaOpenBtn', 'postEmbedOpenBtn', 'quotedPostOpenBtn']
  for (const [index, kind] of kinds.entries()) {
    const boundary = document.createElement('div')
    boundary.dataset.keyboardNavigationEmbedTarget = kind
    const button = document.createElement('button')
    button.dataset.testid = ids[index]
    button.addEventListener('click', actions[index])
    boundary.appendChild(button)
    post.appendChild(boundary)
    controls.push(button)
  }
  const nested = document.createElement('div')
  nested.dataset.keyboardNavigationEmbedTarget = 'media'
  const nestedMedia = document.createElement('button')
  nestedMedia.dataset.testid = 'postMediaOpenBtn'
  const playNestedMedia = jest.fn()
  nestedMedia.addEventListener('click', playNestedMedia)
  nested.appendChild(nestedMedia)
  controls[2].appendChild(nested)

  const targets = getPostMediaTargets(post)
  expect(targets.map(target => target.kind)).toEqual(kinds)
  expect(targets.map(target => target.control)).toEqual(controls)
  expect(clickPostAction(post, 'media')).toBe(false)
  expect(actions.every(action => action.mock.calls.length === 0)).toBe(true)
  expect(openPostMediaTarget(targets[1])).toBe(true)
  expect(actions[1]).toHaveBeenCalledTimes(1)
  expect(actions[0]).not.toHaveBeenCalled()
  expect(actions[2]).not.toHaveBeenCalled()
  expect(playNestedMedia).not.toHaveBeenCalled()
})

it('ignores unavailable attachments and stale choices', () => {
  const post = createPost({top: 20})
  const boundary = document.createElement('div')
  boundary.dataset.keyboardNavigationEmbedTarget = 'media'
  const button = document.createElement('button')
  button.dataset.testid = 'postMediaOpenBtn'
  button.disabled = true
  boundary.appendChild(button)
  post.appendChild(boundary)
  expect(getPostMediaTargets(post)).toEqual([])
  button.disabled = false
  const [target] = getPostMediaTargets(post)
  const play = jest.fn()
  button.addEventListener('click', play)
  post.remove()
  expect(openPostMediaTarget(target)).toBe(false)
  expect(play).not.toHaveBeenCalled()
})

it('opens a quote alone without offering its nested media as another choice', () => {
  const post = createPost({top: 20})
  const quote = document.createElement('div')
  quote.dataset.keyboardNavigationEmbedTarget = 'quote'
  const link = document.createElement('a')
  link.dataset.testid = 'quotedPostOpenBtn'
  const nested = document.createElement('div')
  nested.dataset.keyboardNavigationEmbedTarget = 'media'
  const button = document.createElement('button')
  button.dataset.testid = 'postMediaOpenBtn'
  nested.appendChild(button)
  link.appendChild(nested)
  quote.appendChild(link)
  post.appendChild(quote)
  const open = jest.fn()
  link.addEventListener('click', open)

  expect(getPostMediaTargets(post)).toEqual([{kind: 'quote', control: link}])
  expect(clickPostAction(post, 'media')).toBe(true)
  expect(open).toHaveBeenCalledTimes(1)
})

it('resolves P to the selected post author’s profile', () => {
  const post = createPost({top: 20})
  post.dataset.keyboardNavigationPost =
    'at://did:plc:author/app.bsky.feed.post/record'
  expect(getPostAuthorRoute(post)).toEqual({
    name: 'Profile',
    params: {name: 'did:plc:author'},
  })
  post.dataset.keyboardNavigationPost = 'invalid'
  expect(getPostAuthorRoute(post)).toBeUndefined()
})

describe('page keyboard navigation', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('includes rows and section toggles in visual order without nested posts', () => {
    const post = createPost({top: 10})
    const row = createPost({top: 120})
    delete row.dataset.keyboardNavigationPost
    row.dataset.keyboardNavigationItem = 'true'
    const nested = createPost({top: 140})
    row.appendChild(nested)
    const heading = createPost({top: 250})
    delete heading.dataset.keyboardNavigationPost
    heading.dataset.keyboardNavigationItem = 'true'

    expect(getNavigablePosts()).toEqual([post, row, heading])
  })

  it('excludes rows in inactive screens', () => {
    const hidden = createPost({top: 10})
    const screen = document.createElement('div')
    screen.setAttribute('aria-hidden', 'true')
    document.body.appendChild(screen)
    screen.appendChild(hidden)
    const visible = createPost({top: 20})

    expect(getNavigablePosts()).toEqual([visible])
  })

  it('switches and wraps page tabs, including horizontally scrolled tabs', () => {
    const bar = createPost({top: 0})
    delete bar.dataset.keyboardNavigationPost
    bar.dataset.keyboardNavigationTabs = 'true'
    const tabs = Array.from({length: 3}, (_, index) => {
      const tab = document.createElement('button')
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(index === 0))
      tab.addEventListener('click', () => {
        tabs.forEach(item =>
          item.setAttribute('aria-selected', String(item === tab)),
        )
      })
      bar.appendChild(tab)
      return tab
    })
    expect(switchPageTab(-1)).toBe(true)
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')
    expect(switchPageTab(1)).toBe(true)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    tabs[1].setAttribute('aria-disabled', 'true')
    switchPageTab(1)
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')
    bar.setAttribute('aria-hidden', 'true')
    expect(switchPageTab(1)).toBe(false)
  })

  it('leaves unrelated tab controls alone', () => {
    const bar = createPost({top: 0})
    bar.setAttribute('role', 'tablist')
    expect(switchPageTab(1)).toBe(false)
  })
})

it('navigates settings controls, skipping disabled controls and nested targets', () => {
  document.body.replaceChildren()
  const settings = document.createElement('div')
  settings.dataset.keyboardNavigationSettings = 'true'
  document.body.appendChild(settings)
  const link = createPost({top: 20})
  delete link.dataset.keyboardNavigationPost
  link.setAttribute('role', 'link')
  settings.appendChild(link)
  const nested = createPost({top: 25})
  delete nested.dataset.keyboardNavigationPost
  nested.setAttribute('role', 'button')
  link.appendChild(nested)
  const toggle = createPost({top: 100})
  delete toggle.dataset.keyboardNavigationPost
  toggle.setAttribute('role', 'checkbox')
  settings.appendChild(toggle)
  const disabled = createPost({top: 200})
  delete disabled.dataset.keyboardNavigationPost
  disabled.setAttribute('role', 'button')
  disabled.setAttribute('aria-disabled', 'true')
  settings.appendChild(disabled)
  const outside = createPost({top: 300})
  delete outside.dataset.keyboardNavigationPost
  outside.setAttribute('role', 'button')
  expect(getNavigablePosts()).toEqual([link, toggle])
})

it('opens the selected post menu without activating the post', () => {
  const post = createPost({top: 20})
  const menu = document.createElement('button')
  menu.dataset.testid = 'postDropdownBtn'
  const onClick = jest.fn()
  menu.addEventListener('click', onClick)
  post.appendChild(menu)

  expect(clickPostAction(post, 'menu')).toBe(true)
  expect(onClick).toHaveBeenCalledTimes(1)

  menu.setAttribute('aria-disabled', 'true')
  expect(clickPostAction(post, 'menu')).toBe(false)
  expect(onClick).toHaveBeenCalledTimes(1)
})

it('keeps split-view chat navigation in the focused pane', () => {
  document.body.replaceChildren()
  const chat = createPost({top: 20})
  delete chat.dataset.keyboardNavigationPost
  chat.dataset.keyboardNavigationItem = 'true'
  chat.dataset.keyboardNavigationScope = 'chats'
  chat.tabIndex = 0
  const message = createPost({top: 30, left: 500})
  delete message.dataset.keyboardNavigationPost
  message.dataset.keyboardNavigationItem = 'true'
  message.dataset.keyboardNavigationScope = 'messages'
  message.tabIndex = -1
  const nextMessage = createPost({top: 140, left: 500})
  delete nextMessage.dataset.keyboardNavigationPost
  nextMessage.dataset.keyboardNavigationItem = 'true'
  nextMessage.dataset.keyboardNavigationScope = 'messages'

  expect(getNavigablePosts()).toEqual([message, nextMessage])
  chat.focus()
  expect(getNavigablePosts()).toEqual([chat])
  message.focus()
  expect(getNavigablePosts()).toEqual([message, nextMessage])
})

it('navigates chats when no conversation is open', () => {
  document.body.replaceChildren()
  const chat = createPost({top: 20})
  delete chat.dataset.keyboardNavigationPost
  chat.dataset.keyboardNavigationItem = 'true'
  chat.dataset.keyboardNavigationScope = 'chats'

  expect(getNavigablePosts()).toEqual([chat])
})

it('opens a chat message embed without following links in the message text', () => {
  document.body.replaceChildren()
  const message = createPost({top: 20})
  delete message.dataset.keyboardNavigationPost
  message.dataset.keyboardNavigationItem = 'true'
  message.dataset.keyboardNavigationScope = 'messages'
  message.innerHTML = `
    <a href="https://example.com">message text link</a>
    <div data-keyboard-navigation-embed>
      <div data-keyboard-navigation-embed-target="quote">
        <button data-testid="quotedPostOpenBtn">embedded post</button>
      </div>
    </div>
  `
  const embeddedPost = message.querySelector('button')!
  const onOpen = jest.fn()
  embeddedPost.addEventListener('click', onOpen)

  const targets = getPostMediaTargets(message)
  expect(targets).toEqual([{kind: 'quote', control: embeddedPost}])
  expect(openPostMediaTarget(targets[0])).toBe(true)
  expect(onOpen).toHaveBeenCalledTimes(1)

  message.querySelector('[data-keyboard-navigation-embed]')!.remove()
  expect(getPostMediaTargets(message)).toEqual([])
})

it('navigates standalone warnings without adding targets inside posts', () => {
  document.body.replaceChildren()
  const warning = createPost({top: 20})
  delete warning.dataset.keyboardNavigationPost
  warning.dataset.keyboardNavigationItem = 'true'
  warning.dataset.keyboardNavigationWarning = 'true'
  const post = createPost({top: 100})
  const nestedWarning = createPost({top: 150})
  delete nestedWarning.dataset.keyboardNavigationPost
  nestedWarning.dataset.keyboardNavigationItem = 'true'
  nestedWarning.dataset.keyboardNavigationWarning = 'true'
  post.appendChild(nestedWarning)
  const nestedPost = createPost({top: 200})
  post.appendChild(nestedPost)

  expect(getNavigablePosts()).toEqual([warning, post])
  nestedWarning.setAttribute('aria-hidden', 'true')
  expect(getNavigablePosts()).toEqual([warning, post])
})

it('reveals an embed warning before opening the quoted post', () => {
  document.body.replaceChildren()
  const post = createPost({top: 20})
  post.innerHTML = `
    <div data-keyboard-navigation-embed>
      <div data-keyboard-navigation-embed-target="quote">
        <button role="button" data-keyboard-navigation-warning="true">Show</button>
        <button role="button" data-testid="warningDetails">Learn more</button>
      </div>
    </div>
  `
  const container = post.querySelector(
    '[data-keyboard-navigation-embed-target]',
  )!
  const warning = container.querySelector('button')!
  const onDetails = jest.fn()
  container
    .querySelector('[data-testid="warningDetails"]')!
    .addEventListener('click', onDetails)
  const onOpen = jest.fn()
  warning.addEventListener('click', () => {
    warning.setAttribute('aria-expanded', 'true')
    const quote = document.createElement('button')
    quote.dataset.testid = 'quotedPostOpenBtn'
    quote.addEventListener('click', onOpen)
    container.appendChild(quote)
  })

  expect(openPostMediaTarget(getPostMediaTargets(post)[0])).toBe(true)
  expect(onOpen).not.toHaveBeenCalled()
  expect(openPostMediaTarget(getPostMediaTargets(post)[0])).toBe(true)
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onDetails).not.toHaveBeenCalled()
})

it.each(['postMediaOpenBtn', 'postEmbedOpenBtn', 'quotedPostOpenBtn'])(
  'opens %s from the selected label after revealing its content',
  testID => {
    const container = document.createElement('div')
    const warning = document.createElement('button')
    warning.dataset.keyboardNavigationWarning = 'true'
    warning.setAttribute('aria-expanded', 'false')
    container.appendChild(warning)
    document.body.appendChild(container)
    const onOpen = jest.fn()
    warning.addEventListener('click', () => {
      warning.setAttribute('aria-expanded', 'true')
      const attachment = document.createElement('button')
      attachment.dataset.testid = testID
      attachment.addEventListener('click', onOpen)
      container.appendChild(attachment)
    })

    expect(clickPostAction(warning, 'media')).toBe(true)
    expect(onOpen).not.toHaveBeenCalled()
    expect(clickPostAction(warning, 'media')).toBe(true)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(warning.getAttribute('aria-expanded')).toBe('true')
  },
)

it('recovers the revealed post when its selected warning is replaced', () => {
  document.body.replaceChildren()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const warning = createPost({top: 20})
  delete warning.dataset.keyboardNavigationPost
  warning.dataset.keyboardNavigationItem = 'true'
  warning.dataset.keyboardNavigationWarning = 'true'
  container.appendChild(warning)
  const unrelated = createPost({top: 0})

  expect(getRevealedPostWarning(warning, container)).toBeUndefined()
  const revealed = createPost({top: 20})
  container.replaceChildren(revealed)
  expect(getRevealedPostWarning(warning, container)).toBe(revealed)
  revealed.remove()
  expect(getRevealedPostWarning(warning, container)).toBeUndefined()
  expect(unrelated.isConnected).toBe(true)
})

it('opens revealed media from a stale chooser target without collapsing its label', () => {
  const post = createPost({top: 20})
  post.innerHTML = `
    <div data-keyboard-navigation-embed-target="media">
      <button data-keyboard-navigation-warning="true" aria-expanded="false">Show</button>
    </div>
  `
  const warning = post.querySelector<HTMLButtonElement>('button')!
  const target = getPostMediaTargets(post)[0]
  const onWarning = jest.fn()
  warning.addEventListener('click', onWarning)
  warning.setAttribute('aria-expanded', 'true')
  const media = document.createElement('button')
  media.dataset.testid = 'postMediaOpenBtn'
  const onOpen = jest.fn()
  media.addEventListener('click', onOpen)
  warning.parentElement!.appendChild(media)

  expect(openPostMediaTarget(target)).toBe(true)
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onWarning).not.toHaveBeenCalled()
})

it('never collapses a revealed label when no attachment is available', () => {
  const container = document.createElement('div')
  const warning = document.createElement('button')
  warning.dataset.keyboardNavigationWarning = 'true'
  container.appendChild(warning)
  document.body.appendChild(container)
  const target = getPostMediaTargets(warning)[0]
  warning.setAttribute('aria-expanded', 'true')
  const onWarning = jest.fn()
  warning.addEventListener('click', onWarning)

  expect(openPostMediaTarget(target)).toBe(false)
  expect(onWarning).not.toHaveBeenCalled()
})

it.each(['quotedPostOpenBtn', 'postMediaOpenBtn', 'postEmbedOpenBtn'])(
  'opens %s before an unrelated post warning',
  testID => {
    document.body.replaceChildren()
    const post = createPost({top: 20})
    post.innerHTML = `
      <button data-keyboard-navigation-warning="true" aria-expanded="false">Show</button>
      <div data-keyboard-navigation-embed-target="media">
        <button data-testid="${testID}">Open attachment</button>
      </div>
    `
    const warning = post.querySelector<HTMLButtonElement>(
      '[data-keyboard-navigation-warning]',
    )!
    const attachment = post.querySelector<HTMLButtonElement>(
      `[data-testid="${testID}"]`,
    )!
    const onOpen = jest.fn()
    const onWarning = jest.fn()
    attachment.addEventListener('click', onOpen)
    warning.addEventListener('click', onWarning)

    expect(getPostMediaTargets(post).map(target => target.control)).toEqual([
      attachment,
    ])
    expect(clickPostAction(post, 'media')).toBe(true)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onWarning).not.toHaveBeenCalled()

    attachment.remove()
    expect(clickPostAction(post, 'media')).toBe(true)
    expect(onWarning).toHaveBeenCalledTimes(1)
  },
)

it('opens standalone warnings, including warnings that only show details', () => {
  const warning = document.createElement('button')
  warning.dataset.keyboardNavigationWarning = 'true'
  document.body.appendChild(warning)
  const onOpen = jest.fn()
  warning.addEventListener('click', onOpen)

  expect(clickPostAction(warning, 'media')).toBe(true)
  expect(onOpen).toHaveBeenCalledTimes(1)
  warning.disabled = true
  expect(clickPostAction(warning, 'media')).toBe(false)
})

it('ignores revealed and hidden warnings inside embeds', () => {
  const post = createPost({top: 20})
  post.innerHTML = `
    <div data-keyboard-navigation-embed>
      <button role="button" data-keyboard-navigation-warning="true" aria-expanded="true">Hide</button>
      <div aria-hidden="true">
        <button data-keyboard-navigation-warning="true">Show</button>
      </div>
    </div>
  `
  expect(getPostMediaTargets(post)).toEqual([])
})

it('opens a revealed quote before reaching warnings inside that quote', () => {
  const post = createPost({top: 20})
  post.innerHTML = `
    <div data-keyboard-navigation-embed-target="quote">
      <div data-testid="quotedPostOpenBtn">
        <button data-keyboard-navigation-warning="true">Show quoted media</button>
      </div>
    </div>
  `
  expect(getPostMediaTargets(post).map(target => target.control)).toEqual([
    post.querySelector('[data-testid="quotedPostOpenBtn"]'),
  ])
})
