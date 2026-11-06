import {OPTION_FACET, POLLBLUE_HOST, type PollPostParts} from './types'

type Facet = {
  $type?: string
  features?: {$type?: string; uri?: string; number?: number}[]
  index?: {byteStart: number; byteEnd: number}
}

/**
 * poll.blue links an option as `https://poll.blue/p/<id>/<n>`, where `<n>` is
 * the 1-based option or `0` for the results page. `<id>` is a visible id for
 * centralized polls or `did~rkey` for public ones.
 */
export function parsePollUrl(uri: string): {id: string; index: number} | null {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return null
  }
  if (url.hostname !== POLLBLUE_HOST) return null
  const match = url.pathname.match(/^\/p\/([^/]+)(?:\/(\d+))?\/?$/)
  if (!match) return null
  return {id: decodeURIComponent(match[1]), index: Number(match[2] ?? 0)}
}

/**
 * Reads a poll out of a post's own text and facets. Returns null for any post
 * that merely links to poll.blue: the custom option facet has to be present.
 */
export function pollPostParts(record: {
  text?: string
  facets?: unknown
}): PollPostParts | null {
  const text = record.text
  const facets = (record.facets ?? []) as Facet[]
  if (!text?.trim() || !Array.isArray(facets) || !facets.length) return null

  const optionFacets = facets.filter(f =>
    f?.features?.some(feature => feature?.$type === OPTION_FACET),
  )
  const linkFacets = facets.filter(f =>
    f?.features?.some(
      feature =>
        feature?.$type === 'app.bsky.richtext.facet#link' &&
        feature.uri &&
        parsePollUrl(feature.uri),
    ),
  )
  // Only the option-marked facets mean "this is a poll"; links alone are common.
  if (!optionFacets.length) return null

  const bytes = new TextEncoder().encode(text)
  const decode = (start: number, end: number) =>
    new TextDecoder().decode(bytes.slice(start, end))

  let id = ''
  for (const facet of linkFacets) {
    for (const feature of facet.features ?? []) {
      const parsed = feature.uri ? parsePollUrl(feature.uri) : null
      if (parsed) {
        id = parsed.id
        break
      }
    }
    if (id) break
  }
  if (!id) return null

  const options = optionFacets.flatMap(facet => {
    const number = facet.features?.find(f => f?.$type === OPTION_FACET)?.number
    if (typeof number !== 'number' || !facet.index) return []
    return [{number, text: decode(facet.index.byteStart, facet.index.byteEnd)}]
  })
  if (!options.length) return null
  options.sort((a, b) => a.number - b.number)

  // The block spans whole lines, so widen each option's range to its own line.
  // This keeps the removal clean when the option text is just one segment.
  const lineBounds = (start: number, end: number) => {
    let lineStart = start
    while (lineStart > 0 && bytes[lineStart - 1] !== 0x0a) lineStart--
    let lineEnd = end
    while (lineEnd < bytes.length && bytes[lineEnd] !== 0x0a) lineEnd++
    return {start: lineStart, end: lineEnd}
  }

  const first = optionFacets
    .map(f => f.index!)
    .reduce((a, b) => (a.byteStart <= b.byteStart ? a : b))
  const last = optionFacets
    .map(f => f.index!)
    .reduce((a, b) => (a.byteEnd >= b.byteEnd ? a : b))
  const optionsRange = lineBounds(first.byteStart, last.byteEnd)

  // The results line links to `.../<id>/0` and sits after every option.
  const resultsFacet = linkFacets
    .filter(f => {
      if (!f.index || f.index.byteStart <= last.byteEnd) return false
      return f.features?.some(feature => {
        const parsed = feature.uri ? parsePollUrl(feature.uri) : null
        return parsed?.index === 0
      })
    })
    .at(0)
  const resultsRange = resultsFacet?.index
    ? lineBounds(resultsFacet.index.byteStart, resultsFacet.index.byteEnd)
    : undefined

  return {
    id,
    options,
    optionsStart: optionsRange.start,
    optionsEnd: optionsRange.end,
    resultsStart: resultsRange?.start,
    resultsEnd: resultsRange?.end,
  }
}

/**
 * Removes the option block and results line from a poll post's text, leaving
 * the question. The card renders the options instead. Mirrors the byte ranges
 * `pollPostParts` reports; trimming the loose blank lines keeps the question
 * from ending in a gap.
 */
export function stripPollLines(text: string, parts: PollPostParts): string {
  const original = new TextEncoder().encode(text)
  const ranges: [number, number][] = []
  if (parts.resultsStart != null && parts.resultsEnd != null) {
    ranges.push([parts.resultsStart, parts.resultsEnd])
  }
  ranges.push([parts.optionsStart, parts.optionsEnd])
  // Walk backwards so earlier ranges stay valid as later bytes are dropped.
  ranges.sort((a, b) => b[0] - a[0])
  let out = original
  for (const [start, end] of ranges) {
    // Swallow the newline that ended the removed line.
    const endWithNewline =
      end < original.length && original[end] === 0x0a ? end + 1 : end
    out = new Uint8Array([...out.slice(0, start), ...out.slice(endWithNewline)])
  }
  return new TextDecoder()
    .decode(out)
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
}

/**
 * rkey poll.blue uses for a vote: FNV-1a over the poll URI, base36, prefixed
 * with `v`. A voter has one record per poll, so a revote overwrites it.
 */
export function voteRkey(pollUri: string): string {
  let hash = 2166136261
  for (let i = 0; i < pollUri.length; i++) {
    hash ^= pollUri.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return 'v' + (hash >>> 0).toString(36)
}
