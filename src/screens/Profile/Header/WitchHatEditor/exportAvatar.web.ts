import {type RefObject} from 'react'
import {type View} from 'react-native'
import {type Client} from '@atproto/lex'
import {isValidDid} from '@atproto/syntax'

import {type ImageMeta} from '#/state/gallery'
import {HAT_PATH, LOGO_VIEW_BOX} from '#/view/icons/Logo'
import {
  AVATAR_SIZE,
  type HatPlacement,
} from '#/screens/Profile/Header/WitchHatEditor/utils'
import getBlob from '#/lexicons/com/atproto/sync/getBlob'

export async function exportAvatar({
  avatar,
  placement,
  color,
  pdsClient,
}: {
  previewRef: RefObject<React.ElementRef<typeof View> | null>
  avatar: string
  placement: HatPlacement
  color: string
  pdsClient: Client
}): Promise<ImageMeta> {
  const url = URL.createObjectURL(await downloadAvatar(avatar, pdsClient))
  try {
    const image = await loadImage(url)
    const hat = await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEW_BOX}"><path fill="${color}" d="${HAT_PATH}"/></svg>`,
      )}`,
    )
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create avatar canvas')
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight)

    /* PNG is lossless; reduce dimensions if necessary to fit the avatar limit. */
    for (
      let size = AVATAR_SIZE;
      size >= 1;
      size = Math.max(1, Math.floor(size * 0.8))
    ) {
      canvas.width = canvas.height = size
      context.drawImage(
        image,
        (image.naturalWidth - cropSize) / 2,
        (image.naturalHeight - cropSize) / 2,
        cropSize,
        cropSize,
        0,
        0,
        size,
        size,
      )
      const hatSize = placement.size * size
      context.save()
      context.translate(placement.x * size, placement.y * size)
      context.rotate((placement.rotation * Math.PI) / 180)
      context.drawImage(hat, -hatSize / 2, -hatSize / 2, hatSize, hatSize)
      context.restore()
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => {
          if (result) resolve(result)
          else reject(new Error('Could not export avatar'))
        }, 'image/png')
      })
      if (blob.size <= 1_000_000) {
        return {
          path: canvas.toDataURL('image/png'),
          width: size,
          height: size,
          mime: 'image/png',
        }
      }
      if (size === 1) break
    }
    throw new Error('Could not fit avatar within the upload limit')
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function downloadAvatar(
  avatar: string,
  pdsClient: Client,
): Promise<Blob> {
  const url = new URL(avatar)
  const match = url.pathname.match(
    /^\/img\/[^/]+\/plain\/(did:[^/]+)\/([^/@]+)(?:@[^/]+)?$/,
  )
  if (match) {
    const did = decodeURIComponent(match[1])
    if (!isValidDid(did)) throw new Error('Invalid avatar DID')
    /* The CDN is not CORS-enabled. The account client targets its own PDS. */
    const bytes = await pdsClient.call(getBlob, {
      did,
      cid: match[2],
    })
    return new Blob([bytes])
  }
  const response = await fetch(avatar)
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`)
  return response.blob()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img')
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load avatar image'))
    image.src = src
  })
}
