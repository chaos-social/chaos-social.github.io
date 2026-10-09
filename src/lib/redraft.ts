import {
  AppBskyEmbedGallery,
  type AppBskyEmbedImages,
  type AppBskyEmbedRecordWithMedia,
  type AppBskyFeedDefs,
  type AppBskyFeedPost,
  type BlobRef,
  type Did,
} from '@atproto/api'

import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'

export type RedraftImage = {
  uri: string
  width: number
  height: number
  altText?: string
  blobRef?: BlobRef
}

/** Restores original image and gallery blobs from the owner's PDS on all platforms. */
export async function getRedraftImages(
  recordEmbed: AppBskyFeedPost.Record['embed'],
  viewEmbed: AppBskyFeedDefs.PostView['embed'],
  ownerDid: Did,
): Promise<RedraftImage[]> {
  const recordMedia =
    recordEmbed?.$type === 'app.bsky.embed.recordWithMedia'
      ? (recordEmbed as AppBskyEmbedRecordWithMedia.Main).media
      : recordEmbed
  const viewMedia =
    viewEmbed?.$type === 'app.bsky.embed.recordWithMedia#view'
      ? (viewEmbed as AppBskyEmbedRecordWithMedia.View).media
      : viewEmbed

  let images: Omit<RedraftImage, 'uri'>[] = []
  if (viewMedia?.$type === 'app.bsky.embed.images#view') {
    const viewImages = (viewMedia as AppBskyEmbedImages.View).images
    const blobs =
      recordMedia?.$type === 'app.bsky.embed.images'
        ? (recordMedia as AppBskyEmbedImages.Main).images.map(
            image => image.image,
          )
        : []
    images = viewImages.map((image, index) => ({
      width: image.aspectRatio?.width ?? 1000,
      height: image.aspectRatio?.height ?? 1000,
      altText: image.alt,
      blobRef: blobs[index],
    }))
  }

  if (viewMedia?.$type === 'app.bsky.embed.gallery#view') {
    const viewItems = (viewMedia as AppBskyEmbedGallery.View).items.filter(
      AppBskyEmbedGallery.isViewImage,
    )
    const blobs =
      recordMedia?.$type === 'app.bsky.embed.gallery'
        ? (recordMedia as AppBskyEmbedGallery.Main).items
            .filter(AppBskyEmbedGallery.isImage)
            .map(image => image.image)
        : []
    images = viewItems.map((image, index) => ({
      width: image.aspectRatio?.width ?? 1000,
      height: image.aspectRatio?.height ?? 1000,
      altText: image.alt,
      blobRef: blobs[index],
    }))
  }

  if (!images.length) return []
  const pdsUrl = await resolvePdsServiceUrl(ownerDid)
  if (!pdsUrl) throw new Error('Image owner has no PDS endpoint')
  return images.map(image => {
    if (!image.blobRef) throw new Error('Redraft image has no original blob')
    const uri = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
    uri.searchParams.set('did', ownerDid)
    uri.searchParams.set('cid', image.blobRef.ref.toString())
    return {...image, uri: uri.toString()}
  })
}
