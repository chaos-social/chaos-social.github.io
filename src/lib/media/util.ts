import {imageMimeToExtension} from '#/lib/media/image-formats'

export function extractDataUriMime(uri: string): string {
  return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'))
}

export function getResizedDimensions(
  originalDims: {
    width: number
    height: number
  },
  maxDimension: number,
) {
  if (
    originalDims.width <= maxDimension &&
    originalDims.height <= maxDimension
  ) {
    return originalDims
  }

  const ratio = Math.min(
    maxDimension / originalDims.width,
    maxDimension / originalDims.height,
  )

  return {
    width: Math.round(originalDims.width * ratio),
    height: Math.round(originalDims.height * ratio),
  }
}

// Fairly accurate estimate that is more performant
// than decoding and checking length of URI
export function getDataUriSize(uri: string): number {
  return Math.round((uri.length * 3) / 4)
}

export function isUriImage(uri: string): boolean {
  return /\.(jpg|jpeg|png|webp).*$/.test(uri)
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read blob'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export type ImgproxyPreset =
  | 'default'
  | 'avatar_thumbnail'
  | 'avatar'
  | 'banner'
  | 'feed_fullsize'
  | 'feed_thumbnail'
  | 'download'

// Using capturing groups here instead of lookbehinds in order to support older versions of Safari.
// https://bugs.webkit.org/show_bug.cgi?id=174931
const IMGPROXY_PRESET_RE =
  /(\/img\/)(default|avatar_thumbnail|avatar|banner|feed_fullsize|feed_thumbnail|download)(\/)/

/**
 * Replaces any imgproxy preset in a CDN URI with the given preset.
 */
export function convertCdnPreset(uri: string, preset: ImgproxyPreset): string {
  return uri.replace(IMGPROXY_PRESET_RE, `$1${preset}$3`)
}

/** Extracts the blob identity from an imgproxy URL on any configured CDN. */
export function getImageBlobRef(uri: string) {
  try {
    const url = new URL(uri)
    const match = url.pathname.match(
      /^\/img\/[^/]+\/plain\/(did:[^/]+)\/([^/@]+)(?:@[^/]+)?$/,
    )
    if (!match) return undefined
    return {did: decodeURIComponent(match[1]), cid: match[2]}
  } catch {
    return undefined
  }
}

/** Preserve non-CDN URLs, including blobs and already-resolved originals. */
export function modifyImageFormat(
  uri: string,
  format: string,
  originalMimeType?: string,
) {
  if (format === 'default') return uri

  const ref = getImageBlobRef(uri)
  if (!ref) return uri
  if (format === 'original') {
    const extension = imageMimeToExtension(originalMimeType)
    // A server URL's existing suffix describes its conversion, not its source.
    if (!extension) return uri
    format = extension === 'jpg' ? 'jpeg' : extension
  }
  const url = new URL(uri)
  url.pathname = url.pathname.replace(/(?:@[^/]*)?$/, `@${format}`)
  return url.toString()
}
