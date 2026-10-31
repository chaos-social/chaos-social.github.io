import {useMemo} from 'react'
import {type StyleProp, type TextStyle} from 'react-native'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'

import {type HtmlSegment, segmentsToText} from '#/lib/strings/bridged-html'
import {isRTLText} from '#/lib/strings/text-direction'
import {toShortUrl} from '#/lib/strings/url-helpers'
import {android, atoms as a, flatten, type TextStyleProp, useTheme} from '#/alf'
import {isOnlyEmoji} from '#/alf/typography'
import {InlineLinkText, type LinkProps} from '#/components/Link'
import {ProfileHoverCard} from '#/components/ProfileHoverCard'
import {RichTextTag} from '#/components/RichTextTag'
import {Text, type TextProps} from '#/components/Typography'
import {IS_ANDROID, IS_NATIVE} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

const WORD_WRAP = {wordWrap: 1}
// lifted from facet detection in `RichText` impl, _without_ `gm` flags
const URL_REGEX =
  /(^|\s|\()(?!javascript:)([a-z][a-z0-9+.-]*:\/\/[\S]+|(?:[a-z0-9]+\.)+[a-z0-9]+(:[0-9]+)?[\S]*|[a-z][a-z0-9+.-]*:[^\s()]+)/i

export type RichTextProps = TextStyleProp &
  Pick<TextProps, 'selectable' | 'onLayout' | 'onTextLayout'> & {
    value: RichTextAPI | string
    testID?: string
    numberOfLines?: number
    disableLinks?: boolean
    enableTags?: boolean
    authorHandle?: string
    onLinkPress?: LinkProps['onPress']
    interactiveStyle?: StyleProp<TextStyle>
    emojiMultiplier?: number
    shouldProxyLinks?: boolean
    suffix?: React.ReactNode
    /**
     * How far below the text baseline `suffix` extends, in px.
     *
     * Android clips inline views that are translated below the measured text
     * bounds. Reserve matching room there and cancel it with a negative margin
     * so content following the text does not move. iOS allows inline attachment
     * overflow through `RNUITextView` and does not need this compensation.
     *
     * Overrides any `paddingBottom`/`marginBottom` set via `style` on Android.
     */
    suffixOffset?: number
    /**
     * DANGEROUS: Disable facet lexicon validation
     *
     * `detectFacetsWithoutResolution()` generates technically invalid facets,
     * with a handle in place of the DID. This means that RichText that uses it
     * won't be able to render links.
     *
     * Use with care - only use if you're rendering facets you're generating yourself.
     */
    disableMentionFacetValidation?: true
    /**
     * Formatted text from a bridged fediverse post, rendered instead of
     * `value`. Mention facets on `value` are still used to link mentions to
     * profiles.
     */
    htmlSegments?: HtmlSegment[]
  }

export function RichText({
  testID,
  value,
  style,
  numberOfLines,
  disableLinks,
  selectable,
  enableTags = false,
  authorHandle,
  onLinkPress,
  interactiveStyle,
  emojiMultiplier = 1.85,
  onLayout,
  onTextLayout,
  shouldProxyLinks,
  suffix,
  suffixOffset = 0,
  disableMentionFacetValidation,
  htmlSegments,
}: RichTextProps) {
  const richText = useMemo(() => {
    if (value instanceof RichTextAPI) {
      return value
    } else {
      const rt = new RichTextAPI({text: value})
      rt.detectFacetsWithoutResolution()
      return rt
    }
  }, [value])

  const t = useTheme()
  const {facets} = richText
  const text = htmlSegments ? segmentsToText(htmlSegments) : richText.text
  const plainStyles: StyleProp<TextStyle> = [
    style,
    IS_NATIVE && isRTLText(text) ? {textAlign: 'right'} : null,
  ]
  const suffixStyles =
    suffix && suffixOffset
      ? android({paddingBottom: suffixOffset, marginBottom: -suffixOffset})
      : null
  const interactiveStyles = [plainStyles, interactiveStyle]

  if (!facets?.length && !htmlSegments) {
    if (isOnlyEmoji(text)) {
      const flattenedStyle = flatten(style)
      const fontSize =
        (flattenedStyle.fontSize ?? a.text_sm.fontSize) * emojiMultiplier
      return (
        <Text
          emoji
          selectable={selectable}
          testID={testID}
          style={[plainStyles, {fontSize}, suffixStyles]}
          onLayout={onLayout}
          onTextLayout={onTextLayout}
          dataSet={WORD_WRAP}>
          {text}
          {suffix ? ' ' : null}
          {suffix}
        </Text>
      )
    }
    return (
      <Text
        emoji
        selectable={selectable}
        testID={testID}
        style={[plainStyles, suffixStyles]}
        numberOfLines={numberOfLines}
        onLayout={onLayout}
        onTextLayout={onTextLayout}
        dataSet={WORD_WRAP}>
        {text}
        {suffix ? ' ' : null}
        {suffix}
      </Text>
    )
  }

  const els = []
  let key = 0
  if (htmlSegments) {
    const mentionDids = new Map<string, string>()
    for (const segment of richText.segments()) {
      if (
        segment.mention &&
        bsky.matches(app.bsky.richtext.facet.mention, segment.mention)
      ) {
        mentionDids.set(segment.text, segment.mention.did)
      }
    }
    for (const segment of htmlSegments) {
      const did =
        segment.mention && (segment.did ?? mentionDids.get(segment.text))
      if (!disableLinks && did) {
        els.push(
          <ProfileHoverCard key={key} did={did}>
            <InlineLinkText
              selectable={selectable}
              to={`/profile/${did}`}
              style={interactiveStyles}
              // @ts-expect-error TODO
              dataSet={WORD_WRAP}
              shouldProxy={shouldProxyLinks}
              onPress={onLinkPress}>
              {segment.text}
            </InlineLinkText>
          </ProfileHoverCard>,
        )
      } else if (!disableLinks && segment.link) {
        els.push(
          <InlineLinkText
            selectable={selectable}
            key={key}
            to={segment.link}
            style={interactiveStyles}
            // @ts-expect-error TODO
            dataSet={WORD_WRAP}
            shareOnLongPress
            shouldProxy={shouldProxyLinks}
            onPress={onLinkPress}
            emoji>
            {segment.text}
          </InlineLinkText>,
        )
      } else if (!disableLinks && enableTags && segment.tag) {
        els.push(
          <RichTextTag
            key={key}
            display={segment.text}
            tag={segment.tag}
            textStyle={interactiveStyles}
            authorHandle={authorHandle}
          />,
        )
      } else if (
        segment.bold ||
        segment.italic ||
        segment.underline ||
        segment.strike ||
        segment.code ||
        segment.quote
      ) {
        els.push(
          <Text
            key={key}
            emoji
            selectable={selectable}
            style={[
              plainStyles,
              segment.bold && a.font_bold,
              segment.italic && a.italic,
              segment.underline && a.underline,
              segment.strike && a.strike_through,
              segment.quote && t.atoms.text_contrast_medium,
              segment.code && {
                fontFamily: IS_ANDROID ? 'monospace' : 'Courier New',
              },
            ]}>
            {segment.text}
          </Text>,
        )
      } else {
        els.push(segment.text)
      }
      key++
    }
  } else {
    // N.B. must access segments via `richText.segments`, not via destructuring
    for (const segment of richText.segments()) {
      const link = segment.link
      const mention = segment.mention
      const tag = segment.tag

      if (
        mention &&
        (disableMentionFacetValidation ||
          bsky.matches(app.bsky.richtext.facet.mention, mention)) &&
        !disableLinks
      ) {
        els.push(
          <ProfileHoverCard key={key} did={mention.did}>
            <InlineLinkText
              selectable={selectable}
              to={`/profile/${mention.did}`}
              style={interactiveStyles}
              // @ts-expect-error TODO
              dataSet={WORD_WRAP}
              shouldProxy={shouldProxyLinks}
              onPress={onLinkPress}>
              {segment.text}
            </InlineLinkText>
          </ProfileHoverCard>,
        )
      } else if (link && bsky.matches(app.bsky.richtext.facet.link, link)) {
        const isValidLink = URL_REGEX.test(link.uri)
        if (!isValidLink || disableLinks) {
          els.push(toShortUrl(segment.text))
        } else {
          els.push(
            <InlineLinkText
              selectable={selectable}
              key={key}
              to={link.uri}
              style={interactiveStyles}
              // @ts-expect-error TODO
              dataSet={WORD_WRAP}
              shareOnLongPress
              shouldProxy={shouldProxyLinks}
              onPress={onLinkPress}
              emoji>
              {toShortUrl(segment.text)}
            </InlineLinkText>,
          )
        }
      } else if (
        !disableLinks &&
        enableTags &&
        tag &&
        bsky.matches(app.bsky.richtext.facet.tag, tag)
      ) {
        els.push(
          <RichTextTag
            key={key}
            display={segment.text}
            tag={tag.tag}
            textStyle={interactiveStyles}
            authorHandle={authorHandle}
          />,
        )
      } else {
        els.push(segment.text)
      }
      key++
    }
  }

  return (
    <Text
      emoji
      selectable={selectable}
      testID={testID}
      style={[plainStyles, suffixStyles]}
      numberOfLines={numberOfLines}
      onLayout={onLayout}
      onTextLayout={onTextLayout}
      dataSet={WORD_WRAP}>
      {els}
      {suffix ? ' ' : null}
      {suffix}
    </Text>
  )
}
