import {AtUri} from '@atproto/syntax'
import {DEFAULT_LABEL_SETTINGS, type ModerationOpts} from '@bsky/sdk/moderation'

import {BLUEMOJI_SERVICE, type BluemojiItem} from '#/features/bluemoji/util'
import {type blue} from '#/lexicons'

export const REACTION_COLLECTION = 'blue.moji.feed.reaction' as const

/** Max subjects per blue.moji.feed.getReactionCounts call. */
export const REACTION_COUNT_BATCH = 50

export type ReactionEmoji = blue.moji.feed.reaction.EmojiRef

export type ReactionGroup = {
  emoji: ReactionEmoji
  count: number
}

/**
 * AppView reaction refs are rebuilt from the indexed source item, so the
 * aliases, alt text and formats here are already verified. Only the item URI
 * tells us who owns the blobs.
 */
export function getReactionEmojiDid(emoji: ReactionEmoji) {
  try {
    return new AtUri(emoji.uri).host
  } catch {
    return undefined
  }
}

/** Reaction images render small and often, so skip v0 raw-bytes formats. */
export function getReactionEmojiImage(emoji: ReactionEmoji) {
  const did = getReactionEmojiDid(emoji)
  if (!did) return undefined
  const cid = getRenditionCid(emoji)
  if (!cid) return undefined
  return `${BLUEMOJI_SERVICE}/img/${encodeURIComponent(did)}/${encodeURIComponent(cid)}`
}

/**
 * The AppView rebuilds `formats` from the source item record, so appreciations
 * arrive as blob objects (`{ref, size, mimeType}`) rather than the CID strings
 * the inline-facet lexicon describes. Accept both.
 */
export function getRenditionCid(value: ReactionEmoji) {
  const formats = (value.formats ?? {}) as Record<string, unknown>
  for (const slot of ['webp_128', 'gif_128', 'apng_128', 'png_128']) {
    const entry = formats[slot]
    const cid =
      entry && typeof entry === 'object' && 'ref' in entry
        ? (entry as {ref: {$link?: string}}).ref?.$link
        : typeof entry === 'string'
          ? entry
          : undefined
    if (cid) return cid
  }
  return undefined
}

/**
 * Reaction refs carry no self-labels, only the source item's `adultOnly`, so
 * that is the single signal the AppView can vouch for here.
 */
export function getReactionEmojiModeration(
  emoji: ReactionEmoji,
  opts?: ModerationOpts,
): 'ignore' | 'warn' | 'hide' {
  if (!emoji.adultOnly) return 'ignore'
  if (!opts?.prefs.adultContentEnabled) return 'hide'
  return opts.prefs.labels.porn ?? DEFAULT_LABEL_SETTINGS.porn ?? 'warn'
}

/**
 * Build the ref a reaction record carries from a verified item.
 *
 * Only the CID-bearing v1 slots travel: v0 raw bytes cannot be written, and
 * blob objects from the item record are not valid ref values.
 */
export function toReactionEmoji(item: BluemojiItem): ReactionEmoji {
  const formats: Record<string, string> = {
    $type: 'blue.moji.richtext.facet#formats_v1',
  }
  const source = item.record.formats as Record<string, unknown>
  for (const slot of ['png_128', 'webp_128', 'gif_128', 'apng_128'] as const) {
    const cid = getRenditionCid({
      formats: {[slot]: source?.[slot]},
    } as ReactionEmoji)
    if (cid) formats[slot] = cid
  }
  return {
    $type: 'blue.moji.feed.reaction#emojiRef',
    uri: item.uri as ReactionEmoji['uri'],
    cid: item.cid,
    name: item.record.name,
    alt: item.record.alt,
    adultOnly: item.record.adultOnly,
    formats: formats as unknown as ReactionEmoji['formats'],
  }
}

/**
 * Adapt a verified reaction ref to the item shape the composer and picker pass
 * around. The AppView already rebuilt the ref from the source record, so the
 * record key checks in `fetchBluemojiItem` do not apply.
 */
export function reactionEmojiToItem(emoji: ReactionEmoji): BluemojiItem | null {
  const did = getReactionEmojiDid(emoji)
  if (!did) return null
  /* The record's own createdAt is irrelevant once an item is being inserted. */
  const record: BluemojiItem['record'] = {
    $type: 'blue.moji.collection.item',
    name: emoji.name,
    alt: emoji.alt,
    adultOnly: emoji.adultOnly,
    createdAt: '1970-01-01T00:00:00.000Z',
    formats: emoji.formats as BluemojiItem['record']['formats'],
  }
  return {
    uri: emoji.uri,
    cid: emoji.cid ?? '',
    did: did as BluemojiItem['did'],
    record,
  }
}

export function getReactionEmojiAlt(emoji: ReactionEmoji) {
  return emoji.alt?.trim() || emoji.name
}

/** Reaction refs only render `http(s)` sources; anything else is not a link. */
export function getSafeSourceUrl(source: string | null | undefined) {
  const raw = source?.trim()
  if (!raw || /\s/.test(raw)) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (url.username || url.password) return undefined
    return url.href
  } catch {
    return undefined
  }
}

/**
 * SPDX identifiers link to their canonical page; `LicenseRef-*` and malformed
 * expressions are shown as plain text. Mirrors the AppView's own validation.
 */
export function getLicenseUrl(license: string | null | undefined) {
  const id = license?.trim()
  if (!id || !/^[A-Za-z0-9.-]+$/.test(id) || id.startsWith('LicenseRef-')) {
    return undefined
  }
  return `https://spdx.org/licenses/${id}.html`
}
