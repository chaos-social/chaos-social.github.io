import {useRef} from 'react'
import {View} from 'react-native'
import {type AnimatedRef} from 'react-native-reanimated'
import {Image} from 'expo-image'

import {getPostMediaDownloadName} from '#/lib/media/downloadFilename'
import {resolveEmbedImageUris} from '#/lib/media/embed-image-formats'
import {getRecordImageMimeType} from '#/lib/media/recordImageMimeType'
import {getShapeRadius} from '#/lib/shapes'
import {userStyle} from '#/lib/userstyles'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useFullsizeFormat} from '#/state/preferences/fullsize-format'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useLoadAsPngs} from '#/state/preferences/load-small-pngs'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {atoms as a, tokens} from '#/alf'
import {AutoSizedImage} from '#/components/images/AutoSizedImage'
import {Gallery} from '#/components/images/Gallery'
import {ImageLayoutGrid} from '#/components/images/ImageLayoutGrid'
import {
  type LightboxMetricsContext,
  useLightboxControls,
} from '#/components/Lightbox/state'
import {type Dimensions} from '#/components/Lightbox/types'
import {ImageContextMenu} from '#/components/Post/Embed/ImageContextMenu'
import {PostEmbedViewContext} from '#/components/Post/Embed/types'
import {useAnalytics} from '#/analytics'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type EmbedType} from '#/types/bsky/post'
import {type CommonProps} from './types'

const MAX_GRID_IMAGES = 4

export function ImageEmbed({
  embed,
  ...rest
}: CommonProps & {
  embed: EmbedType<'images'> | EmbedType<'gallery'>
}) {
  const shapePreference = useEnableSquareButtons()

  const ax = useAnalytics()
  const {openLightbox} = useLightboxControls()
  const fullsizeFormat = useFullsizeFormat()
  const thumbnailFormat = useThumbnailFormat()
  const loadAsPngs = useLoadAsPngs()
  const imageCdnHost = useImageCdnHost()
  const rawImages: app.bsky.embed.images.ViewImage[] =
    embed.type === 'gallery'
      ? embed.view.items
          .filter(item => bsky.isType(app.bsky.embed.gallery.viewImage, item))
          .map(item => ({
            thumb: item.thumbnail,
            fullsize: item.fullsize,
            alt: item.alt,
            aspectRatio: item.aspectRatio,
          }))
      : embed.view.images
  const images = rawImages.map((img, index) => {
    const uris = resolveEmbedImageUris(
      {
        ...img,
        mimeType: getRecordImageMimeType(img.fullsize, rest.post?.record),
      },
      {
        thumbnailFormat,
        fullsizeFormat: fullsizeFormat ?? 'default',
        loadAsPngs: loadAsPngs ?? true,
      },
    )
    return {
      ...img,
      downloadName: getPostMediaDownloadName(
        rest.post,
        rawImages.length > 1 ? index : undefined,
      ),
      fullsize: uris.fullsize as typeof img.fullsize,
      thumb: uris.thumb as typeof img.thumb,
    }
  })
  const useExpandedLayout =
    embed.type === 'gallery'
      ? images.length > MAX_GRID_IMAGES
      : ax.features.enabled(ax.features.PostGalleryEmbedEnable)

  const layout: 'single' | 'grid' | 'carousel' =
    images.length === 1 ? 'single' : useExpandedLayout ? 'carousel' : 'grid'

  const postContext = rest.post
    ? {
        postUri: rest.post.uri,
        postAuthorDid: rest.post.author.did,
        feedDescriptor: rest.feedDescriptor,
      }
    : undefined
  const metricsContext: LightboxMetricsContext | undefined = postContext
    ? {layout, ...postContext}
    : undefined

  // Captured from AutoSizedImage so the peek-commit handler can reuse the same
  // ref + dims that a tap would — keeps the lightbox's return animation intact.
  const singleContainerRef = useRef<AnimatedRef | null>(null)
  const singleDimsRef = useRef<Dimensions | null>(null)

  if (images.length > 0) {
    const items = images.map(img => {
      return {
        uri: applyImageTransforms(img.fullsize, {imageCdnHost}),
        thumbUri: applyImageTransforms(img.thumb, {imageCdnHost}),
        downloadName: img.downloadName,
        alt: img.alt,
        dimensions: img.aspectRatio ?? null,
      }
    })
    const onPress = (
      index: number,
      refs: AnimatedRef[],
      fetchedDims: (Dimensions | null)[],
    ) => {
      if (postContext) {
        ax.metric('post:photoEmbed:open', {
          layout,
          fromImage: index + 1,
          totalImages: images.length,
          ...postContext,
        })
      }
      openLightbox({
        images: items.map((item, i) => ({
          ...item,
          thumbRect: null,
          thumbRef: refs[i] ?? null,
          thumbDimensions: fetchedDims[i] ?? null,
          thumbBorderRadius: getShapeRadius(
            shapePreference,
            tokens.borderRadius.md,
            tokens.borderRadius.md,
          ),
          type: 'image',
        })),
        index,
        metricsContext,
      })
    }
    const onPressIn = (index: number) => {
      // Start the selected full-size image immediately; other gallery images
      // must not compete with it before the lightbox opens.
      void Image.prefetch(items[index].uri, 'memory').catch(() => {})
    }

    if (images.length === 1) {
      const image = images[0]
      const aspect =
        image.aspectRatio && image.aspectRatio.height > 0
          ? image.aspectRatio.width / image.aspectRatio.height
          : undefined
      const openFromSingle = () => {
        if (singleContainerRef.current) {
          onPress(0, [singleContainerRef.current], [singleDimsRef.current])
        }
      }

      return (
        <View style={[a.mt_sm, rest.style, userStyle('wsky-post__media')]}>
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
            onPreviewPress={openFromSingle}>
            <AutoSizedImage
              crop={
                rest.viewContext === PostEmbedViewContext.ThreadHighlighted
                  ? 'none'
                  : 'constrained'
              }
              image={image}
              onContainerRef={ref => {
                singleContainerRef.current = ref
              }}
              onDimsChange={dims => {
                singleDimsRef.current = dims
              }}
              onPress={(containerRef, dims) =>
                onPress(0, [containerRef], [dims])
              }
              onPressIn={() => onPressIn(0)}
            />
          </ImageContextMenu>
        </View>
      )
    }

    if (useExpandedLayout) {
      return (
        <View style={[a.mt_sm, rest.style, userStyle('wsky-post__media')]}>
          <Gallery
            images={images}
            onPress={onPress}
            onPressIn={onPressIn}
            viewContext={rest.viewContext}
            isWithinQuote={rest.isWithinQuote}
            metricsPostContext={postContext}
          />
        </View>
      )
    }

    return (
      <View style={[a.mt_sm, rest.style, userStyle('wsky-post__media')]}>
        <ImageLayoutGrid
          images={images}
          onPress={onPress}
          onPressIn={onPressIn}
          viewContext={rest.viewContext}
          isWithinQuote={rest.isWithinQuote}
        />
      </View>
    )
  }
}
