import {SaveFormat} from 'expo-image-manipulator'

import {moveIfNecessary} from '#/lib/media/image/cache'
import {renderImage} from '#/lib/media/image-manipulator'
import {type PickerImage} from '#/lib/media/picker.shared'
import {getDataUriSize} from '#/lib/media/util'
import {type ComposerImage} from '#/state/gallery'

export async function compressImage(
  img: ComposerImage,
  {maxDimension, maxSize}: {maxDimension: number; maxSize: number},
): Promise<PickerImage> {
  const source = img.transformed || img.source
  let currentDimension = Math.min(
    maxDimension,
    Math.max(source.width, source.height),
  )

  // PNG is lossless: changing JPEG quality does not reduce its size. Keep
  // upstream's resize/render flow, reducing dimensions until the PNG fits.
  while (currentDimension >= 1) {
    const [w, h] = containImageRes(
      source.width,
      source.height,
      currentDimension,
    ).map(dimension => Math.max(1, dimension))

    const res = await renderImage(
      source.path,
      context => context.resize({width: w, height: h}),
      {
        compress: 1,
        format: SaveFormat.PNG,
        base64: true,
      },
    )

    const base64 = res.base64
    const size = base64 ? getDataUriSize(base64) : 0
    if (base64 && size <= maxSize) {
      return {
        path: await moveIfNecessary(res.uri),
        width: res.width,
        height: res.height,
        mime: 'image/png',
        size,
      }
    }

    if (!base64 || (w === 1 && h === 1)) break
    currentDimension = Math.max(1, Math.floor(Math.max(w, h) * 0.8))
  }

  throw new Error(`Unable to compress image`)
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
