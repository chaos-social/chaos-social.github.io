import {type ReactNode} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {shareImageModal} from '#/lib/media/manip'
import {useSaveImageToMediaLibrary} from '#/lib/media/save-image'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useFullsizeFormat} from '#/state/preferences/fullsize-format'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import * as PeekMenu from '#/components/PeekMenu'
import {IS_IOS} from '#/env'

/**
 * Wraps an image embed with the iOS peek-and-menu interaction. On non-iOS
 * platforms this renders children unchanged.
 *
 * The aspect ratio is consumed by the native side to size the preview
 * viewController correctly — which is what makes the lift animation clean
 * for portrait/panorama images.
 */
export function ImageContextMenu({
  fullsizeUri,
  downloadName,
  thumbUri,
  aspectRatio,
  borderRadius,
  onPreviewPress,
  style,
  children,
}: {
  downloadName?: string
  fullsizeUri: string
  /** Thumbnail URL. Used as an instant placeholder in the native preview
   *  while the fullsize loads, so there's no black flash on first peek. */
  thumbUri?: string
  /** width / height; defaults to 1 if missing. */
  aspectRatio: number | undefined
  borderRadius?: number
  onPreviewPress?: () => void
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const shapePreference = useEnableSquareButtons()

  const {t: l} = useLingui()
  const saveImage = useSaveImageToMediaLibrary()
  const imageCdnHost = useImageCdnHost()
  const thumbnailFormat = useThumbnailFormat()
  const fullsizeFormat = useFullsizeFormat()

  if (!IS_IOS) {
    return children
  }

  const handleSave = () => {
    void saveImage(fullsizeUri, undefined, downloadName)
  }
  const handleShare = () => {
    void shareImageModal({uri: fullsizeUri})
  }

  return (
    <PeekMenu.Root style={style}>
      <PeekMenu.Trigger
        preview={{
          type: 'image',
          uri: applyImageTransforms(fullsizeUri, {
            imageCdnHost,
            format: fullsizeFormat ?? 'default',
          }),
          thumbUri: thumbUri
            ? applyImageTransforms(thumbUri, {
                imageCdnHost,
                format: thumbnailFormat,
              })
            : undefined,
          aspectRatio: aspectRatio && aspectRatio > 0 ? aspectRatio : 1,
        }}
        borderRadius={shapePreference === 'sharp' ? 0 : borderRadius}
        onPreviewPress={onPreviewPress}>
        {children}
      </PeekMenu.Trigger>
      <PeekMenu.Menu>
        <PeekMenu.MenuItem id="save" onSelect={handleSave}>
          <PeekMenu.MenuItemIcon icon={DownloadIcon} />
          <PeekMenu.MenuItemText>{l`Save image`}</PeekMenu.MenuItemText>
        </PeekMenu.MenuItem>
        <PeekMenu.MenuItem id="share" onSelect={handleShare}>
          <PeekMenu.MenuItemIcon icon={ShareIcon} />
          <PeekMenu.MenuItemText>{l`Share`}</PeekMenu.MenuItemText>
        </PeekMenu.MenuItem>
      </PeekMenu.Menu>
    </PeekMenu.Root>
  )
}
