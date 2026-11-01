import {type BlobRef, getBlobCidString} from '@atproto/lex'

/**
 * A game attached to a post. Stored as an extra field on an ordinary
 * `app.bsky.embed.external#external`, so other clients render a normal link
 * card pointing at the player page while we render it inline.
 */
export type GameEmbed = {
  kind: GameKind
  file: BlobRef
  /** Player aspect ratio. Defaults to 4:3 when absent. */
  width?: number
  height?: number
  alt?: string
}

export type GameKind = 'flash' | 'jar' | 'vnds'

/** Extra field carrying {@link GameEmbed} on an external embed's record. */
export const GAME_FIELD = 'witchsky$game'

/** The PDS default blob limit, which is the ceiling for every upload here. */
export const GAME_MAX_SIZE = 10 * 1000 * 1000

export const GAME_KIND_LABEL: Record<GameKind, string> = {
  flash: 'Flash',
  jar: 'Java applet',
  vnds: 'VNDS visual novel',
}

/**
 * Reads the game attachment off a post record, the only place it survives.
 *
 * The AppView rebuilds `view.external` from the lexicon's known fields and
 * drops `witchsky$game` along the way, so the hydrated view can't tell us
 * anything. `post.record` is the raw `app.bsky.feed.post` the author wrote,
 * and the embed inside it still carries the field.
 */
export function getGameEmbedFromRecord(
  record: unknown,
): GameEmbed | undefined {
  if (!record || typeof record !== 'object') return undefined
  let embed = (record as {embed?: unknown}).embed
  if (!embed || typeof embed !== 'object') return undefined
  // A game can't be quoted, but a recordWithMedia wrapper would still nest it.
  if ((embed as {$type?: string}).$type === 'app.bsky.embed.recordWithMedia') {
    embed = (embed as {media?: unknown}).media
    if (!embed || typeof embed !== 'object') return undefined
  }
  if ((embed as {$type?: string}).$type !== 'app.bsky.embed.external') {
    return undefined
  }
  const external = (embed as {external?: unknown}).external
  if (!external || typeof external !== 'object') return undefined
  const value = (external as {[GAME_FIELD]?: unknown})[GAME_FIELD]
  return isGameEmbed(value) ? value : undefined
}

export function isGameEmbed(value: unknown): value is GameEmbed {
  if (!value || typeof value !== 'object') return false
  const game = value as Partial<GameEmbed>
  if (!isGameKind(game.kind)) return false
  if (!game.file || typeof game.file !== 'object') return false
  return typeof getBlobCidString(game.file) === 'string'
}

export function isGameKind(value: unknown): value is GameKind {
  return value === 'flash' || value === 'jar' || value === 'vnds'
}

/**
 * Player page URL for a game blob. Deterministic from the blob, so the same
 * game posted twice yields the same cacheable page.
 */
export function getGameUrl(
  host: string,
  owner: string,
  file: BlobRef,
): string {
  return `${host}/game/${owner}/${getBlobCidString(file)}`
}

/**
 * The iframe URL that plays a game authored at `gameUrl`. The player reads the
 * blob location and kind off the query string; it cross-checks `kind` against
 * the record before loading a runtime.
 */
export function getGamePlayerUrl(
  host: string,
  gameUrl: string,
  game: Pick<GameEmbed, 'kind' | 'width' | 'height' | 'alt'>,
): string {
  const url = new URL('/static/iframe/game.html', host)
  url.searchParams.set('game', gameUrl)
  url.searchParams.set('kind', game.kind)
  if (game.width) url.searchParams.set('w', String(game.width))
  if (game.height) url.searchParams.set('h', String(game.height))
  if (game.alt) url.searchParams.set('alt', game.alt)
  return url.toString()
}

/** Blob CID out of a player-page URL, or undefined if the path is not one. */
export function parseGamePath(pathname: string): {
  did: string
  cid: string
} | undefined {
  const match = /^\/game\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!match) return undefined
  return {did: decodeURIComponent(match[1]), cid: decodeURIComponent(match[2])}
}

/** Player aspect ratio, falling back to the 4:3 every emulator here targets. */
export function getGameAspect(game: Pick<GameEmbed, 'width' | 'height'>) {
  const {width, height} = game
  if (!width || !height || width <= 0 || height <= 0) return 4 / 3
  return width / height
}

/**
 * One-line card description. Clients that can't play the file render this
 * instead, so it names the runtime they would need.
 */
export function createGameDescription(kind: GameKind, alt: string): string {
  const label = `${GAME_KIND_LABEL[kind]} game`
  return alt.trim() ? `${label} · ${alt.trim()}` : label
}

/** The MIME type to upload a file of this kind with. */
export function getGameMimeType(kind: GameKind): string {
  switch (kind) {
    case 'flash':
      return 'application/x-shockwave-flash'
    case 'jar':
      return 'application/java-archive'
    case 'vnds':
      return 'application/gzip'
  }
}

/** Filename without its extension, treating `.tar.gz` and `.tgz` as one. */
export function stripGameExtension(name: string): string {
  return name.replace(/\.(tar\.gz|tgz|zip|swf|jar)$/i, '')
}

/**
 * Kind implied by a filename. Browsers report inconsistent MIME types for these
 * formats, especially `.swf`, so the extension is the only reliable signal.
 */
export function getGameKindFromFilename(name: string): GameKind | undefined {
  const lower = name.toLowerCase()
  if (lower.endsWith('.swf')) return 'flash'
  if (lower.endsWith('.jar')) return 'jar'
  // `.tgz` is the short form of `.tar.gz`; `.zip` is the other VNDS archive shape.
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.zip'))
    return 'vnds'
  return undefined
}
