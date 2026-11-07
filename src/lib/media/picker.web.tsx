import {type ImagePickerOptions} from 'expo-image-picker'
import {type OpenCropperOptions} from '@bsky.app/expo-image-crop-tool'

import {type PickerImage} from './picker.shared'

export {
  openMultiplePicker,
  openPicker,
  openUnifiedPicker,
} from './picker.shared'

export function openCamera(
  _opts: ImagePickerOptions,
): PickerImage {
  throw new Error('openCamera is not supported on web')
}

export function openCropper(
  _opts: OpenCropperOptions,
): PickerImage {
  throw new Error(
    'openCropper is not supported on web. Use EditImageDialog instead.',
  )
}
