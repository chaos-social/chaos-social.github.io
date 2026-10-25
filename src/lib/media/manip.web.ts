import {getMediaDownloadFilename} from '#/lib/media/downloadFilename'
import {compressImageSource} from '#/lib/media/image/compress'
import {formatToFileExt, imageMimeToExtension} from '#/lib/media/image-formats'
import {getDownloadImageUri} from '#/lib/media/original-image'
import {type PickerImage} from './picker.shared'
import {type Dimensions} from './types'
import {blobToDataUri, extractDataUriMime} from './util'
import {mimeToExt} from './video/util'

export async function compressIfNeeded(
  img: PickerImage,
  {maxDimension, maxSize}: {maxDimension: number; maxSize: number},
): Promise<PickerImage> {
  if (
    img.size <= maxSize &&
    img.width <= maxDimension &&
    img.height <= maxDimension
  ) {
    return img
  }
  return await doResize(img.path, {maxDimension, maxSize}, img.mime)
}

export interface DownloadAndResizeOpts {
  uri: string
  maxDimension: number
  maxSize: number
  timeout: number
}

export async function downloadAndResize(opts: DownloadAndResizeOpts) {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), opts.timeout || 5e3)
  const res = await fetch(opts.uri)
  const resBody = await res.blob()
  clearTimeout(to)

  const dataUri = await blobToDataUri(resBody)
  return await doResize(dataUri, {
    maxDimension: opts.maxDimension,
    maxSize: opts.maxSize,
  })
}

export function shareImageModal(_opts: {uri: string}) {
  // TODO
  throw new Error('TODO')
}

/**
 * Downloads source bytes for Original, or the chosen CDN conversion. A local
 * blob URL preserves MIME when CORS is available. Bluesky CDN attachments must
 * use browser navigation: their download preset intentionally omits CORS headers.
 */
export async function saveImageToMediaLibrary({
  uri,
  format = 'original',
  downloadName,
}: {
  uri: string
  format?: string
  downloadName?: string
}) {
  const downloadUri = await getDownloadImageUri(uri, format)
  const url = new URL(downloadUri, window.location.href)
  if (
    url.origin === 'https://cdn.bsky.app' &&
    url.pathname.startsWith('/img/download/')
  ) {
    downloadUrl(
      downloadUri,
      getMediaDownloadFilename({
        downloadName,
        uri,
        extension: formatToFileExt(format),
        kind: 'image',
      }),
      true,
    )
    return
  }
  const response = await fetch(downloadUri)
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`)
  const blob = await response.blob()
  const extension =
    imageMimeToExtension(blob.type) ??
    (format === 'original' ? 'bin' : formatToFileExt(format))
  const localUrl = URL.createObjectURL(blob)
  try {
    downloadUrl(
      localUrl,
      getMediaDownloadFilename({downloadName, uri, extension, kind: 'image'}),
    )
  } finally {
    setTimeout(() => URL.revokeObjectURL(localUrl), 1000)
  }
}

export async function downloadVideoWeb({
  uri,
  downloadName,
}: {
  uri: string
  downloadName?: string
}) {
  // download the file to cache
  const downloadResponse = await fetch(uri)
    .then(res => res.blob())
    .catch(() => null)
  if (downloadResponse == null) return false
  const extension = mimeToExt(downloadResponse.type)

  const blobUrl = URL.createObjectURL(downloadResponse)
  try {
    downloadUrl(
      blobUrl,
      getMediaDownloadFilename({downloadName, uri, extension, kind: 'video'}),
    )
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }
  return true
}

export async function getImageDim(path: string): Promise<Dimensions> {
  var img = document.createElement('img')
  const promise = new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })
  img.src = path
  await promise
  return {width: img.width, height: img.height}
}

// internal methods
// =

interface DoResizeOpts {
  maxDimension: number
  maxSize: number
}

async function doResize(
  dataUri: string,
  opts: DoResizeOpts,
  mime = extractDataUriMime(dataUri),
): Promise<PickerImage> {
  const {width, height} = await getImageDim(dataUri)
  return compressImageSource({path: dataUri, width, height, mime}, opts)
}

export function saveBytesToDisk(
  filename: string,
  bytes: Uint8Array,
  type: string,
) {
  /*
   * Bytes handed to us are never SharedArrayBuffer-backed, but the broader
   * Uint8Array parameter type matches the native variant.
   */
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {type})
  const url = URL.createObjectURL(blob)
  downloadUrl(url, filename)
  // Firefox requires a small delay
  setTimeout(() => URL.revokeObjectURL(url), 100)
  return true
}

function downloadUrl(href: string, filename: string, external = false) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  if (external) {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function safeDeleteAsync() {
  // no-op
}
