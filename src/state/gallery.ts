import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  makeDirectoryAsync,
  moveAsync,
} from 'expo-file-system/legacy'
import {
  type Action,
  type ActionCrop,
  manipulateAsync,
  SaveFormat,
} from 'expo-image-manipulator'
import {type BlobRef} from '@atproto/api'
import {transformExif} from '@uwx/exif-be-gone-web'
import {toByteArray} from 'base64-js'
import {nanoid} from 'nanoid/non-secure'

import {POST_IMG_MAX} from '#/lib/constants'
import {getImageDim} from '#/lib/media/manip'
import {openCropper} from '#/lib/media/picker'
import {type PickerImage} from '#/lib/media/picker.shared'
import {getDataUriSize} from '#/lib/media/util'
import {isCancelledError} from '#/lib/strings/errors'
import {IS_NATIVE, IS_WEB} from '#/env'

export type ImageTransformation = {
  crop?: ActionCrop['crop']
}

export type ImageMeta = {
  path: string
  width: number
  height: number
  mime: string
}

export type ImageSource = ImageMeta & {
  id: string
}

type ComposerImageBase = {
  alt: string
  source: ImageSource
  blobRef?: BlobRef
  /** Original localRef path from draft, if editing an existing draft. Used to reuse the same storage key. */
  localRefPath?: string
}
type ComposerImageWithoutTransformation = ComposerImageBase & {
  transformed?: undefined
  manips?: undefined
}
type ComposerImageWithTransformation = ComposerImageBase & {
  transformed: ImageMeta
  manips?: ImageTransformation
}

export type ComposerImage =
  | ComposerImageWithoutTransformation
  | ComposerImageWithTransformation

let _imageCacheDirectory: string

function getImageCacheDirectory(): string | null {
  if (IS_NATIVE) {
    return (_imageCacheDirectory ??= joinPath(cacheDirectory!, 'bsky-composer'))
  }

  return null
}

export async function createComposerImage(
  raw: ImageMeta,
): Promise<ComposerImageWithoutTransformation> {
  return {
    alt: '',
    source: {
      id: nanoid(),
      // Copy to cache to ensure file survives OS temporary file cleanup
      path: await copyToCache(raw.path),
      width: raw.width,
      height: raw.height,
      mime: raw.mime,
    },
  }
}

export type InitialImage = {
  uri: string
  width: number
  height: number
  altText?: string
  blobRef?: BlobRef
}

export function createInitialImages(
  uris: InitialImage[] = [],
): ComposerImageWithoutTransformation[] {
  return uris.map(({uri, width, height, altText = '', blobRef}) => {
    return {
      alt: altText,
      source: {
        id: nanoid(),
        path: uri,
        width: width,
        height: height,
        mime: 'image/jpeg',
      },
      blobRef,
    }
  })
}

export async function pasteImage(
  uri: string,
): Promise<ComposerImageWithoutTransformation> {
  const {width, height} = await getImageDim(uri)
  const match = /^data:(.+?);/.exec(uri)

  return {
    alt: '',
    source: {
      id: nanoid(),
      path: uri,
      width: width,
      height: height,
      mime: match ? match[1] : 'image/jpeg',
    },
  }
}

export async function cropImage(img: ComposerImage): Promise<ComposerImage> {
  if (!IS_NATIVE) {
    return img
  }

  const source = img.source

  // @todo: we're always passing the original image here, does image-cropper
  // allows for setting initial crop dimensions? -mary
  try {
    const cropped = await openCropper({
      imageUri: source.path,
    })

    return {
      alt: img.alt,
      source: source,
      transformed: {
        path: await moveIfNecessary(cropped.path),
        width: cropped.width,
        height: cropped.height,
        mime: cropped.mime,
      },
    }
  } catch (e) {
    if (!isCancelledError(e)) {
      return img
    }

    throw e
  }
}

export async function manipulateImage(
  img: ComposerImage,
  trans: ImageTransformation,
): Promise<ComposerImage> {
  const rawActions: (Action | undefined)[] = [trans.crop && {crop: trans.crop}]

  const actions = rawActions.filter((a): a is Action => a !== undefined)

  if (actions.length === 0) {
    if (img.transformed === undefined) {
      return img
    }

    return {alt: img.alt, source: img.source}
  }

  const source = img.source
  const result = await manipulateAsync(source.path, actions, {
    format: SaveFormat.PNG,
  })

  return {
    alt: img.alt,
    source: img.source,
    transformed: {
      path: await moveIfNecessary(result.uri),
      width: result.width,
      height: result.height,
      mime: 'image/png',
    },
    manips: trans,
  }
}

export function resetImageManipulation(
  img: ComposerImage,
): ComposerImageWithoutTransformation {
  if (img.transformed !== undefined) {
    return {alt: img.alt, source: img.source}
  }

  return img
}

async function bypassCompression(
  img: ComposerImage,
): Promise<PickerImage | undefined> {
  // TODO: use expo-file-system instead of working directly in memory

  function dataUriToUint8Array(uri: string) {
    const base64 = uri.split(',')[1]
    return toByteArray(base64)
  }

  function toArrayBuffer(uint8: Uint8Array) {
    if (uint8.buffer instanceof ArrayBuffer) {
      if (
        uint8.byteOffset === 0 &&
        uint8.byteLength === uint8.buffer.byteLength
      ) {
        return uint8.buffer
      }

      return uint8.buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength,
      )
    }

    // Fallback for environments where Uint8Array.buffer is not an ArrayBuffer
    const buffer = new ArrayBuffer(uint8.length)
    const view = new Uint8Array(buffer)
    view.set(uint8)
    return buffer
  }

  const source = img.transformed || img.source
  if (
    source.width > POST_IMG_MAX.width ||
    source.height > POST_IMG_MAX.height
  ) {
    return undefined
  }

  if (
    ![
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
    ].includes(source.mime)
  ) {
    return undefined
  }

  let data: Uint8Array

  const path = source.path
  // convert path to data URI if it is not already
  if (!path.startsWith('data:')) {
    try {
      await fetch(path)
      const response = await fetch(path)
      data = new Uint8Array(await response.arrayBuffer())
      if (data.byteLength > POST_IMG_MAX.size) {
        return undefined
      }
    } catch (e) {
      // Fetch failed, likely due to CORS. Return undefined to trigger normal compression flow and error handling.
      return undefined
    }
  } else {
    if (getDataUriSize(path) > POST_IMG_MAX.size) {
      return undefined
    }
    data = new Uint8Array(dataUriToUint8Array(path).buffer)
  }

  try {
    data = await transformExif(data)
  } catch (err) {
    console.error(
      'Failed to transform EXIF data, proceeding with original image',
      err,
    )
    return undefined
  }

  const dataUri = await blobToDataUri(
    new Blob([toArrayBuffer(data)], {type: source.mime}),
  )
  return {
    path: dataUri,
    width: source.width,
    height: source.height,
    mime: source.mime,
    size: getDataUriSize(dataUri),
  }
}

export async function compressImage(
  img: ComposerImage,
  options?: {
    highResolution?: boolean
    increasedBlobSizeLimit?: boolean
  },
): Promise<PickerImage> {
  const res = await bypassCompression(img)
  if (res) {
    return res
  }

  const source = img.transformed || img.source
  const highResolution = options?.highResolution ?? false
  let attempts = 0
  let maxDimension = highResolution ? 4000 : POST_IMG_MAX.width
  let maxBytes = options?.increasedBlobSizeLimit ? 2000000 : POST_IMG_MAX.size

  let minQualityPercentage = 0
  let maxQualityPercentage = 101 // exclusive
  let newDataUri

  while (maxQualityPercentage - minQualityPercentage > 1) {
    if (attempts >= 4) break

    const [w, h] = containImageRes(source.width, source.height, maxDimension)
    const qualityPercentage = Math.round(
      (maxQualityPercentage + minQualityPercentage) / 2,
    )

    /*
     * In the event the image doesn't compress well, we want to avoid
     * unecessary iterations. In this case, binary search will check 51, 26,
     * 13(rounded). We don't want to go below 25, so if we've halved to 13,
     * reset the loop and reduce the image dimensions instead.
     */
    if (qualityPercentage <= 13) {
      minQualityPercentage = 0
      maxQualityPercentage = 101
      attempts++
      // 4000px → 3200px → 2560px → 2048px → ~1638px
      maxDimension = Math.floor(maxDimension * 0.8)
      continue
    }

    const res = await manipulateAsync(
      source.path,
      [{resize: {width: w, height: h}}],
      {
        compress: qualityPercentage / 100,
        format: SaveFormat.WEBP,
        base64: true,
      },
    )

    const base64 = res.base64
    const size = base64 ? getDataUriSize(base64) : 0
    if (base64 && size <= maxBytes) {
      minQualityPercentage = qualityPercentage
      newDataUri = {
        path: await moveIfNecessary(res.uri),
        width: res.width,
        height: res.height,
        mime: 'image/webp',
        size,
      }
    } else {
      maxQualityPercentage = qualityPercentage
    }
  }

  if (newDataUri) {
    return newDataUri
  }

  throw new Error(`Unable to compress image`)
}

async function moveIfNecessary(from: string) {
  const cacheDir = IS_NATIVE && getImageCacheDirectory()

  if (cacheDir && !from.startsWith(cacheDir)) {
    const to = joinPath(cacheDir, nanoid(36))

    await makeDirectoryAsync(cacheDir, {intermediates: true})
    await moveAsync({from, to})

    return to
  }

  return from
}

/**
 * Copy a file from a potentially temporary location to our cache directory.
 * This ensures picker files are available for draft saving even if the original
 * temporary files are cleaned up by the OS.
 *
 * On web, converts blob URLs to data URIs immediately to prevent revocation issues.
 */
async function copyToCache(from: string): Promise<string> {
  // Data URIs don't need any conversion
  if (from.startsWith('data:')) {
    return from
  }

  if (IS_WEB) {
    // Web: convert blob URLs to data URIs before they can be revoked
    if (from.startsWith('blob:')) {
      try {
        const response = await fetch(from)
        const blob = await response.blob()
        return await blobToDataUri(blob)
      } catch (e) {
        // Blob URL was likely revoked, return as-is for downstream error handling
        return from
      }
    }
    // Other URLs on web don't need conversion
    return from
  }

  // Native: copy to cache directory to survive OS temp file cleanup
  const cacheDir = getImageCacheDirectory()
  if (!cacheDir || from.startsWith(cacheDir)) {
    return from
  }

  const to = joinPath(cacheDir, nanoid(36))
  await makeDirectoryAsync(cacheDir, {intermediates: true})

  let normalizedFrom = from
  if (!from.startsWith('file://') && from.startsWith('/')) {
    normalizedFrom = `file://${from}`
  }

  await copyAsync({from: normalizedFrom, to})
  return to
}

/**
 * Convert a Blob to a data URI
 */
function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert blob to data URI'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Purge files that were created to accomodate image manipulation */
export async function purgeTemporaryImageFiles() {
  const cacheDir = IS_NATIVE && getImageCacheDirectory()

  if (cacheDir) {
    await deleteAsync(cacheDir, {idempotent: true})
    await makeDirectoryAsync(cacheDir)
  }
}

function joinPath(a: string, b: string) {
  if (a.endsWith('/')) {
    if (b.startsWith('/')) {
      return a.slice(0, -1) + b
    }
    return a + b
  } else if (b.startsWith('/')) {
    return a + b
  }
  return a + '/' + b
}

function containImageRes(
  w: number,
  h: number,
  max: number,
): [width: number, height: number] {
  let scale = 1

  if (w > max || h > max) {
    scale = w > h ? max / w : max / h
    w = Math.floor(w * scale)
    h = Math.floor(h * scale)
  }

  return [w, h]
}
