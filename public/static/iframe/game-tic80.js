/*
 * TIC-80 player.
 *
 * Upstream's web player is a whole page: it owns its canvas, keyboard and
 * layout. It runs in a nested iframe, which also keeps its WASM heap out of
 * this page.
 */

const PLAYER_URL = './tic80/index.html'

/**
 * Loads the emulator with `cartUrl` as its cartridge.
 *
 * The emulator picks its parser from the file name and refuses anything that
 * does not end in `.tic` or `.png`, so the cart is always handed to it as
 * `./cart.tic`, a request the player page answers with the real bytes. A plain
 * blob or PDS URL would have no extension and load as a black screen.
 *
 * @param cartUrl  cart blob URL, same origin or CORS-enabled
 * @param host     element the player iframe fills
 */
export function play({cartUrl, host}) {
  const player = document.createElement('iframe')
  player.title = 'TIC-80'
  player.allow = 'autoplay; fullscreen; gamepad'
  /* Its own storage for the game's saves, and downloads for saved carts. */
  player.sandbox = 'allow-scripts allow-same-origin allow-downloads'
  player.style.cssText =
    'display:block;border:0;width:100%;height:100%;background:#1a1c2c'

  const src = new URL(PLAYER_URL, window.location.href)
  src.searchParams.set('cart', cartUrl)
  player.src = src.toString()

  host.replaceChildren(player)

  return waitForCanvas(player)
}

/**
 * The runtime has no ready event and no size until it has painted, so the first
 * sized canvas is what marks the game as up.
 */
function waitForCanvas(player) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('The TIC-80 player did not start')),
      30000,
    )
    player.addEventListener('load', () => {
      const check = setInterval(() => {
        const canvas = player.contentDocument?.querySelector('canvas')
        if (canvas && canvas.width > 0) {
          clearInterval(check)
          clearTimeout(timeout)
          resolve(canvas)
        }
      }, 250)
    })
  })
}
