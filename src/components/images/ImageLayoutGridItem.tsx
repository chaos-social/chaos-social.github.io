import {Pressable, type StyleProp, View, type ViewStyle} from 'react-native'
import {type AnimatedRef} from 'react-native-reanimated'
import {Image, type ImageStyle} from 'expo-image'
import {utils} from '@bsky.app/alf'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {type DownloadableImage} from '#/lib/media/downloadFilename'
import {type Dimensions} from '#/lib/media/types'
import {getShapeRadius, SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useLargeAltBadgeEnabled} from '#/state/preferences/large-alt-badge'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {atoms as a, tokens, useTheme} from '#/alf'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import {ImageContextMenu} from '#/components/Post/Embed/ImageContextMenu'
import {type PostEmbedViewContext} from '#/components/Post/Embed/types'
import {Text} from '#/components/Typography'

type EventFunction = (index: number) => void

interface Props {
  images: DownloadableImage[]
  index: number
  onPress?: (
    index: number,
    containerRefs: AnimatedRef<any>[],
    fetchedDims: (Dimensions | null)[],
  ) => void
  onLongPress?: EventFunction
  onPressIn?: EventFunction
  imageStyle?: StyleProp<ImageStyle>
  viewContext?: PostEmbedViewContext
  isWithinQuote?: boolean
  insetBorderStyle?: StyleProp<ViewStyle>
  containerRefs: AnimatedRef<any>[]
  thumbDimsRef: React.RefObject<(Dimensions | null)[]>
}

export function GalleryItem({
  images,
  index,
  imageStyle,
  onPress,
  onPressIn,
  onLongPress,
  insetBorderStyle,
  containerRefs,
  thumbDimsRef,
}: Props) {
  const shapePreference = useEnableSquareButtons()

  const t = useTheme()
  const {_} = useLingui()
  const largeAltBadge = useLargeAltBadgeEnabled()
  const thumbnailFormat = useThumbnailFormat()
  const imageCdnHost = useImageCdnHost()
  const image = images[index]
  const hasAlt = !!image.alt

  const aspect =
    image.aspectRatio && image.aspectRatio.height > 0
      ? image.aspectRatio.width / image.aspectRatio.height
      : undefined

  // The tap handler and the peek-commit handler do the same thing: open the
  // lightbox with this cell's ref + dims so the lightbox's return animation
  // can target the original thumbnail.
  const openLightboxAtIndex = onPress
    ? () => onPress(index, containerRefs, thumbDimsRef.current.slice())
    : undefined

  return (
    <View style={a.flex_1} ref={containerRefs[index]} collapsable={false}>
      <ImageContextMenu
        fullsizeUri={image.fullsize}
        downloadName={image.downloadName}
        thumbUri={image.thumb}
        aspectRatio={aspect}
        borderRadius={getShapeRadius(
          shapePreference,
          tokens.borderRadius.md,
          tokens.borderRadius.md,
        )}
        onPreviewPress={openLightboxAtIndex}
        style={a.flex_1}>
        <Pressable
          onPress={openLightboxAtIndex}
          onPressIn={onPressIn ? () => onPressIn(index) : undefined}
          onLongPress={onLongPress ? () => onLongPress(index) : undefined}
          android_ripple={{
            color: utils.alpha(t.atoms.bg.backgroundColor, 0.2),
            foreground: true,
          }}
          style={[
            a.flex_1,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
            imageStyle,
          ]}
          accessibilityRole="button"
          accessibilityLabel={image.alt || _(msg`Image`)}
          accessibilityHint="">
          <Image
            source={{
              uri: applyImageTransforms(image.thumb, {
                imageCdnHost,
                format: thumbnailFormat,
              }),
            }}
            style={[a.flex_1]}
            accessible={true}
            accessibilityLabel={image.alt}
            accessibilityHint=""
            accessibilityIgnoresInvertColors
            onLoad={e => {
              thumbDimsRef.current[index] = {
                width: e.source.width,
                height: e.source.height,
              }
            }}
            loading="lazy"
            useAppleWebpCodec
          />
          <MediaInsetBorder style={insetBorderStyle} />
        </Pressable>
      </ImageContextMenu>
      {hasAlt ? (
        <View
          accessible={false}
          style={[
            a.absolute,
            a.flex_row,
            a.align_center,
            a.rounded_sm,
            a.p_xs,
            t.atoms.bg_contrast_25,
            {
              bottom: a.p_xs.padding,
              right: a.p_xs.padding,
              opacity: 0.8,
            },
            largeAltBadge && [
              {
                padding: 6,
              },
            ],
            shapePreference === 'sharp' && SHARP_CORNERS,
          ]}>
          <Text
            style={[a.font_bold, largeAltBadge ? a.text_xs : {fontSize: 8}]}>
            <Trans>ALT</Trans>
          </Text>
        </View>
      ) : null}
    </View>
  )
}
