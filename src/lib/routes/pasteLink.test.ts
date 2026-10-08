/** @jest-environment jsdom */
// eslint-disable-next-line import/no-nodejs-modules -- Restore a complete URL implementation in this Node-hosted test.
import {URL} from 'node:url'

import {handlePastedLink} from '#/lib/routes/pasteLink'

// The native Jest preset replaces the browser URL implementation.
const originalURL = Object.getOwnPropertyDescriptor(globalThis, 'URL')!
beforeAll(() => {
  Object.defineProperty(globalThis, 'URL', {configurable: true, value: URL})
})
afterAll(() => {
  Object.defineProperty(globalThis, 'URL', originalURL)
})

const openLink = jest.fn()
const onPaste = (event: Event) =>
  handlePastedLink(event as ClipboardEvent, openLink)

function paste(text: string, target: Element = document.body, handled = false) {
  const event = new Event('paste', {bubbles: true, cancelable: true})
  Object.defineProperty(event, 'clipboardData', {
    value: {getData: () => text},
  })
  if (handled) event.preventDefault()
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  openLink.mockClear()
  document.body.innerHTML = ''
  document.addEventListener('paste', onPaste)
})

afterEach(() => {
  document.removeEventListener('paste', onPaste)
})

it.each([
  'https://witchsky.app/profile/alice.bsky.social/post/3abc',
  'https://mu.social/profile/alice.bsky.social/post/3abc',
  'https://blacksky.community/profile/alice.bsky.social/post/3abc',
  'https://northsky.app/profile/alice.bsky.social/post/3abc',
  'at://alice.bsky.social/app.bsky.feed.post/3abc',
])('opens a pasted content link: %s', text => {
  expect(paste(text).defaultPrevented).toBe(true)
  expect(openLink).toHaveBeenCalledWith({
    screen: 'PostThread',
    params: {name: 'alice.bsky.social', rkey: '3abc'},
  })
})

it.each([
  '<input />',
  '<textarea></textarea>',
  '<select></select>',
  '<div contenteditable="true"><span>editor</span></div>',
  '<div role="textbox"><span>editor</span></div>',
  '<div role="searchbox"></div>',
  '<div role="combobox"></div>',
])('preserves editor pastes: %s', html => {
  document.body.innerHTML = html
  const target =
    document.body.querySelector('span') ?? document.body.firstElementChild!
  expect(paste('at://alice.bsky.social', target).defaultPrevented).toBe(false)
  expect(openLink).not.toHaveBeenCalled()
})

it('preserves pastes when a text field has focus', () => {
  document.body.innerHTML = '<input />'
  document.querySelector('input')!.focus()
  expect(paste('at://alice.bsky.social').defaultPrevented).toBe(false)
  expect(openLink).not.toHaveBeenCalled()
})

it.each([
  '<div role="dialog"><button>composer toolbar</button></div>',
  '<div role="alertdialog"></div>',
  '<div aria-modal="true"></div>',
  '<dialog open></dialog>',
])('does not navigate while a prompt is open: %s', html => {
  document.body.innerHTML = html
  expect(paste('at://alice.bsky.social').defaultPrevented).toBe(false)
  expect(openLink).not.toHaveBeenCalled()
})

it('ignores handled pastes and unsupported text', () => {
  paste('at://alice.bsky.social', document.body, true)
  for (const text of ['', 'hello', 'https://example.com', 'at://invalid']) {
    expect(paste(text).defaultPrevented).toBe(false)
  }
  expect(openLink).not.toHaveBeenCalled()
})
