import {device, useStorage} from '#/storage'

/** Read at press time because native submenu callbacks can retain old props. */
export function getCopyShareLinks() {
  return device.get(['copyShareLinks']) ?? false
}

/** Device-wide copy mode shared by link menus and post-share long presses. */
export function useCopyShareLinks() {
  const [copyShareLinks = false, setCopyShareLinks] = useStorage(device, [
    'copyShareLinks',
  ])
  return [copyShareLinks, setCopyShareLinks] as const
}
