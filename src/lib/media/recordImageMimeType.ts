import {type BlobRef, getBlobCidString} from '@atproto/lex'

import {getImageBlobRef} from '#/lib/media/util'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/** Matches a CDN image to its record blob rather than assuming image order. */
export function getRecordImageMimeType(uri: string, record: unknown) {
  const ref = getImageBlobRef(uri)
  if (!ref || !bsky.isType(app.bsky.feed.post, record)) return undefined
  let embed = record.embed
  if (bsky.isType(app.bsky.embed.recordWithMedia, embed)) embed = embed.media

  let blobs: BlobRef[] = []
  if (bsky.isType(app.bsky.embed.images, embed)) {
    blobs = embed.images.map(image => image.image)
  } else if (bsky.isType(app.bsky.embed.gallery, embed)) {
    blobs = embed.items
      .filter(item => bsky.isType(app.bsky.embed.gallery.image, item))
      .map(item => item.image)
  } else if (
    bsky.isType(app.bsky.embed.external, embed) &&
    embed.external.thumb
  ) {
    blobs = [embed.external.thumb]
  }
  return blobs.find(blob => getBlobCidString(blob) === ref.cid)?.mimeType
}
