import {useMemo} from 'react'
import {type StyleProp, type TextStyle, View, type ViewStyle} from 'react-native'
import {type AppBskyFeedPost} from '@atproto/api'

import {useRenderMastodonHtml} from '#/state/preferences/render-mastodon-html'
import { atoms } from '#/alf'
import {InlineLinkText} from '#/components/Link'
import {P, Text} from '#/components/Typography'

interface MastodonHtmlContentProps {
  record: AppBskyFeedPost.Record
  style?: StyleProp<ViewStyle>,
  textStyle?: StyleProp<TextStyle>,
  numberOfLines?: number
}

export function useHasMastodonHtmlContent(record: AppBskyFeedPost.Record) {
  const renderMastodonHtml = useRenderMastodonHtml()

  return useMemo(() => {
    if (!renderMastodonHtml) return false

    const fullText = record.fullText as string | undefined
    const bridgyOriginalText = record.bridgyOriginalText as
      | string
      | undefined

    return !!(fullText || bridgyOriginalText)
  }, [record, renderMastodonHtml])
}

export function MastodonHtmlContent({
  record,
  style,
  textStyle,
  numberOfLines,
}: MastodonHtmlContentProps) {
  const renderMastodonHtml = useRenderMastodonHtml()

  const renderedContent = useMemo(() => {
    if (!renderMastodonHtml) return null

    const fullText = record.fullText as string | undefined
    const bridgyOriginalText = record.bridgyOriginalText as
      | string
      | undefined

    const rawHtml = fullText || bridgyOriginalText

    if (!rawHtml) return null

    // Parse HTML once and sanitize/render in a single pass
    return sanitizeAndRenderHtml(rawHtml, numberOfLines, textStyle)
  }, [record, renderMastodonHtml, numberOfLines, textStyle])

  if (!renderedContent) return null

  return <View style={style}>{renderedContent}</View>
}

const LINK_PROTOCOLS = [
  'http',
  'https',
  'dat',
  'dweb',
  'ipfs',
  'ipns',
  'ssb',
  'gopher',
  'xmpp',
  'magnet',
  'gemini',
]

const PROTOCOL_REGEX = /^([a-z][a-z0-9.+-]*):\/\//i

const ALLOWED_ELEMENTS = [
  'p',
  'br',
  'span',
  'a',
  'del',
  's',
  'pre',
  'blockquote',
  'code',
  'b',
  'strong',
  'u',
  'i',
  'em',
  'ul',
  'ol',
  'li',
  'ruby',
  'rt',
  'rp',
]

function sanitizeAndRenderHtml(
  html: string,
  _numberOfLines?: number,
  inputTextStyle?: StyleProp<TextStyle>,
): React.ReactNode {
  if (typeof DOMParser === 'undefined') {
    // Fallback for environments without DOMParser
    return html.replace(/<[^>]*>/g, '')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const textStyle: StyleProp<TextStyle> = [
    atoms.leading_snug,
    atoms.text_md,
    inputTextStyle,
  ]

  // Sanitize and render in a single pass
  const renderNode = (node: Node, key: number, insideLink = false): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Don't wrap text in styled Text component if inside a link
      if (insideLink) {
        return node.nodeValue
      }
      return <Text key={key} style={textStyle}>
        {node.nodeValue}
      </Text>
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()

      // Handle unsupported elements (h1-h6) - convert to <strong> wrapped in <p>
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const children = Array.from(element.childNodes).map((child, i) =>
          renderNode(child, i, insideLink),
        )
        return (
          <P key={key} style={textStyle}>
            <Text style={{...textStyle, fontWeight: 'bold'}}>{children}</Text>
          </P>
        )
      }

      // Handle math elements - extract annotation text
      if (tagName === 'math') {
        const mathText = extractMathAnnotation(element)
        if (mathText) {
          return <Text key={key} style={textStyle}>{mathText}</Text>
        }
        return null
      }

      // Remove elements not in allowlist - replace with text content
      if (!ALLOWED_ELEMENTS.includes(tagName)) {
        return element.textContent ? (
          <Text key={key} style={textStyle}>{element.textContent}</Text>
        ) : null
      }

      // Sanitize and process element
      sanitizeElementAttributes(element)

      const children = Array.from(element.childNodes).map((child, i) =>
        renderNode(child, i, insideLink || tagName === 'a'),
      )

      switch (tagName) {
        case 'p':
          return <P key={key} style={textStyle}>{children}</P>
        case 'blockquote':
          return (
            <View key={key} style={{borderLeftWidth: 3, borderLeftColor: '#888', paddingLeft: 12, marginVertical: 4}}>
              <P style={textStyle}>{children}</P>
            </View>
          )
        case 'pre':
          return (
            <View key={key} style={{backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4, marginVertical: 4}}>
              <P style={[textStyle, { fontFamily: 'monospace'}]}>{children}</P>
            </View>
          )
        case 'code':
          return (
            <Text key={key} style={[textStyle, { fontFamily: 'monospace', backgroundColor: '#f5f5f5', paddingHorizontal: 4, borderRadius: 2}]}>
              {children}
            </Text>
          )
        case 'strong':
        case 'b':
          return (
            <Text key={key} style={[textStyle, { fontWeight: 'bold'}]}>
              {children}
            </Text>
          )
        case 'em':
        case 'i':
          return (
            <Text key={key} style={[textStyle, { fontStyle: 'italic'}]}>
              {children}
            </Text>
          )
        case 'u':
          return (
            <Text key={key} style={[textStyle, { textDecorationLine: 'underline'}]}>
              {children}
            </Text>
          )
        case 'del':
        case 's':
          return (
            <Text key={key} style={[textStyle, { textDecorationLine: 'line-through'}]}>
              {children}
            </Text>
          )
        case 'ul':
          return (
            <View key={key} style={{marginVertical: 4}}>
              {children}
            </View>
          )
        case 'ol':
          return (
            <View key={key} style={{marginVertical: 4}}>
              {children}
            </View>
          )
        case 'li':
          const parentIsOl = element.parentElement?.tagName.toLowerCase() === 'ol'
          return (
            <View key={key} style={{flexDirection: 'row', marginVertical: 2}}>
              <Text style={[textStyle, { marginRight: 8 }]}>{parentIsOl ? '•' : '•'}</Text>
              <Text style={[textStyle, { flex: 1 }]}>{children}</Text>
            </View>
          )
        case 'ruby':
          return <Text key={key} style={textStyle}>{children}</Text>
        case 'rt':
        case 'rp':
          return null // TODO support ruby text rendering
        case 'a':
          const href = element.getAttribute('href')
          if (href) {
            const linkText =
              element.textContent || element.getAttribute('aria-label') || href
            const className = element.getAttribute('class')
            const isInvisible = className?.includes('invisible')
            return (
              <InlineLinkText
                key={key}
                to={href}
                label={linkText}
                shouldProxy
                style={isInvisible ? {display: 'none'} : textStyle}>
                {children}
              </InlineLinkText>
            )
          }
          return <Text key={key}>{children}</Text>
        case 'br':
          return '\n'
        case 'span':
          const spanClass = element.getAttribute('class')
          // Handle invisible/ellipsis classes for link formatting
          if (spanClass?.includes('invisible')) {
            return <Text key={key} style={{ display: 'none' }}>{children}</Text>
          }
          if (spanClass?.includes('ellipsis')) {
            // If inside a link, return plain text, otherwise wrapped
            if (insideLink) {
              return '\u2026'
            }
            return <Text key={key} style={textStyle}>{'\u2026'}</Text>
          }
          // Handle mentions and hashtags
          if (spanClass?.includes('mention') || spanClass?.includes('hashtag')) {
            // If inside a link, return children as-is without wrapping
            if (insideLink) {
              return children
            }
            return <Text key={key} style={textStyle}>{children}</Text>
          }
          // For spans inside links, return children without wrapping
          if (insideLink) {
            return children
          }
          return <Text key={key} style={textStyle}>{children}</Text>
        default:
          return <Text key={key} style={textStyle}>{children}</Text>
      }
    }

    return null
  }

  const content = Array.from(doc.body.childNodes).map((node, i) =>
    renderNode(node, i),
  )

  return (
    <View style={{gap: 8}}>
      {content}
    </View>
  )
}

function sanitizeElementAttributes(element: Element): void {
  const tagName = element.tagName.toLowerCase()
  const allowedAttrs: Record<string, string[]> = {
    a: ['href', 'rel', 'class', 'translate'],
    span: ['class', 'translate'],
    ol: ['start', 'reversed'],
    li: ['value'],
    p: ['class'],
  }

  const allowed = allowedAttrs[tagName] || []
  const attrs = Array.from(element.attributes)

  // Remove non-allowed attributes
  for (const attr of attrs) {
    const attrName = attr.name.toLowerCase()
    const isAllowed = allowed.some(a => {
      if (a.endsWith('*')) {
        return attrName.startsWith(a.slice(0, -1))
      }
      return a === attrName
    })

    if (!isAllowed) {
      element.removeAttribute(attr.name)
    }
  }

  // Process specific attributes
  if (tagName === 'a') {
    processAnchorElement(element)
  }

  // Process class whitelist
  if (element.hasAttribute('class')) {
    processClassWhitelist(element)
  }

  // Process translate attribute - remove unless it's "no"
  if (element.hasAttribute('translate')) {
    const translate = element.getAttribute('translate')
    if (translate !== 'no') {
      element.removeAttribute('translate')
    }
  }
}

function processAnchorElement(element: Element): void {
  // Check if href has unsupported protocol
  const href = element.getAttribute('href')
  if (href) {
    const scheme = getScheme(href)
    if (scheme !== null && scheme !== 'relative' && !LINK_PROTOCOLS.includes(scheme)) {
      // Remove the href to disable the link
      element.removeAttribute('href')
    }
  }
}

function processClassWhitelist(element: Element): void {
  const classList = element.className.split(/[\t\n\f\r ]+/).filter(Boolean)
  const whitelisted = classList.filter(className => {
    // microformats classes
    if (/^[hpuedt]-/.test(className)) return true
    // semantic classes
    if (/^(mention|hashtag)$/.test(className)) return true
    // link formatting classes
    if (/^(ellipsis|invisible)$/.test(className)) return true
    // quote inline class
    if (className === 'quote-inline') return true
    return false
  })

  if (whitelisted.length > 0) {
    element.className = whitelisted.join(' ')
  } else {
    element.removeAttribute('class')
  }
}

function getScheme(url: string): string | null {
  const match = url.match(PROTOCOL_REGEX)
  if (match) {
    return match[1].toLowerCase()
  }
  // Check if it's a relative URL
  if (url.startsWith('/') || url.startsWith('.')) {
    return 'relative'
  }
  return null
}

function extractMathAnnotation(mathElement: Element): string | null {
  const semantics = Array.from(mathElement.children).find(
    child => child.tagName.toLowerCase() === 'semantics',
  ) as Element | undefined

  if (!semantics) return null

  // Look for LaTeX annotation (application/x-tex)
  const latexAnnotation = Array.from(semantics.children).find(child => {
    return (
      child.tagName.toLowerCase() === 'annotation' &&
      child.getAttribute('encoding') === 'application/x-tex'
    )
  })

  if (latexAnnotation) {
    const display = mathElement.getAttribute('display')
    const text = latexAnnotation.textContent || ''
    return display === 'block' ? `$$${text}$$` : `$${text}$`
  }

  // Look for plain text annotation
  const plainAnnotation = Array.from(semantics.children).find(child => {
    return (
      child.tagName.toLowerCase() === 'annotation' &&
      child.getAttribute('encoding') === 'text/plain'
    )
  })

  if (plainAnnotation) {
    return plainAnnotation.textContent || null
  }

  return null
}
