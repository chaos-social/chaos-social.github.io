import {AtUri} from '@atproto/syntax'

import {getImageBlobRef} from '#/lib/media/util'
import {type app} from '#/lexicons'

export type DownloadableImage = app.bsky.embed.images.ViewImage & {
  downloadName?: string
}

/** A filename stem shared by all download surfaces for the same post media. */
export function getPostMediaDownloadName(
  post: {uri: string; author: {handle: string}} | undefined,
  index?: number,
) {
  if (!post?.author.handle) return undefined
  try {
    const rkey = new AtUri(post.uri).rkey
    if (!rkey) return undefined
    return `${post.author.handle}-${rkey}${index === undefined ? '' : `-${index + 1}`}`
  } catch {
    return undefined
  }
}

/** Keeps filenames safe on all platforms and uses the downloaded file's type. */
export function getMediaDownloadFilename({
  downloadName,
  uri,
  extension,
  kind,
}: {
  downloadName?: string
  uri: string
  extension: string
  kind: 'image' | 'video'
}) {
  let cid = getImageBlobRef(uri)?.cid
  if (!cid) {
    try {
      cid = new URL(uri).searchParams.get('cid') ?? undefined
    } catch {}
  }
  const fallback = `${kind}${cid ? `-${cid}` : ''}`
  const name = (downloadName || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 180)
  return `witchsky-${name || kind}.${extension}`
}
