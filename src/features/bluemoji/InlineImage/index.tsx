import {Image, type ImageProps} from 'expo-image'

export function InlineImage({
  size,
  ...props
}: {size: number} & Omit<ImageProps, 'style'>) {
  return <Image {...props} style={{width: size, height: size}} />
}
