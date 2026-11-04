import {isValidHandle} from '#/lib/strings/handles'
import {type app} from '#/lexicons'
import {eventPhase} from './format'
import {type ParsedEvent} from './record'

const LIVE_GRACE_MS = 60 * 60 * 1000

/** The stream.place channel an event link points at, by DID or handle. */
export function parseStreamplaceActor(url: string): string | undefined {
  let urlp: URL
  try {
    urlp = new URL(url)
  } catch {
    return
  }
  if (
    urlp.hostname !== 'stream.place' &&
    urlp.hostname !== 'www.stream.place'
  ) {
    return
  }
  // A channel URL is exactly one path segment; anything deeper is a video or
  // embed page, not the channel itself.
  const parts = urlp.pathname.split('/').filter(Boolean)
  if (parts.length !== 1) return
  const actor = parts[0]
  let decoded: string
  try {
    decoded = decodeURIComponent(actor).replace(/^@/, '')
  } catch {
    return
  }
  if (!decoded.startsWith('did:') && !isValidHandle(decoded)) return
  return decoded.startsWith('did:') ? decoded : decoded.toLowerCase()
}

// The host's channel may be live for something else, so only look for a live
// stream from an hour before the event starts until an hour after it ends.
export function inLiveWindow(event: ParsedEvent, now: Date): boolean {
  const t = now.getTime()
  return (
    eventPhase(event, new Date(t + LIVE_GRACE_MS)) !== 'upcoming' &&
    eventPhase(event, new Date(t - LIVE_GRACE_MS)) !== 'past' &&
    !!event.startsAt
  )
}

// A live status can point at any allowed live host, so only count it when it
// points at the same Streamplace channel the event links to.
export function isLiveOnStreamplace(
  status: app.bsky.actor.defs.StatusView,
  streamer: {did: string; handle: string},
): boolean {
  const embed = status.embed
  if (!status.isActive || embed?.$type !== 'app.bsky.embed.external#view') {
    return false
  }
  if (!('external' in embed)) return false
  const actor = parseStreamplaceActor(embed.external.uri)
  return actor === streamer.did || actor === streamer.handle.toLowerCase()
}
