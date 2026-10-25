import {deleteAsync} from 'expo-file-system/legacy'
import {type ImageResult, SaveFormat} from 'expo-image-manipulator'
import {byteLength} from 'base64-js'

import {moveIfNecessary} from '#/lib/media/image/cache'
import {renderedPngHasTransparency} from '#/lib/media/image/transparency'
import {renderImage} from '#/lib/media/image-manipulator'
import {type PickerImage} from '#/lib/media/picker.shared'
import {type ComposerImage, type ImageMeta} from '#/state/gallery'
import {IS_NATIVE} from '#/env'

export async function compressImage(
  img: ComposerImage,
  opts: {maxDimension: number; maxSize: number},
): Promise<PickerImage> {
  return compressImageSource(img.transformed || img.source, opts)
}

/** Share the same format selection and byte limits across image upload paths. */
export async function compressImageSource(
  source: ImageMeta,
  {maxDimension, maxSize}: {maxDimension: number; maxSize: number},
): Promise<PickerImage> {
  let currentDimension = Math.min(
    maxDimension,
    Math.max(source.width, source.height),
  )
  const intermediateUris: string[] = []
  let selectedUri: string | undefined

  async function render(format: SaveFormat, compress: number) {
    const [width, height] = containImageRes(
      source.width,
      source.height,
      currentDimension,
    )
    const result = await renderImage(
      source.path,
      context => context.resize({width, height}),
      {compress, format, base64: true},
    )
    intermediateUris.push(result.uri)
    if (!result.base64) throw new Error('Unable to compress image')
    return result
  }

  function fits(result: ImageResult) {
    return byteLength(result.base64!) <= maxSize
  }

  try {
    let result = await render(SaveFormat.PNG, 1)
    const keepPng =
      (source.mime.toLowerCase().split(';')[0] === 'image/png' &&
        fits(result)) ||
      renderedPngHasTransparency(result.base64!)

    if (keepPng) {
      // PNG quality is fixed; only reduce dimensions when it exceeds the limit.
      while (!fits(result)) {
        if (currentDimension <= 1) throw new Error('Unable to compress image')
        currentDimension = Math.max(1, Math.floor(currentDimension * 0.8))
        result = await render(SaveFormat.PNG, 1)
      }
    } else {
      let best: ImageResult | undefined
      for (let attempt = 0; attempt < 4 && !best; attempt++) {
        let minQuality = 0
        let maxQuality = 101 // exclusive
        while (maxQuality - minQuality > 1) {
          const quality = Math.round((maxQuality + minQuality) / 2)
          // Match upstream: shrink dimensions instead of dropping below 26%.
          if (quality <= 13) break
          const candidate = await render(SaveFormat.JPEG, quality / 100)
          if (fits(candidate)) {
            minQuality = quality
            best = candidate
          } else {
            maxQuality = quality
          }
        }
        currentDimension = Math.max(1, Math.floor(currentDimension * 0.8))
      }
      if (!best) throw new Error('Unable to compress image')
      result = best
    }

    const path = await moveIfNecessary(result.uri)
    selectedUri = result.uri
    return {
      path,
      width: result.width,
      height: result.height,
      mime: keepPng ? 'image/png' : 'image/jpeg',
      size: byteLength(result.base64!),
    }
  } finally {
    await Promise.all(
      intermediateUris
        .filter(uri => uri !== selectedUri)
        .map(async uri => {
          try {
            if (IS_NATIVE) {
              await deleteAsync(uri, {idempotent: true})
            } else if (uri.startsWith('blob:')) {
              URL.revokeObjectURL(uri)
            }
          } catch {
            // Cache cleanup must not hide a compression or upload error.
          }
        }),
    )
  }
}

function containImageRes(
  w: number,
  h: number,
  max: number,
): [width: number, height: number] {
  const scale = Math.min(1, max / Math.max(w, h))
  return [
    Math.max(1, Math.floor(w * scale)),
    Math.max(1, Math.floor(h * scale)),
  ]
}
