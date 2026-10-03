import {Image, type ImageProps} from 'expo-image'

export function InlineImage({
  size,
  baselineOffset = size * 0.05,
  ...props
}: {size: number; baselineOffset?: number} & Omit<ImageProps, 'style'>) {
  return (
    <Image
      {...props}
      style={{
        width: size,
        height: size,
        transform: [{translateY: baselineOffset}],
      }}
    />
  )
}
