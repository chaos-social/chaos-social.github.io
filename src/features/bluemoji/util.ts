import {type $Typed, type Unknown$TypedObject} from '@atproto/lex'
import {AtUri, type DidString} from '@atproto/syntax'
import {DEFAULT_LABEL_SETTINGS, type ModerationOpts} from '@bsky/sdk/moderation'
import {type RichText} from '@bsky/sdk/richtext'

import {
  isEscapedFacetSyntax,
  isInsideEscapedFacetSyntax,
} from '#/lib/strings/rich-text-manip'
import {readBluemojiInstance} from '#/state/preferences/bluemoji-instance'
import {aliasToRkey} from '#/features/bluemoji/alias'
import {blue, com} from '#/lexicons'

export type BluemojiItem = {
  uri: string
  cid: string
  did: DidString
  record: blue.moji.collection.item.Main
}

export type BluemojiRef = {
  did: string
  name: string
  /** A known URI pins the item; `cid` pins its content when we have one. */
  record?: {uri: string; cid?: string}
}

/** Keep different collections' identically named emoji distinct within a draft. */
export function getBluemojiInsertionName(
  item: BluemojiItem,
  refs: Record<string, BluemojiRef> = {},
) {
  for (const [name, ref] of Object.entries(refs)) {
    if (ref.record?.uri === item.uri && ref.record.cid === item.cid) return name
  }
  let name = item.record.name
  let suffix = 2
  while (refs[name]) {
    name = `:${item.record.name.slice(1, -1)}-${suffix++}:`
  }
  return name
}

function blobCid(blob: unknown) {
  if (!blob || typeof blob !== 'object' || !('ref' in blob)) return undefined
  const ref = blob.ref
  const cid =
    ref && typeof ref === 'object' && '$link' in ref
      ? String(ref.$link)
      : String(ref)
  return /^[a-zA-Z0-9]+$/.test(cid) ? cid : undefined
}

/** Only the source record determines which asset may be displayed. */
export function getBluemojiImage(item: BluemojiItem, instance?: string) {
  return getBluemojiRendition(item, instance)?.url
}

/**
 * A rendition URL that skips moji.blue's CDN.
 *
 * Its `/img` proxy only serves blobs it has indexed (or the viewer's own, for a
 * session we don't hold), so an emoji uploaded a moment ago 404s there until
 * the firehose catches up. The owning PDS has the blob immediately, so this is
 * the fallback for one we just wrote.
 */
export function getBluemojiPdsImage(item: BluemojiItem, pdsUrl: string) {
  const rendition = getBluemojiRendition(item)
  if (!rendition) return
  const url = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
  url.searchParams.set('did', item.did)
  url.searchParams.set('cid', rendition.cid)
  return url.toString()
}

function getBluemojiRendition(item: BluemojiItem, instance?: string) {
  const formats = item.record.formats
  const slots = ['webp_128', 'gif_128', 'apng_128', 'png_128']
  for (const slot of slots) {
    const blob = (formats as Record<string, unknown>)[slot]
    const cid = blobCid(blob)
    if (cid) {
      return {
        cid,
        url: `${instance ?? readBluemojiInstance()}/img/${encodeURIComponent(item.did)}/${encodeURIComponent(cid)}`,
      }
    }
  }
  return undefined
}

/** Warned or hidden inline emoji keep their alias visible. */
export function getBluemojiModeration(
  item: BluemojiItem,
  opts?: ModerationOpts,
): 'ignore' | 'warn' | 'hide' {
  const labels = com.atproto.label.defs.selfLabels.$ifMatches(
    item.record.labels,
  )
  const values = labels?.values.map((label: {val: string}) => label.val) ?? []
  if (item.record.adultOnly) values.push('porn')
  let result: 'ignore' | 'warn' | 'hide' = 'ignore'
  for (const value of values) {
    if (['!hide', '!takedown'].includes(value)) return 'hide'
    if (value === '!no-unauthenticated') {
      if (!opts?.userDid) return 'hide'
      continue
    }
    if (
      ['porn', 'sexual', 'graphic-media', 'gore'].includes(value) &&
      !opts?.prefs.adultContentEnabled
    )
      return 'hide'
    const preference =
      value === '!warn'
        ? 'warn'
        : (opts?.prefs.labels[value] ?? DEFAULT_LABEL_SETTINGS[value] ?? 'warn')
    if (preference === 'hide') return 'hide'
    if (preference === 'warn') result = 'warn'
  }
  return result
}

export function getBluemojiRefUri(ref: BluemojiRef) {
  try {
    if (ref.record) {
      // A known URI is authoritative even without a CID to pin it to.
      const uri = new AtUri(ref.record.uri)
      if (
        uri.collection !== 'blue.moji.collection.item' ||
        !uri.host.startsWith('did:') ||
        !uri.rkey
      )
        return undefined
      return uri.toString()
    }
    if (!ref.did.startsWith('did:')) return undefined
    return `at://${ref.did}/blue.moji.collection.item/${aliasToRkey(ref.name)}`
  } catch {
    return undefined
  }
}

export function getBluemojiFacet(value: unknown) {
  const facet = blue.moji.richtext.facet.$ifMatches(value)
  if (!facet) return undefined
  const record = com.atproto.repo.strongRef.$ifMatches(
    (facet as blue.moji.richtext.facet.Main & {record?: unknown}).record,
  )
  return {...facet, record}
}

/** Write only CID-based v1 facets, including for readable historical items. */
export function createBluemojiFacet(
  item: BluemojiItem,
): $Typed<blue.moji.richtext.facet.Main> & {
  record?: com.atproto.repo.strongRef.Main
} {
  const formats: $Typed<blue.moji.richtext.facet.FormatsV1> = {
    $type: 'blue.moji.richtext.facet#formats_v1',
  }
  for (const slot of ['png_128', 'webp_128', 'gif_128', 'apng_128'] as const) {
    const blob = (item.record.formats as Record<string, unknown>)[slot]
    const cid = blobCid(blob)
    if (cid) formats[slot] = cid
  }
  return {
    $type: 'blue.moji.richtext.facet',
    did: item.did,
    name: item.record.name,
    alt: item.record.alt,
    adultOnly: item.record.adultOnly,
    labels: item.record.labels,
    formats,
    /* Historical collections can use record keys unrelated to the alias. */
    ...(getBluemojiRefUri({did: item.did, name: item.record.name}) !== item.uri
      ? {
          record: {
            uri: item.uri as com.atproto.repo.strongRef.Main['uri'],
            cid: item.cid,
          },
        }
      : {}),
  }
}

/** Alias ranges that are neither escaped nor covered by another facet. */
export function getBluemojiMatches(rt: RichText) {
  return Array.from(rt.text.matchAll(/(?=(:[^\s:]{1,128}:))/gu))
    .map(match => {
      match[0] = match[1]
      return match
    })
    .filter(match => {
      if (
        isEscapedFacetSyntax(rt.text, match.index) ||
        isInsideEscapedFacetSyntax(
          rt.text,
          match.index,
          match.index + match[0].length,
        )
      )
        return false
      const byteStart = rt.unicodeText.utf16IndexToUtf8Index(match.index)
      const byteEnd = rt.unicodeText.utf16IndexToUtf8Index(
        match.index + match[0].length,
      )
      return !rt.facets?.some(
        f => f.index.byteStart < byteEnd && f.index.byteEnd > byteStart,
      )
    })
}

/** Add verified emoji while retaining the editor's original text and offsets. */
export function addBluemojiFacets(
  rt: RichText,
  items: ReadonlyMap<string, BluemojiItem | null | undefined>,
) {
  const matches = getBluemojiMatches(rt)
  const facets = [...(rt.facets ?? [])]
  for (const match of matches) {
    const item = items.get(match[0])
    if (!item || !getBluemojiImage(item)) continue
    if (
      facets.some(
        f =>
          f.index.byteStart <
            rt.unicodeText.utf16IndexToUtf8Index(
              match.index + match[0].length,
            ) &&
          f.index.byteEnd > rt.unicodeText.utf16IndexToUtf8Index(match.index),
      )
    )
      continue
    const byteStart = rt.unicodeText.utf16IndexToUtf8Index(match.index)
    const byteEnd = rt.unicodeText.utf16IndexToUtf8Index(
      match.index + match[0].length,
    )
    facets.push({
      index: {byteStart, byteEnd},
      features: [createBluemojiFacet(item) as unknown as Unknown$TypedObject],
    })
  }
  rt.facets = facets.sort((a, b) => a.index.byteStart - b.index.byteStart)
  return rt
}

/** Resolve emoji before removing escapes or shifting text with facet syntax. */
export async function detectBluemojiFacets(
  rt: RichText,
  lookup: (name: string) => Promise<BluemojiItem | null>,
) {
  const matches = getBluemojiMatches(rt)
  const items = new Map<string, BluemojiItem | null>()
  await Promise.all(
    [...new Set(matches.map(match => match[0]))].map(async name => {
      items.set(name, await lookup(name))
    }),
  )
  return addBluemojiFacets(rt, items)
}
