import {Text as EmojiMetricsText} from 'react-native'
import {Image, type ImageProps} from 'expo-image'

export function InlineImage({
  size,
  baselineOffset = 0,
  ...props
}: {size: number; baselineOffset?: number} & Omit<ImageProps, 'style'>) {
  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        fontSize: size,
        lineHeight: 'normal',
        whiteSpace: 'nowrap',
        verticalAlign: 'baseline',
      }}>
      {/* Raw text inherits the emoji font without applying ALF scaling again. */}
      <EmojiMetricsText
        aria-hidden
        selectable={false}
        style={{fontFamily: 'inherit', fontSize: size, opacity: 0}}>
        🟦
      </EmojiMetricsText>
      {/*
        Sized to the glyph box, not the line box: filling the parent would make
        the image the height of the line (leading included) and read larger than
        the emoji glyph beside it.
      */}
      <Image
        {...props}
        style={{
          position: 'absolute',
          left: 0,
          bottom: -baselineOffset,
          width: size,
          height: size,
        }}
      />
    </span>
  )
}
