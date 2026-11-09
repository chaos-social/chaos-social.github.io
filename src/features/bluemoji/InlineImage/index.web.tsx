import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {Image, type ImageProps} from 'expo-image'

import {useEmojiFont} from '#/state/preferences/emoji-font/context'

/** Emoji the browser draws from the same font as the surrounding text. */
const PROBE = '🟦'

type Box = {
  /** Width of the glyph's advance, which the slot reserves. */
  width: number
  /** Height of the glyph's content box, which the image fills. */
  height: number
  /** Distance from the slot's bottom up to the glyph's content bottom. */
  offsetBottom: number
}

export function InlineImage({
  size,
  baselineOffset: _baselineOffset,
  ...props
}: {size: number; baselineOffset?: number} & Omit<ImageProps, 'style'>) {
  const emojiFont = useEmojiFont()
  const probe = useRef<HTMLSpanElement>(null)
  const [box, setBox] = useState<Box>()

  /*
   * Size the slot from what the browser actually paints for an emoji rather
   * than deriving it from the font size: an emoji's ink is taller and wider
   * than its nominal size, and the ratio depends on the emoji font in use, so
   * the glyph itself is the only reliable measurement. Native does the same,
   * reading the advance from `onTextLayout`.
   */
  const measure = () => {
    const element = probe.current
    if (!element) return
    /*
     * The element's box is the line box, which a line-height pads with leading.
     * A range over its text is the glyph's own content box instead, and the
     * gap between the two bottoms is the leading the image has to step over.
     */
    const range = document.createRange()
    range.selectNodeContents(element)
    const glyph = range.getBoundingClientRect()
    if (!glyph.width || !glyph.height) return
    const offsetBottom = element.getBoundingClientRect().bottom - glyph.bottom

    setBox(previous =>
      previous?.width === glyph.width &&
      previous.height === glyph.height &&
      previous.offsetBottom === offsetBottom
        ? previous
        : {width: glyph.width, height: glyph.height, offsetBottom},
    )
  }

  useLayoutEffect(measure, [size, emojiFont])

  // A webfont can land after first paint; measure again when it does.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (!cancelled) measure()
    })
    return () => {
      cancelled = true
    }
  }, [size, emojiFont])

  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        verticalAlign: 'baseline',
        // Until the first measurement the probe alone holds the slot open, so
        // there is no layout jump - only the image appearing.
        ...(box && {width: box.width, height: box.height}),
      }}>
      {/* In flow, so the browser sizes it exactly like the emoji beside it. */}
      <span
        ref={probe}
        aria-hidden
        style={{
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
        {PROBE}
      </span>
      {/*
        Square, as tall as the glyph. The slot is a little wider than the glyph
        (emoji advances include side bearings), so taking the height rather than
        the width keeps the image from looking larger than the real emoji.
      */}
      <Image
        {...props}
        style={{
          position: 'absolute',
          bottom: box?.offsetBottom ?? 0,
          left: '50%',
          transform: [{translateX: '-50%'}],
          height: box?.height ?? '100%',
          aspectRatio: 1,
        }}
      />
    </span>
  )
}
