import {type GameKind} from '#/components/Post/Embed/GameEmbed/utils'

/**
 * How long to let a game draw before its frame is taken. Carts vary; the first
 * painted frame is what the post should show.
 */
const CAPTURE_DELAY_MS = 8000

/** External embeds cap thumbnails at 1 MB, so this is generous and safe. */
const THUMB_MAX_WIDTH = 640
const THUMB_QUALITY = 0.8

/**
 * Takes a still of a game for its link-card thumbnail.
 *
 * Only runtimes that expose a readable canvas can be captured, which today means
 * TIC-80: Ruffle and CheerpJ are cross-origin scripts and the VNDS engine has
 * not drawn anything until the player is interacted with.
 *
 * @returns a PNG blob, or undefined when this kind can't be captured
 */
export async function captureGameThumbnail({
  kind,
  playerUrl,
}: {
  kind: GameKind
  playerUrl: string
}): Promise<Blob | undefined> {
  if (kind !== 'tic80') return undefined

  const frame = document.createElement('iframe')
  /* Off-screen but rendered: a `display: none` frame gets no layout to draw. */
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:640px;height:360px;border:0'
  frame.src = playerUrl

  try {
    document.body.appendChild(frame)
    const canvas = await waitForCanvas(frame)
    await new Promise(resolve => setTimeout(resolve, CAPTURE_DELAY_MS))
    return await canvasToBlob(canvas)
  } catch {
    // A thumbnail is a nicety; posting must not fail without one.
    return undefined
  } finally {
    frame.remove()
  }
}

function waitForCanvas(frame: HTMLIFrameElement) {
  /* The same signal the player uses: the runtime has no ready event. */
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('The player did not start')),
      30000,
    )
    frame.addEventListener('load', () => {
      const check = setInterval(() => {
        const canvas = frame.contentDocument?.querySelector('canvas')
        if (canvas && canvas.width > 0) {
          clearInterval(check)
          clearTimeout(timeout)
          resolve(canvas)
        }
      }, 250)
    })
  })
}

/**
 * Copies the emulator's canvas into a fresh one and reads that: the game's
 * buffer may be cleared underneath us, and the copy is also where the size is
 * capped.
 */
function canvasToBlob(canvas: HTMLCanvasElement) {
  const scale = Math.min(1, THUMB_MAX_WIDTH / canvas.width)
  const copy = document.createElement('canvas')
  copy.width = Math.round(canvas.width * scale)
  copy.height = Math.round(canvas.height * scale)

  const context = copy.getContext('2d')
  if (!context) return Promise.resolve(undefined)
  context.drawImage(canvas, 0, 0, copy.width, copy.height)

  return new Promise<Blob | undefined>(resolve => {
    copy.toBlob(blob => resolve(blob ?? undefined), 'image/png', THUMB_QUALITY)
  })
}
