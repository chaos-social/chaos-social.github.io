import {isDid} from '@atproto/api'

import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {convertCdnPreset, getImageBlobRef, modifyImageFormat} from './util'

/** Resolves source bytes from the image owner's PDS, independent of the CDN. */
export async function resolveOriginalImageUri(uri: string): Promise<string> {
  const ref = getImageBlobRef(uri)
  if (!ref) return uri
  if (!isDid(ref.did)) throw new Error('Invalid image owner DID')
  const pdsUrl = await resolvePdsServiceUrl(ref.did)
  if (!pdsUrl) throw new Error('Image owner has no PDS endpoint')
  const original = new URL('/xrpc/com.atproto.sync.getBlob', pdsUrl)
  original.searchParams.set('did', ref.did)
  original.searchParams.set('cid', ref.cid)
  return original.toString()
}

export async function getDownloadImageUri(uri: string, format: string) {
  return format === 'original'
    ? resolveOriginalImageUri(uri)
    : modifyImageFormat(convertCdnPreset(uri, 'download'), format)
}
