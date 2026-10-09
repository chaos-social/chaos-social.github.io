import {type StyleProp, StyleSheet, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {getPostMediaDownloadName} from '#/lib/media/downloadFilename'
import {shareImageModal} from '#/lib/media/manip'
import {useSaveImageToMediaLibrary} from '#/lib/media/save-image'
import {isGifEmbed} from '#/lib/strings/embed-player'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {atoms as a, tokens, useTheme} from '#/alf'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import * as PeekMenu from '#/components/PeekMenu'
import {Text} from '#/components/Typography'
import {PlayButtonIcon} from '#/components/video/PlayButtonIcon'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/**
 * Streamlined MediaPreview component which just handles images, gifs, and videos
 */
export function Embed({
  embed,
  style,
  peekable = false,
  post,
}: {
  embed: app.bsky.feed.defs.PostView['embed']
  style?: StyleProp<ViewStyle>
  post?: {uri: string; author: {handle: string}}
  peekable?: boolean
}) {
  const e = bsky.post.parseEmbed(embed)

  if (!e) return null

  if (e.type === 'images') {
    return (
      <Outer style={style}>
        {e.view.images.map((image, index) =>
          peekable ? (
            <PeekableImageItem
              key={image.thumb}
              image={image}
              downloadName={getPostMediaDownloadName(
                post,
                e.view.images.length > 1 ? index : undefined,
              )}
            />
          ) : (
            <ImageItem
              key={image.thumb}
              thumbnail={image.thumb}
              alt={image.alt}
            />
          ),
        )}
      </Outer>
    )
  } else if (e.type === 'gallery') {
    // Notification/DM preview is a narrow inline strip; cap at 4 tiles so
    // a 10-image gallery doesn't blow out the row width. Single pass instead
    // of filter().slice().map() so we stop at 4 viewable items rather than
    // walking every item in a 10-image gallery.
    const tiles: React.ReactNode[] = []
    for (const item of e.view.items) {
      if (tiles.length >= 4) break
      if (!bsky.isType(app.bsky.embed.gallery.viewImage, item)) continue
      if (peekable) {
        const image: app.bsky.embed.images.ViewImage = {
          thumb: item.thumbnail,
          fullsize: item.fullsize,
          alt: item.alt,
          aspectRatio: item.aspectRatio,
        }
        tiles.push(
          <PeekableImageItem
            key={item.thumbnail}
            image={image}
            downloadName={getPostMediaDownloadName(
              post,
              e.view.items.length > 1 ? tiles.length : undefined,
            )}
          />,
        )
      } else {
        tiles.push(
          <ImageItem
            key={item.thumbnail}
            thumbnail={item.thumbnail}
            alt={item.alt}
          />,
        )
      }
    }
    return <Outer style={style}>{tiles}</Outer>
  } else if (e.type === 'link') {
    if (!e.view.external.thumb) return null
    if (!isGifEmbed(e.view.external.uri)) return null
    return (
      <Outer style={style}>
        <GifItem
          thumbnail={e.view.external.thumb}
          alt={e.view.external.title}
        />
      </Outer>
    )
  } else if (e.type === 'video') {
    return (
      <Outer style={style}>
        {e.view.presentation === 'gif' ? (
          <GifItem
            thumbnail={e.view.thumbnail ? e.view.thumbnail : undefined}
            alt={e.view.alt}
            skipTransforms
          />
        ) : (
          <VideoItem
            thumbnail={e.view.thumbnail ? e.view.thumbnail : undefined}
            alt={e.view.alt}
          />
        )}
      </Outer>
    )
  } else if (
    e.type === 'post_with_media' &&
    // ignore further "nested" RecordWithMedia
    e.media.type !== 'post_with_media' &&
    // ignore any unknowns
    e.media.view !== null
  ) {
    /*
     * Every media arm's view is a `$Typed<...>` of a def that `PostView.embed`
     * also admits, but TS will not narrow the parsed union back into the raw
     * embed union, so the arm is re-asserted here.
     */
    return (
      <Embed
        embed={e.media.view as app.bsky.feed.defs.PostView['embed']}
        peekable={peekable}
        post={post}
        style={style}
      />
    )
  }

  return null
}

export function Outer({
  children,
  style,
}: {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[a.flex_row, a.gap_xs, style]}>{children}</View>
}

export function ImageItem({
  thumbnail,
  alt,
  children,
  maxWidth = 100,
  skipTransforms = false,
}: {
  thumbnail?: string
  alt?: string
  children?: React.ReactNode
  maxWidth?: number
  skipTransforms?: boolean
}) {
  const t = useTheme()
  const thumbnailFormat = useThumbnailFormat()
  const imageCdnHost = useImageCdnHost()

  const displayThumbnail = thumbnail
    ? skipTransforms
      ? thumbnail
      : applyImageTransforms(thumbnail, {
          imageCdnHost,
          format: thumbnailFormat,
        })
    : undefined

  if (!displayThumbnail) {
    return (
      <View
        style={[
          {backgroundColor: 'black'},
          a.flex_1,
          a.aspect_square,
          {maxWidth},
          a.rounded_xs,
        ]}
        accessibilityLabel={alt}
        accessibilityHint="">
        {children}
      </View>
    )
  }

  return (
    <View style={[a.flex_grow, a.relative, a.aspect_square, {maxWidth}]}>
      <Image
        key={displayThumbnail}
        source={{uri: displayThumbnail}}
        alt={alt}
        style={[a.flex_1, a.rounded_xs, t.atoms.bg_contrast_25]}
        contentFit="cover"
        accessible={true}
        accessibilityIgnoresInvertColors
        useAppleWebpCodec
      />
      <MediaInsetBorder style={[a.rounded_xs]} />
      {children}
    </View>
  )
}

export function GifItem({
  thumbnail,
  alt,
  skipTransforms = false,
}: {
  thumbnail?: string
  alt?: string
  skipTransforms?: boolean
}) {
  return (
    <ImageItem thumbnail={thumbnail} alt={alt} skipTransforms={skipTransforms}>
      <View style={[a.absolute, a.inset_0, a.justify_center, a.align_center]}>
        <PlayButtonIcon size={24} />
      </View>
      <View style={styles.altContainer}>
        <Text style={styles.alt}>
          <Trans>GIF</Trans>
        </Text>
      </View>
    </ImageItem>
  )
}

export function VideoItem({
  thumbnail,
  alt,
}: {
  thumbnail?: string
  alt?: string
}) {
  return (
    <ImageItem thumbnail={thumbnail} alt={alt} skipTransforms>
      <View style={[a.absolute, a.inset_0, a.justify_center, a.align_center]}>
        <PlayButtonIcon size={24} />
      </View>
    </ImageItem>
  )
}

function PeekableImageItem({
  image,
  downloadName,
}: {
  image: app.bsky.embed.images.ViewImage
  downloadName?: string
}) {
  const {t: l} = useLingui()
  const saveImage = useSaveImageToMediaLibrary()

  const aspect =
    image.aspectRatio && image.aspectRatio.height > 0
      ? image.aspectRatio.width / image.aspectRatio.height
      : undefined

  return (
    <PeekMenu.Root style={[a.flex_1, {maxWidth: 100}]}>
      <PeekMenu.Trigger
        preview={{
          type: 'image',
          uri: image.fullsize,
          thumbUri: image.thumb,
          aspectRatio: aspect && aspect > 0 ? aspect : 1,
        }}
        borderRadius={tokens.borderRadius.xs}>
        <ImageItem thumbnail={image.thumb} alt={image.alt} />
      </PeekMenu.Trigger>
      <PeekMenu.Menu>
        <PeekMenu.MenuItem
          id="save"
          onSelect={() =>
            void saveImage(image.fullsize, undefined, downloadName)
          }>
          <PeekMenu.MenuItemIcon icon={DownloadIcon} />
          <PeekMenu.MenuItemText>{l`Save image`}</PeekMenu.MenuItemText>
        </PeekMenu.MenuItem>
        <PeekMenu.MenuItem
          id="share"
          onSelect={() => void shareImageModal({uri: image.fullsize})}>
          <PeekMenu.MenuItemIcon icon={ShareIcon} />
          <PeekMenu.MenuItemText>{l`Share`}</PeekMenu.MenuItemText>
        </PeekMenu.MenuItem>
      </PeekMenu.Menu>
    </PeekMenu.Root>
  )
}

const styles = StyleSheet.create({
  altContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: 'absolute',
    left: 5,
    bottom: 5,
    zIndex: 2,
  },
  alt: {
    color: 'white',
    fontSize: 7,
    fontWeight: '600',
  },
})
