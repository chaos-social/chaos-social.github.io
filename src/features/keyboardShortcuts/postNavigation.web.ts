import {AtUri} from '@atproto/syntax'

import {POST_KEYBOARD_ACTION_EVENT} from './postActions.web'

// Adapted from eurosky-social/eurosky-social-app (MIT), eurosky/fork.
const SETTINGS_CONTROL_SELECTOR = [
  'a[href]',
  'button',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
]
  .map(selector => `[data-keyboard-navigation-settings] ${selector}`)
  .join(', ')
const POST_SELECTOR = `[data-keyboard-navigation-post], [data-keyboard-navigation-item], ${SETTINGS_CONTROL_SELECTOR}`
const SELECTED_ATTRIBUTE = 'data-keyboard-navigation-selected'

export type PostAction =
  'quote' | 'reply' | 'like' | 'repost' | 'save' | 'share' | 'media' | 'menu'

const ACTION_TEST_IDS: Record<PostAction, string> = {
  quote: 'repostBtn',
  reply: 'replyBtn',
  like: 'likeBtn',
  repost: 'repostBtn',
  save: 'postBookmarkBtn',
  share: 'postShareBtn',
  media: 'postMediaOpenBtn',
  menu: 'postDropdownBtn',
}

function isRendered(element: HTMLElement) {
  if (element.closest('[aria-hidden="true"], [inert]')) return false
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function isPostVisible(element: HTMLElement) {
  if (!element.isConnected || !isRendered(element)) return false

  const rect = element.getBoundingClientRect()
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  )
}

export function getNavigablePosts() {
  const items = Array.from(
    document.querySelectorAll<HTMLElement>(POST_SELECTOR),
  )
    .filter(isRendered)
    .filter(
      element =>
        element.getAttribute('aria-disabled') !== 'true' &&
        !element.matches(':disabled'),
    )
    .filter(element => !element.parentElement?.closest(POST_SELECTOR))
    .filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.right > 0 && rect.left < window.innerWidth
    })
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect()
      const bRect = b.getBoundingClientRect()
      return aRect.top - bRect.top || aRect.left - bRect.left
    })
  const focusedScope = document.activeElement?.closest<HTMLElement>(
    '[data-keyboard-navigation-scope]',
  )?.dataset.keyboardNavigationScope
  const scope =
    focusedScope ??
    (items.some(item => item.dataset.keyboardNavigationScope === 'messages')
      ? 'messages'
      : undefined)
  return scope
    ? items.filter(item => item.dataset.keyboardNavigationScope === scope)
    : items
}

export function getInitialVisiblePost(posts: HTMLElement[]) {
  return posts.find(isPostVisible)
}

export function setPostSelected(element: HTMLElement, selected: boolean) {
  if (selected) {
    element.setAttribute(SELECTED_ATTRIBUTE, 'true')
  } else {
    element.removeAttribute(SELECTED_ATTRIBUTE)
  }
}

export function clickPostAction(
  element: HTMLElement,
  action: PostAction,
  dropdown = false,
) {
  if (action === 'media') {
    const targets = getPostMediaTargets(element)
    return targets.length === 1 ? openPostMediaTarget(targets[0]) : false
  }
  const control = element.querySelector<HTMLElement>(
    `[data-testid="${ACTION_TEST_IDS[action]}"]`,
  )
  if (!control) return false

  if (control.getAttribute('aria-disabled') === 'true') return false
  if (action === 'quote' || (action === 'repost' && !dropdown)) {
    return !control.dispatchEvent(
      new CustomEvent(POST_KEYBOARD_ACTION_EVENT, {
        bubbles: true,
        cancelable: true,
        detail: {action, openAccountSwitcher: dropdown},
      }),
    )
  }
  if (dropdown) {
    if (control.dataset.keyboardDropdown === 'true') {
      control.dispatchEvent(
        new MouseEvent('click', {bubbles: true, shiftKey: true}),
      )
      return true
    }
    if (action === 'repost') {
      control.click()
      return true
    }
    return false
  }
  control.click()

  return true
}

export function clickPost(element: HTMLElement) {
  if (element.dataset.keyboardNavigationClickable === 'true') {
    element.click()
    return true
  }
  return false
}

export function getPostHref(element: HTMLElement) {
  return element.dataset.keyboardNavigationHref
}

export function getPostAnnouncement(element: HTMLElement) {
  return (element.getAttribute('aria-label') || element.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

export type PostMediaTarget = {
  kind: 'media' | 'embed' | 'quote'
  control: HTMLElement
}

const EMBED_TARGET_SELECTOR = '[data-keyboard-navigation-embed-target]'

/** Collect top-level attachments without reaching into a quoted post's embeds. */
export function getPostMediaTargets(element: HTMLElement): PostMediaTarget[] {
  if (
    element.dataset.keyboardNavigationWarning &&
    element.getAttribute('aria-expanded') === 'true' &&
    element.parentElement
  ) {
    element = element.parentElement
  }
  const boundaries = Array.from(
    element.querySelectorAll<HTMLElement>(EMBED_TARGET_SELECTOR),
  ).filter(boundary => {
    const parent = boundary.parentElement?.closest(EMBED_TARGET_SELECTOR)
    return !parent || !element.contains(parent)
  })
  const containers = boundaries.length ? boundaries : [element]
  const targets: PostMediaTarget[] = []
  const selectors = [
    '[data-testid="quotedPostOpenBtn"]',
    '[data-testid="postMediaOpenBtn"]',
    '[data-keyboard-navigation-embed] iframe',
    '[data-testid="postEmbedOpenBtn"]',
    '[data-keyboard-navigation-warning]:not([aria-expanded="true"])',
    '.wsky-post__media [role="button"]',
    '[data-keyboard-navigation-embed] a[href], [data-keyboard-navigation-embed] [role="link"], [data-keyboard-navigation-embed] [role="button"]',
  ]
  for (const container of containers) {
    for (const selector of selectors) {
      const control = Array.from(
        container.querySelectorAll<HTMLElement>(selector),
      ).find(
        candidate =>
          isControlAvailable(candidate) &&
          !candidate.closest('[aria-hidden="true"], [inert]') &&
          (!candidate.hasAttribute('data-keyboard-navigation-warning') ||
            candidate.getAttribute('aria-expanded') !== 'true') &&
          (!boundaries.length ||
            candidate.closest(EMBED_TARGET_SELECTOR) === container),
      )
      if (!control) continue
      const kind = container.dataset.keyboardNavigationEmbedTarget
      targets.push({
        control,
        kind:
          kind === 'quote' || kind === 'embed' || kind === 'media'
            ? kind
            : control.dataset.testid === 'quotedPostOpenBtn'
              ? 'quote'
              : control.dataset.testid === 'postMediaOpenBtn' ||
                  control.closest('.wsky-post__media')
                ? 'media'
                : 'embed',
      })
      break
    }
  }
  if (targets.length) return targets

  const warnings = [
    ...(element.matches('[data-keyboard-navigation-warning]') ? [element] : []),
    ...element.querySelectorAll<HTMLElement>(
      '[data-keyboard-navigation-warning]',
    ),
  ].filter(
    control =>
      control.getAttribute('aria-expanded') !== 'true' &&
      !control.closest('[aria-hidden="true"], [inert]') &&
      !control.closest('[data-testid="quotedPostOpenBtn"]') &&
      isControlAvailable(control),
  )
  return warnings.map(control => ({kind: 'embed', control}))
}

/** A post warning is replaced by the revealed post when its label is opened. */
export function getRevealedPostWarning(
  warning: HTMLElement,
  container: HTMLElement | null,
) {
  if (warning.isConnected || !warning.dataset.keyboardNavigationWarning) return
  return getNavigablePosts().find(post => container?.contains(post))
}

function isControlAvailable(control: HTMLElement) {
  return (
    control.getAttribute('aria-disabled') !== 'true' &&
    !control.matches(':disabled')
  )
}

/** Use the actual control so playback and external-media consent work as usual. */
export function openPostMediaTarget({control}: PostMediaTarget): boolean {
  if (!control.isConnected || !isControlAvailable(control)) return false
  if (
    control.dataset.keyboardNavigationWarning &&
    control.getAttribute('aria-expanded') === 'true'
  ) {
    const targets = getPostMediaTargets(control)
    return targets.length === 1 ? openPostMediaTarget(targets[0]) : false
  }
  if (control.tagName === 'IFRAME') {
    control.focus()
  } else {
    const player = control.closest<HTMLElement>(
      '[data-testid="postVideoFocusTarget"]',
    )
    control.click()
    if (player) {
      player.focus({preventScroll: true})
      /*
       * The picker's focus scope restores its trigger in a timeout after
       * closing. Focus again after that cleanup and React's playback updates.
       */
      requestAnimationFrame(() => {
        if (player.isConnected) player.focus({preventScroll: true})
      })
    }
  }
  return true
}

export function getPostAuthorRoute(element: HTMLElement) {
  const uri = element.dataset.keyboardNavigationPost
  if (!uri) return
  try {
    const post = new AtUri(uri)
    if (post.collection !== 'app.bsky.feed.post' || !post.rkey) return
    return {name: 'Profile' as const, params: {name: post.host}}
  } catch {
    return
  }
}

export function getPostActivityRoute(element: HTMLElement, key: string) {
  const routes = {
    l: 'PostLikedBy',
    t: 'PostRepostedBy',
    q: 'PostQuotes',
  } as const
  if (key !== 'l' && key !== 't' && key !== 'q') return
  const uri = element.dataset.keyboardNavigationPost
  if (!uri) return
  try {
    const post = new AtUri(uri)
    if (post.collection !== 'app.bsky.feed.post' || !post.rkey) return
    return {name: routes[key], params: {name: post.host, rkey: post.rkey}}
  } catch {
    return
  }
}

/** Option can also report AltGraph on macOS; altKey is the modifier we need. */
export function getPostActivityShortcut(
  element: HTMLElement,
  event: KeyboardEvent,
) {
  if (
    !event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat
  )
    return
  // Option may produce a symbol instead of the letter in event.key.
  const key = ['l', 't', 'q'].includes(event.key.toLowerCase())
    ? event.key.toLowerCase()
    : event.code.replace(/^Key/, '').toLowerCase()
  return getPostActivityRoute(element, key)
}

/** Switch the page's own tab bar, including tabs outside its scroll viewport. */
export function switchPageTab(direction: 1 | -1) {
  const tabBar = Array.from(
    document.querySelectorAll<HTMLElement>('[data-keyboard-navigation-tabs]'),
  ).find(element => {
    if (!isRendered(element)) return false
    const rect = element.getBoundingClientRect()
    return rect.right > 0 && rect.left < window.innerWidth
  })
  if (!tabBar) return false
  const tabs = Array.from(
    tabBar.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).filter(
    tab =>
      tab.getAttribute('aria-disabled') !== 'true' && !tab.matches(':disabled'),
  )
  const index = tabs.findIndex(
    tab => tab.getAttribute('aria-selected') === 'true',
  )
  if (index < 0 || tabs.length < 2) return false
  tabs[(index + direction + tabs.length) % tabs.length].click()
  return true
}
