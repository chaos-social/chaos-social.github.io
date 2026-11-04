import {AppBskyRichtextFacet} from '@atproto/api'
import {type Client} from '@atproto/lex'
import {type HandleString} from '@atproto/syntax'
import {RichText, UnicodeString} from '@bsky/sdk/richtext'

import {app, com} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {
  ESCAPED_MARKDOWN_LINK_PATTERN,
  getMarkdownLinkHighlightRanges,
  MARKDOWN_ESCAPE_PATTERN,
  MARKDOWN_LINK_PATTERN,
  normalizeMarkdownLinkDestination,
} from './markdown-links'
import {toShortUrl} from './url-helpers'

export function restoreLinks(
  text: string,
  facets?: AppBskyRichtextFacet.Main[],
): string {
  if (!facets?.length) {
    return text
  }

  const rt = new UnicodeString(text)
  const parts: string[] = []
  let lastIndex = 0

  const sortedFacets = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  )

  for (const facet of sortedFacets) {
    const isLink = facet.features.find(AppBskyRichtextFacet.isLink)
    if (!isLink) {
      continue
    }

    parts.push(rt.slice(lastIndex, facet.index.byteStart))
    parts.push(isLink.uri)
    lastIndex = facet.index.byteEnd
  }

  parts.push(rt.slice(lastIndex))

  return parts.join('')
}

export function shortenLinks(
  rt: RichText,
  preserveLabels = false,
  preserveFacets: readonly AppBskyRichtextFacet.Main[] = [],
): RichText {
  if (!rt.facets?.length) {
    return rt
  }
  /** Remember explicit labels before cloning loses their facet identities. */
  const preservedStarts = new Set(
    rt.facets
      .filter(facet => preserveFacets.includes(facet))
      .map(facet => facet.index.byteStart),
  )
  rt = rt.clone()
  // enumerate the link facets
  if (rt.facets) {
    const preserved = new Set(
      rt.facets.filter(facet => preservedStarts.has(facet.index.byteStart)),
    )
    for (const facet of rt.facets) {
      if (preserved.has(facet)) continue
      const isLink = !!facet.features.find(f =>
        bsky.isType(app.bsky.richtext.facet.link, f),
      )
      if (!isLink) {
        continue
      }

      // extract and shorten the URL
      const {byteStart, byteEnd} = facet.index
      const url = rt.unicodeText.slice(byteStart, byteEnd)
      if (
        preserveLabels &&
        !facet.features.some(
          feature =>
            bsky.isType(app.bsky.richtext.facet.link, feature) &&
            feature.uri === url,
        )
      ) {
        continue
      }
      const shortened = new UnicodeString(toShortUrl(url))

      // insert the shorten URL
      rt.insert(byteStart, shortened.utf16)
      /*
       * The SDK shifts facets by UTF-16 length when inserting, but facet
       * offsets are UTF-8 bytes. Correct that shift before removing the URL.
       */
      const missingBytes = shortened.length - shortened.utf16.length
      if (missingBytes) {
        for (const current of rt.facets) {
          if (current.index.byteStart >= byteStart) {
            current.index.byteStart += missingBytes
            current.index.byteEnd += missingBytes
          } else if (current.index.byteEnd > byteStart) {
            current.index.byteEnd += missingBytes
          }
        }
      }
      // update the facet to cover the new shortened URL
      facet.index.byteStart = byteStart
      facet.index.byteEnd = byteStart + shortened.length
      // remove the old URL
      rt.delete(byteStart + shortened.length, byteEnd + shortened.length)
    }
  }
  return rt
}

export function expandLinks(rt: RichText): RichText {
  if (!rt.facets?.length) {
    return rt
  }
  rt = rt.clone()
  if (rt.facets) {
    for (const facet of rt.facets) {
      const link = facet.features.find(AppBskyRichtextFacet.isLink)
      if (!link) {
        continue
      }
      const {byteStart, byteEnd} = facet.index
      const full = new UnicodeString(link.uri)
      rt.insert(byteStart, full.utf16)
      facet.index.byteStart = byteStart
      facet.index.byteEnd = byteStart + full.length
      rt.delete(byteStart + full.length, byteEnd + full.length)
    }
  }
  return rt
}

// filter out any mention facets that didn't map to a user
export function stripInvalidMentions(rt: RichText): RichText {
  if (!rt.facets?.length) {
    return rt
  }
  rt = rt.clone()
  if (rt.facets) {
    rt.facets = rt.facets?.filter(facet => {
      const mention = facet.features.find(f =>
        bsky.isType(app.bsky.richtext.facet.mention, f),
      )
      if (mention && !mention.did) {
        return false
      }
      return true
    })
  }
  return rt
}

/** True when the character at index is preceded by an odd backslash run. */
export function isEscapedFacetSyntax(text: string, index: number): boolean {
  let backslashes = 0
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
    backslashes++
  }
  return backslashes % 2 === 1
}

/** Escaped syntax protects automatic facets; independent angle syntax opts back in. */
export function isInsideEscapedFacetSyntax(
  text: string,
  start: number,
  end: number,
): boolean {
  for (const match of text.matchAll(/<[^<>\n]+>/g)) {
    if (
      isEscapedFacetSyntax(text, match.index) &&
      start >= match.index &&
      end <= match.index + match[0].length
    ) {
      return true
    }
  }
  for (const match of text.matchAll(ESCAPED_MARKDOWN_LINK_PATTERN)) {
    if (
      isEscapedFacetSyntax(text, match.index) &&
      start >= match.index &&
      end <= match.index + match[0].length
    ) {
      return getEscapedMarkdownProtectionRanges(
        text,
        match.index,
        match.index + match[0].length,
      ).some(range => start >= range.start && end <= range.end)
    }
  }
  return false
}

/** Preserve independently unescaped angle facets inside a literal Markdown wrapper. */
function getEscapedMarkdownProtectionRanges(
  text: string,
  start: number,
  end: number,
): {start: number; end: number}[] {
  const ranges: {start: number; end: number}[] = []
  let cursor = start
  for (const match of text.slice(start, end).matchAll(/<([^<>\n]+)>/g)) {
    const angleStart = start + match.index
    if (isEscapedFacetSyntax(text, angleStart) || !getEnclosedFacet(match[1])) {
      continue
    }
    ranges.push({start: cursor, end: angleStart})
    cursor = angleStart + match[0].length
  }
  ranges.push({start: cursor, end})
  return ranges
}

/** Merge masked link highlights into editor facets without rewriting the text. */
export function applyMarkdownLinkFacets(rt: RichText): RichText {
  const markdownFacets: AppBskyRichtextFacet.Main[] = []
  const ranges: {start: number; end: number}[] = []
  for (const match of rt.text.matchAll(MARKDOWN_LINK_PATTERN)) {
    if (isEscapedFacetSyntax(rt.text, match.index)) continue
    const toByte = (offset: number) =>
      rt.unicodeText.utf16IndexToUtf8Index(match.index + offset)
    ranges.push({start: toByte(0), end: toByte(match[0].length)})
    const uri = normalizeMarkdownLinkDestination(match[1])
    for (const range of getMarkdownLinkHighlightRanges(match[0], match[1])) {
      markdownFacets.push({
        index: {byteStart: toByte(range.start), byteEnd: toByte(range.end)},
        features: [{$type: 'app.bsky.richtext.facet#link', uri}],
      })
    }
  }
  if (markdownFacets.length) {
    rt.facets = [
      ...(rt.facets ?? []).filter(
        facet =>
          !ranges.some(
            range =>
              facet.index.byteStart < range.end &&
              facet.index.byteEnd > range.start,
          ),
      ),
      ...markdownFacets,
    ].sort((a, b) => a.index.byteStart - b.index.byteStart) as typeof rt.facets
  }
  return rt
}

function firstDetectedFacet(text: string) {
  const candidate = new RichText({text})
  candidate.detectFacetsWithoutResolution()
  return candidate.facets?.find(facet => facet.index.byteStart === 0)
}

/** Detect a facet that fills angle brackets, allowing trailing punctuation. */
export function getEnclosedFacet(text: string) {
  const trimmed = text.trim()
  const facet = firstDetectedFacet(trimmed)
  if (!facet) return undefined
  const trailing = new UnicodeString(trimmed).slice(facet.index.byteEnd)
  return /^[\p{P}]*$/u.test(trailing) ? facet : undefined
}

/** Apply backslash escapes and angle syntax to detected facets. */
export function applyFacetSyntax(
  rt: RichText,
  {removeSyntax = false}: {removeSyntax?: boolean} = {},
): RichText {
  const deletionPoints = collectFacetSyntax(rt)
  if (removeSyntax) {
    for (const index of deletionPoints.sort((a, b) => b - a)) {
      const byte = rt.unicodeText.utf16IndexToUtf8Index(index)
      rt.delete(byte, byte + 1)
    }
  }
  return rt
}

/** UTF-16 positions of escape backslashes and angle delimiters removed on posting. */
export function getFacetSyntaxRemovalIndices(rt: RichText): Set<number> {
  const preview = rt.clone()
  applyMarkdownLinkFacets(preview)
  const indices = new Set(collectFacetSyntax(preview))
  for (const match of rt.text.matchAll(MARKDOWN_LINK_PATTERN)) {
    if (isEscapedFacetSyntax(rt.text, match.index)) continue
    const destinationStart = match.index + match[0].length - match[1].length - 1
    for (const escape of match[1].matchAll(MARKDOWN_ESCAPE_PATTERN)) {
      indices.add(destinationStart + escape.index)
    }
  }
  return indices
}

/** Split editor text at removed syntax without changing its text or offsets. */
export function splitFacetSyntax(
  text: string,
  start: number,
  removalIndices: ReadonlySet<number>,
): {text: string; removed: boolean}[] {
  const segments: {text: string; removed: boolean}[] = []
  for (let index = 0; index < text.length; index++) {
    const removed = removalIndices.has(start + index)
    const last = segments.at(-1)
    if (last?.removed === removed) {
      last.text += text[index]
    } else {
      segments.push({text: text[index], removed})
    }
  }
  return segments
}

/** Collect removed syntax while applying its effect to the detected facets. */
function collectFacetSyntax(rt: RichText): number[] {
  const text = rt.text
  const toByte = (index: number) => rt.unicodeText.utf16IndexToUtf8Index(index)
  const protectedRanges: {start: number; end: number}[] = []
  const deletionPoints: number[] = []

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') continue
    const start = i
    while (text[i] === '\\') i++
    const end = i
    for (let pair = start; pair + 1 < end; pair += 2) {
      deletionPoints.push(pair)
    }
    if ((end - start) % 2 === 1) {
      const rest = text.slice(end)
      const markdown = new RegExp(
        `^${ESCAPED_MARKDOWN_LINK_PATTERN.source}`,
      ).exec(rest)
      const angle = /^<[^<>\n]+>/.exec(rest)
      const detected = firstDetectedFacet(rest)
      const length =
        markdown?.[0].length ??
        angle?.[0].length ??
        (detected
          ? new UnicodeString(rest).slice(0, detected.index.byteEnd).length
          : undefined)
      if (length) {
        const ranges = markdown
          ? getEscapedMarkdownProtectionRanges(text, end, end + length)
          : [{start: end, end: end + length}]
        protectedRanges.push(
          ...ranges.map(range => ({
            start: toByte(range.start),
            end: toByte(range.end),
          })),
        )
        deletionPoints.push(end - 1)
      }
    }
    i = end - 1
  }

  if (rt.facets?.length && protectedRanges.length) {
    rt.facets = rt.facets.filter(
      facet =>
        !protectedRanges.some(
          range =>
            facet.index.byteStart >= range.start &&
            facet.index.byteEnd <= range.end,
        ),
    )
  }

  for (const match of text.matchAll(/<[^<>\n]+>/g)) {
    const start = toByte(match.index)
    const end = toByte(match.index + match[0].length)
    if (
      protectedRanges.some(range => start >= range.start && end <= range.end)
    ) {
      continue
    }

    const content = match[0].slice(1, -1)
    const trimmed = content.trim()
    const contentStart = match.index + 1 + content.indexOf(trimmed)
    const facet = getEnclosedFacet(trimmed)
    const contentByteStart = toByte(contentStart)
    const contentByteEnd = toByte(contentStart + trimmed.length)
    const existing = rt.facets?.some(
      current =>
        current.index.byteStart === contentByteStart &&
        current.index.byteEnd === contentByteEnd &&
        current.features.length > 0,
    )
    if (!facet && !existing) continue

    if (facet && !existing) {
      const byteStart = toByte(contentStart) + facet.index.byteStart
      const byteEnd = toByte(contentStart) + facet.index.byteEnd
      if (
        !rt.facets?.some(
          current =>
            current.index.byteStart < byteEnd &&
            current.index.byteEnd > byteStart,
        )
      ) {
        rt.facets = [
          ...(rt.facets ?? []),
          {
            ...facet,
            index: {byteStart, byteEnd},
          },
        ].sort((a, b) => a.index.byteStart - b.index.byteStart)
      }
    }

    deletionPoints.push(match.index, match.index + match[0].length - 1)
  }

  return deletionPoints
}

/** Resolve handles added by angle link syntax after automatic facet detection. */
export async function resolveSyntaxMentions(rt: RichText, client: Client) {
  const failed = new Set<NonNullable<typeof rt.facets>[number]>()
  await Promise.all(
    (rt.facets ?? []).flatMap(facet =>
      facet.features.flatMap(feature => {
        if (
          !AppBskyRichtextFacet.isMention(feature) ||
          feature.did.startsWith('did:')
        ) {
          return []
        }
        return [
          client
            .call(com.atproto.identity.resolveHandle, {
              handle: feature.did as HandleString,
            })
            .then(({did}) => {
              feature.did = did
            })
            .catch(() => {
              failed.add(facet)
            }),
        ]
      }),
    ),
  )
  if (failed.size) {
    rt.facets = rt.facets?.filter(facet => !failed.has(facet))
  }
}

export function parseMarkdownLinks(text: string): {
  text: string
  facets: AppBskyRichtextFacet.Main[]
} {
  const regex = new RegExp(MARKDOWN_LINK_PATTERN)
  let match
  let newText = ''
  let lastIndex = 0
  const facets: AppBskyRichtextFacet.Main[] = []

  while ((match = regex.exec(text)) !== null) {
    if (isEscapedFacetSyntax(text, match.index)) continue
    const [fullMatch, linkUrl] = match
    const linkText = fullMatch.slice(1, fullMatch.indexOf(']'))
    const matchStart = match.index
    newText += text.slice(lastIndex, matchStart)
    const startByte = new UnicodeString(newText).length
    newText += linkText
    const endByte = new UnicodeString(newText).length
    const validUrl = normalizeMarkdownLinkDestination(linkUrl)

    facets.push({
      index: {
        byteStart: startByte,
        byteEnd: endByte,
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: validUrl,
        },
      ],
    })

    lastIndex = matchStart + fullMatch.length
  }

  newText += text.slice(lastIndex)

  return {text: newText, facets}
}
