import {
  type ImagePickerOptions,
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
  VideoExportPreset,
} from 'expo-image-picker'
import {t} from '@lingui/core/macro'

import {type ImageMeta} from '#/state/gallery'
import * as Toast from '#/components/Toast'
import {IS_IOS} from '#/env'
import {VIDEO_MAX_DURATION_MS} from '../constants'
import {getDataUriSize} from './util'

export type PickerImage = ImageMeta & {
  size: number
}

export async function openPicker(opts?: ImagePickerOptions) {
  const response = await launchImageLibraryAsync({
    exif: false,
    mediaTypes: ['images'],
    quality: 1,
    selectionLimit: 1,
    ...opts,
    shouldDownloadFromNetwork: true,
    legacy: true,
    preferredAssetRepresentationMode:
      UIImagePickerPreferredAssetRepresentationMode.Automatic,
  })

  return (response.assets ?? [])
    .filter(asset => {
      if (asset.mimeType?.startsWith('image/')) return true
      Toast.show(t`Only image files are supported`, {
        type: 'warning',
      })
      return false
    })
    .map(image => ({
      mime: image.mimeType || 'image/jpeg',
      height: image.height,
      width: image.width,
      path: image.uri,
      size: getDataUriSize(image.uri),
    }))
}

/**
 * Pick several images at once. The file name comes back too, because a bulk
 * emoji upload derives each alias from the file it was picked as.
 */
export async function openMultiplePicker({
  selectionLimit = 0,
}: {selectionLimit?: number} = {}) {
  const response = await launchImageLibraryAsync({
    exif: false,
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit,
    legacy: true,
    shouldDownloadFromNetwork: true,
    preferredAssetRepresentationMode:
      UIImagePickerPreferredAssetRepresentationMode.Automatic,
  })

  return (response.assets ?? []).flatMap(image => {
    if (!image.mimeType?.startsWith('image/')) return []
    return [
      {
        mime: image.mimeType,
        height: image.height,
        width: image.width,
        path: image.uri,
        size: image.fileSize ?? getDataUriSize(image.uri),
        fileName: image.fileName ?? undefined,
      } satisfies PickerImage & {fileName?: string},
    ]
  })
}

export async function openUnifiedPicker({
  selectionCountRemaining,
  videoMaxDurationMs = VIDEO_MAX_DURATION_MS,
}: {
  selectionCountRemaining: number
  videoMaxDurationMs?: number
}) {
  return await launchImageLibraryAsync({
    exif: false,
    mediaTypes: ['images', 'videos'],
    quality: 1,
    allowsMultipleSelection: true,
    legacy: true,
    // Reading videos as base64 can fail in the browser before callers have a
    // chance to validate the file size. Web callers can read image files from
    // the `file` returned on each asset after validation instead.
    base64: false,
    selectionLimit: IS_IOS ? selectionCountRemaining : undefined,
    shouldDownloadFromNetwork: true,
    preferredAssetRepresentationMode:
      UIImagePickerPreferredAssetRepresentationMode.Automatic,
    videoExportPreset: VideoExportPreset.Passthrough,
    videoMaxDuration: videoMaxDurationMs / 1000,
  })
}
