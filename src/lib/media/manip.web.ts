import {getMediaDownloadFilename} from '#/lib/media/downloadFilename'
import {formatToFileExt, imageMimeToExtension} from '#/lib/media/image-formats'
import {getDownloadImageUri} from '#/lib/media/original-image'
import {type PickerImage} from './picker.shared'
import {type Dimensions} from './types'
import {blobToDataUri, getDataUriSize, getResizedDimensions} from './util'
import {mimeToExt} from './video/util'

export async function compressIfNeeded(
  img: PickerImage,
  {maxDimension, maxSize}: {maxDimension: number; maxSize: number},
): Promise<PickerImage> {
  if (img.size < maxSize) {
    return img
  }
  return await doResize(img.path, {
    maxDimension,
    maxSize,
  })
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
): Promise<PickerImage> {
  const sourceDims = await getImageDim(dataUri)
  const newDimensions = getResizedDimensions(sourceDims, opts.maxDimension)

  let newDataUri

  let minQualityPercentage = 0
  let maxQualityPercentage = 101 //exclusive

  while (maxQualityPercentage - minQualityPercentage > 1) {
    const qualityPercentage = Math.round(
      (maxQualityPercentage + minQualityPercentage) / 2,
    )
    const tempDataUri = await createResizedImage(dataUri, {
      width: newDimensions.width,
      height: newDimensions.height,
      quality: qualityPercentage / 100,
      mode: 'contain',
    })

    if (getDataUriSize(tempDataUri) < opts.maxSize) {
      minQualityPercentage = qualityPercentage
      newDataUri = tempDataUri
    } else {
      maxQualityPercentage = qualityPercentage
    }
  }

  if (!newDataUri) {
    throw new Error('Failed to compress image')
  }
  return {
    path: newDataUri,
    mime: 'image/png',
    size: getDataUriSize(newDataUri),
    width: newDimensions.width,
    height: newDimensions.height,
  }
}

function createResizedImage(
  dataUri: string,
  {
    width,
    height,
    quality,
    mode,
  }: {
    width: number
    height: number
    quality: number
    mode: 'contain' | 'cover' | 'stretch'
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return reject(new Error('Failed to resize image'))
      }

      let scale = 1
      if (mode === 'cover') {
        scale = img.width < img.height ? width / img.width : height / img.height
      } else if (mode === 'contain') {
        scale = img.width > img.height ? width / img.width : height / img.height
      }
      let w = img.width * scale
      let h = img.height * scale

      canvas.width = w
      canvas.height = h

      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png', quality))
    })
    img.addEventListener('error', ev => {
      reject(ev.error)
    })
    img.src = dataUri
  })
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
