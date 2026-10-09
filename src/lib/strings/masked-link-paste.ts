import {sanitizeUrl} from '@braintree/sanitize-url'

import {
  formatMarkdownLinkDestination,
  normalizeMarkdownLinkDestination,
} from '#/lib/strings/markdown-links'

/** Recognize a URL replacing selected text, including pastes shorter than the label. */
export function maskPastedLink(
  previous: string,
  next: string,
  {start, end}: {start: number; end: number},
): string {
  if (start === end) return next
  const before = previous.slice(0, start)
  const after = previous.slice(end)
  if (!next.startsWith(before) || !next.endsWith(after)) return next
  const inserted = next.slice(start, next.length - after.length).trim()
  const label = previous.slice(start, end)
  if (!inserted || /[\s<>\\]/.test(inserted) || /[\]\n]/.test(label))
    return next
  try {
    const uri = normalizeMarkdownLinkDestination(inserted)
    if (sanitizeUrl(uri) === 'about:blank') return next
    const url = new URL(uri)
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.hostname.includes('.')
    )
      return next
  } catch {
    return next
  }
  const destination = formatMarkdownLinkDestination(inserted)
  return `${before}[${label}](${destination})${after}`
}
