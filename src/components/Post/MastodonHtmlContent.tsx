import {useMemo} from 'react'
import {type StyleProp, type TextStyle, View, ViewStyle} from 'react-native'
import {type AppBskyFeedPost} from '@atproto/api'

import {sanitizeHtml} from '#/lib/strings/html-sanitizer'
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

    const fullText = (record as any).fullText as string | undefined
    const bridgyOriginalText = (record as any).bridgyOriginalText as
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

  const htmlContent = useMemo(() => {
    if (!renderMastodonHtml) return null

    const fullText = (record as any).fullText as string | undefined
    const bridgyOriginalText = (record as any).bridgyOriginalText as
      | string
      | undefined

    const rawHtml = fullText || bridgyOriginalText

    if (!rawHtml) return null

    return sanitizeHtml(rawHtml)
  }, [record, renderMastodonHtml])

  const renderedContent = useMemo(() => {
    if (!htmlContent) return null

    // Parse and render with React components on all platforms
    return renderHtmlAsReact(htmlContent, numberOfLines, textStyle)
  }, [htmlContent, numberOfLines, textStyle])

  if (!renderedContent) return null

  return <View style={style}>{renderedContent}</View>
}

function renderHtmlAsReact(
  html: string,
  _numberOfLines?: number,
  inputTextStyle?: StyleProp<TextStyle>,
): React.ReactNode {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const textStyle: StyleProp<TextStyle> = [
    atoms.leading_snug,
    atoms.text_md,
    inputTextStyle,
  ]

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
      const children = Array.from(element.childNodes).map((child, i) =>
        renderNode(child, i, insideLink || element.tagName.toLowerCase() === 'a'),
      )

      switch (element.tagName.toLowerCase()) {
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
              <P style={{...textStyle, fontFamily: 'monospace'}}>{children}</P>
            </View>
          )
        case 'code':
          return (
            <Text key={key} style={{...textStyle, fontFamily: 'monospace', backgroundColor: '#f5f5f5', paddingHorizontal: 4, borderRadius: 2}}>
              {children}
            </Text>
          )
        case 'strong':
        case 'b':
          return (
            <Text key={key} style={{...textStyle, fontWeight: 'bold'}}>
              {children}
            </Text>
          )
        case 'em':
        case 'i':
          return (
            <Text key={key} style={{...textStyle, fontStyle: 'italic'}}>
              {children}
            </Text>
          )
        case 'u':
          return (
            <Text key={key} style={{...textStyle, textDecorationLine: 'underline'}}>
              {children}
            </Text>
          )
        case 'del':
          return (
            <Text key={key} style={{...textStyle, textDecorationLine: 'line-through'}}>
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
          const start = element.getAttribute('start')
          const reversed = element.getAttribute('reversed') !== null
          return (
            <View key={key} style={{marginVertical: 4}} data-start={start} data-reversed={reversed}>
              {children}
            </View>
          )
        case 'li':
          const value = element.getAttribute('value')
          const parentIsOl = element.parentElement?.tagName.toLowerCase() === 'ol'
          return (
            <View key={key} style={{flexDirection: 'row', marginVertical: 2}}>
              <Text style={{...textStyle, marginRight: 8}}>{parentIsOl ? (value || '•') : '•'}</Text>
              <Text style={{...textStyle, flex: 1}}>{children}</Text>
            </View>
          )
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
                style={isInvisible ? {width: 0, height: 0, position: 'absolute'} : textStyle}>
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
            return null
          }
          if (spanClass?.includes('ellipsis')) {
            // If inside a link, return plain text, otherwise wrapped
            if (insideLink) {
              return '…'
            }
            return <Text key={key} style={textStyle}>…</Text>
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
        case 'div':
          return <P key={key} style={textStyle}>{children}</P>
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
