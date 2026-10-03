import {Text as EmojiMetricsText} from 'react-native'
import {Image, type ImageProps} from 'expo-image'

export function InlineImage({
  size,
  baselineOffset: _baselineOffset,
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
      <Image
        {...props}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </span>
  )
}
