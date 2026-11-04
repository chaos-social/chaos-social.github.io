import {EVENT_COLLECTION} from './types'

export type EventRef = {actor: string; rkey: string}

const RKEY_RE = /^[a-zA-Z0-9._:~-]{1,512}$/

/** Our own `web` domain, so witchsky.app event links from anyone resolve to a card. */
const OWN_HOSTS = new Set(['witchsky.app'])

/**
 * Recognises event links from witchsky, Blacksky, atmo.rsvp and Smoke Signal
 * so they all render as the same card.
 */
export function parseEventUrl(url: string): EventRef | undefined {
  let urlp: URL
  try {
    urlp = new URL(url)
  } catch {
    return
  }
  const host = urlp.hostname.replace(/^www\./, '')
  const isOwn = OWN_HOSTS.has(host) || host === 'blacksky.community'
  if (!isOwn && host !== 'atmo.rsvp' && host !== 'smokesignal.events') return
  let parts: string[]
  try {
    parts = urlp.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return
  }
  let ref: EventRef | undefined
  if (isOwn && parts.length === 4 && parts[0] === 'profile' && parts[2] === 'event') {
    ref = {actor: parts[1], rkey: parts[3]}
  } else if (isOwn && parts.length === 3 && parts[0] === 'event') {
    // Pre-standard links, still shared by Blacksky.
    ref = {actor: parts[1], rkey: parts[2]}
  } else if (
    host === 'atmo.rsvp' &&
    parts.length >= 4 &&
    parts[0] === 'p' &&
    parts[2] === 'e'
  ) {
    ref = {actor: parts[1], rkey: parts[3]}
  } else if (host === 'smokesignal.events' && parts.length === 2) {
    ref = {actor: parts[0], rkey: parts[1]}
  }
  if (!ref || !RKEY_RE.test(ref.rkey)) return
  if (!ref.actor.startsWith('did:') && !ref.actor.includes('.')) return
  return ref
}

export function eventAtUri(did: string, rkey: string) {
  return `at://${did}/${EVENT_COLLECTION}/${rkey}`
}

export function makeEventLink(
  creator: {did: string; handle?: string},
  rkey: string,
) {
  const actor =
    creator.handle && creator.handle !== 'handle.invalid'
      ? creator.handle
      : creator.did
  return `/profile/${actor}/event/${rkey}`
}

/** Absolute counterpart of {@link makeEventLink}, for the post's link card. */
export function makeEventUrl(
  creator: {did: string; handle?: string},
  rkey: string,
) {
  return `https://witchsky.app${makeEventLink(creator, rkey)}`
}
