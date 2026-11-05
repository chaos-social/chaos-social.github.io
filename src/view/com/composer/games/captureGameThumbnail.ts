import {captureArchiveThumbnail} from '#/view/com/composer/games/captureArchiveThumbnail'
import {type GameKind} from '#/components/Post/Embed/GameEmbed/utils'

/**
 * How long to let a runtime draw before its frame is taken. Carts and movies
 * vary; the first painted frames are what the post should show.
 */
const CAPTURE_DELAY_MS = 8000

/** External embeds cap thumbnails at 1 MB, so this is generous and safe. */
const THUMB_MAX_WIDTH = 640
const THUMB_QUALITY = 0.8

/**
 * Takes a still of a game for its link-card thumbnail.
 *
 * - VNDS archives ship their own cover art, so that is used directly.
 * - TIC-80 and Flash are emulated in an off-screen frame and the canvas copied.
 * - Java applets are not attempted: CheerpJ gives no handle on its display.
 *
 * The frame is mute: nothing the user did not ask to play should make sound.
 * Flash keeps painting before the first click, so it has to be silenced from
 * outside the runtime.
 *
 * @returns a PNG blob, or undefined when this kind can't be captured
 */
export async function captureGameThumbnail({
  kind,
  file,
  playerUrl,
}: {
  kind: GameKind
  file: Blob
  playerUrl: string
}): Promise<Blob | undefined> {
  if (kind === 'vnds') return captureArchiveThumbnail(file)
  if (kind !== 'tic80' && kind !== 'flash') return undefined

  const frame = document.createElement('iframe')
  /* Off-screen but rendered: a `display: none` frame gets no layout to draw. */
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:640px;height:360px;border:0'
  frame.src = playerUrl

  try {
    document.body.appendChild(frame)
    const canvas = await waitForCanvas(frame)
    await new Promise(resolve => setTimeout(resolve, CAPTURE_DELAY_MS))
    if (kind === 'flash') silenceFrame(frame)
    return await canvasToBlob(canvas)
  } catch {
    // A thumbnail is a nicety; posting must not fail without one.
    return undefined
  } finally {
    frame.remove()
  }
}

/**
 * Mutes a playing frame. Ruffle exposes its volume as a plain property, and
 * both runtimes live in the player page, so this reaches into the same-origin
 * frame rather than changing their APIs.
 */
function silenceFrame(frame: HTMLIFrameElement) {
  const player = frame.contentDocument?.querySelector<
    HTMLElement & {volume: number}
  >('ruffle-player')
  if (player) player.volume = 0
}

function waitForCanvas(frame: HTMLIFrameElement) {
  /* Neither runtime has a ready event; the first sized canvas is the signal. */
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('The player did not start')),
      30000,
    )
    frame.addEventListener('load', () => {
      const check = setInterval(() => {
        const canvas = findCanvas(frame)
        if (canvas && canvas.width > 0) {
          clearInterval(check)
          clearTimeout(timeout)
          resolve(canvas)
        }
      }, 250)
    })
  })
}

/** Ruffle draws into a canvas inside its own shadow root. */
function findCanvas(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument
  const ruffle = doc?.querySelector<HTMLElement>('ruffle-player')
  return (
    ruffle?.shadowRoot?.querySelector('canvas') ?? doc?.querySelector('canvas')
  )
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
