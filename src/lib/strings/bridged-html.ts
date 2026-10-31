import {DomUtils, ElementType, parseDocument} from 'htmlparser2'
import {replace as texToUnicode} from 'unicodeit'

type Node = ReturnType<typeof parseDocument>['children'][number]
type Element = Extract<Node, {attribs: Record<string, string>}>

type Style = {
  bold?: true
  italic?: true
  underline?: true
  strike?: true
  code?: true
  quote?: true
}

type Target = {
  /** Absolute URL that passed the protocol allowlist */
  link?: string
  /** Hashtag without the leading `#` */
  tag?: string
  /** Set on Mastodon-style mention links, `link` holds the fediverse href */
  mention?: true
  /** DID of the mentioned account, when the href is a Bridgy Fed profile URL */
  did?: string
}

/**
 * A run of text with uniform formatting, produced from fediverse HTML. Flat on
 * purpose, so it renders as inline `Text` and keeps `numberOfLines` working.
 */
export type HtmlSegment = Style & Target & {text: string}

const STYLE_KEYS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'quote',
] as const

// same allowlist as Mastodon's sanitizer
const LINK_PROTOCOL_REGEX =
  /^(https?|dat|dweb|ipfs|ipns|ssb|gopher|xmpp|magnet|gemini):\/\//i
const BRIDGY_DID_REGEX = /^https:\/\/bsky\.brid\.gy\/ap\/(did:[a-z0-9:._%-]+)$/i

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
])
const SKIP_TAGS = new Set(['script', 'style', 'template', 'head', 'title'])
const TAG_STYLES: Record<string, Style> = {
  b: {bold: true},
  strong: {bold: true},
  h1: {bold: true},
  h2: {bold: true},
  h3: {bold: true},
  h4: {bold: true},
  h5: {bold: true},
  h6: {bold: true},
  i: {italic: true},
  em: {italic: true},
  cite: {italic: true},
  u: {underline: true},
  ins: {underline: true},
  s: {strike: true},
  del: {strike: true},
  strike: {strike: true},
  code: {code: true},
  kbd: {code: true},
  samp: {code: true},
  pre: {code: true},
  blockquote: {quote: true},
}

/**
 * Original HTML stored on bridged posts: `bridgyOriginalText` (Bridgy Fed) or
 * `fullText` (wafrn).
 */
export function getBridgedHtml(record: unknown): string | undefined {
  if (!record || typeof record !== 'object') return undefined
  const {bridgyOriginalText, fullText} = record as Record<string, unknown>
  for (const html of [bridgyOriginalText, fullText]) {
    if (typeof html === 'string' && html.trim()) return html
  }
  return undefined
}

export function segmentsToText(segments: HtmlSegment[]): string {
  return segments.map(s => s.text).join('')
}

/**
 * Flattens fediverse post HTML into styled text segments. Only text is ever
 * produced, so there is nothing to sanitize beyond the link allowlist.
 */
export function htmlToSegments(html: string): HtmlSegment[] {
  const segments: HtmlSegment[] = []
  let pendingBreaks = 0

  const last = () => segments[segments.length - 1]

  const append = (text: string, style: Style, target?: Target) => {
    const prev = last()
    if (
      !target &&
      prev &&
      !prev.link &&
      !prev.tag &&
      STYLE_KEYS.every(k => prev[k] === style[k])
    ) {
      prev.text += text
    } else {
      segments.push({text, ...style, ...target})
    }
  }

  const trimTrailing = () => {
    const prev = last()
    if (!prev || prev.link || prev.tag) return
    prev.text = prev.text.replace(/[ \n]+$/, '')
    if (!prev.text) segments.pop()
  }

  const push = (
    text: string,
    style: Style,
    target?: Target,
    collapse = true,
  ) => {
    const prevText = last()?.text ?? ''
    const lineStart = !prevText || pendingBreaks > 0 || prevText.endsWith('\n')
    if (collapse && (lineStart || prevText.endsWith(' '))) {
      text = text.replace(/^ /, '')
    }
    if (!text) return
    if (pendingBreaks > 0 && segments.length) {
      trimTrailing()
      append('\n'.repeat(pendingBreaks), {})
    }
    pendingBreaks = 0
    if (lineStart && style.quote) append('▎ ', style)
    append(text, style, target)
  }

  const requestBreaks = (n: number) => {
    pendingBreaks = Math.max(pendingBreaks, n)
  }

  const walk = (
    nodes: Node[],
    style: Style,
    pre: boolean,
    list?: {ordered: boolean; next: number},
  ) => {
    for (const node of nodes) {
      if (node.type === ElementType.Text) {
        push(
          pre ? node.data : node.data.replace(/[\t\n\r\f ]+/g, ' '),
          style,
          undefined,
          !pre,
        )
        continue
      }
      if (!('attribs' in node) || SKIP_TAGS.has(node.name)) continue

      const name = node.name
      const classes = node.attribs.class?.split(/\s+/) ?? []
      if (classes.includes('invisible')) continue

      switch (name) {
        case 'br':
          pendingBreaks++
          continue
        case 'a':
          pushLink(node, classes, style)
          continue
        case 'math':
          push(mathToText(node), style)
          continue
        case 'li':
          requestBreaks(1)
          push(list?.ordered ? `${list.next++}. ` : '• ', style)
          walk(node.children, style, pre)
          requestBreaks(1)
          continue
      }

      const isBlock = BLOCK_TAGS.has(name)
      if (isBlock) requestBreaks(2)
      walk(
        node.children,
        {...style, ...TAG_STYLES[name]},
        pre || name === 'pre',
        name === 'ul' || name === 'ol'
          ? {
              ordered: name === 'ol',
              next: parseInt(node.attribs.start, 10) || 1,
            }
          : list,
      )
      if (isBlock) requestBreaks(2)
    }
  }

  const pushLink = (node: Element, classes: string[], style: Style) => {
    const href = node.attribs.href ?? ''
    const text = linkText(node.children).replace(/\s+/g, ' ').trim() || href
    if (!isSafeHref(href)) {
      push(text, style)
    } else if (classes.includes('hashtag')) {
      push(text, style, {tag: text.replace(/^#/, '')})
    } else if (classes.includes('mention')) {
      push(text, style, {
        link: href,
        mention: true,
        did: href.match(BRIDGY_DID_REGEX)?.[1],
      })
    } else {
      push(text, style, {link: href})
    }
  }

  walk(parseDocument(html).children, {}, false)
  trimTrailing()
  return segments
}

function isSafeHref(href: string) {
  if (!LINK_PROTOCOL_REGEX.test(href)) return false
  try {
    new URL(href)
    return true
  } catch {
    return false
  }
}

/**
 * Visible link text, following Mastodon's link shortening: `.invisible` parts
 * are hidden and `.ellipsis` parts are followed by an ellipsis.
 */
function linkText(nodes: Node[]): string {
  let text = ''
  for (const node of nodes) {
    if (node.type === ElementType.Text) {
      text += node.data
    } else if ('attribs' in node) {
      const classes = node.attribs.class?.split(/\s+/) ?? []
      if (classes.includes('invisible')) continue
      text += linkText(node.children)
      if (classes.includes('ellipsis')) text += '…'
    }
  }
  return text
}

/**
 * FEP-dc88 math: prefer the TeX annotation (converted to Unicode), then the
 * plain text annotation, then whatever text the MathML contains.
 */
function mathToText(node: Element): string {
  const annotation = (encoding: string) =>
    DomUtils.findOne(
      el => el.name === 'annotation' && el.attribs.encoding === encoding,
      node.children,
    )
  const tex = annotation('application/x-tex')
  if (tex) return texToUnicode(DomUtils.textContent(tex).trim())
  const plain = annotation('text/plain')
  return DomUtils.textContent(plain ?? node).trim()
}
