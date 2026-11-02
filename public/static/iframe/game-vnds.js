/*
 * VNDS visual novel player.
 *
 * The engine (vnds-online, CC BY 3.0) loads every asset through jQuery and CSS,
 * which fetch by URL and cannot be intercepted. So the archive is unpacked here
 * and served from a service worker at real same-origin paths, then the iframe
 * is handed over to the engine's own shell.
 */

/** `info.txt` is a flat `key=value` file. */
function parseInfo(text) {
  const info = {}
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-z_]+)\s*=\s*(.*)$/i.exec(line.trim())
    if (match) info[match[1].toLowerCase()] = match[2]
  }
  return info
}

/**
 * The game menu entry the engine expects. Upstream generates this server-side
 * from `info.txt` and `img.ini`; most archives ship neither `img.ini` nor a
 * usable resolution, and the engine divides sprite sizes by it.
 */
function buildGameList(files, dir, shortName, width = 256, height = 192) {
  const info = parseInfo(
    files.has('info.txt')
      ? new TextDecoder().decode(files.get('info.txt'))
      : '',
  )
  const bgColor = info.bg_color
    ? `#${info.bg_color.replace(/^#/, '')}`
    : undefined
  return [
    {
      dir,
      full_name: info.title || 'Visual novel',
      /* Autostart matches the hash against this, so it must be the last segment. */
      short_name: shortName,
      width,
      height,
      icon_s: null,
      icon_b: null,
      thumb_s: null,
      thumb_b: null,
      font: files.has('default.ttf') ? `${dir}/default.ttf` : null,
      /*
       * The engine's default (1em) overflows the fixed 120px message box on
       * real scripts, which run to 250 characters a line. 0.6 is the largest
       * size at which none of a whole game's longest lines clip; archives that
       * ship their own text_size keep it.
       */
      text_size: info.text_size || '0.6',
      line_height: info.line_height || null,
      bg_color: bgColor || null,
      error: null,
    },
  ]
}

function toTransferable(files) {
  const out = {}
  for (const [path, bytes] of files) out[path] = bytes
  return out
}

/**
 * Removes workers registered by earlier versions of this player.
 *
 * They ran at `vnds/`, which a more specific scope than this page's, so they
 * kept intercepting the engine's own files with stale logic and broke playback
 * for anyone who had already opened a game.
 */
async function unregisterLegacyWorkers() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations
        .filter(reg => /\/vnds\/sw\.js$/.test(reg.active?.scriptURL ?? ''))
        .map(reg => reg.unregister()),
    )
  } catch {
    // Best effort: a failure here shouldn't stop the player from loading.
  }
}

async function installWorker(files, gameList) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser cannot run visual novels')
  }
  await unregisterLegacyWorkers()
  /*
   * The worker is scoped to this page's directory so it controls the page and
   * its engine scripts. A narrower scope would register fine but never control
   * us, leaving `ready` pending forever and the player stuck on "Preparing".
   */
  const registration = await navigator.serviceWorker.register('./vnds-sw.js', {
    scope: './',
  })

  /*
   * `ready` resolves on the first activation, but the current page only becomes
   * controlled after a reload or an explicit claim. Wait for the worker itself,
   * then for it to take over this page.
   */
  const worker = await waitForActiveWorker(registration)
  await navigator.serviceWorker.ready
  if (!navigator.serviceWorker.controller && worker.state === 'activated') {
    // Claiming is asynchronous; the worker calls clients.claim() on activate.
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 3000)
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          clearTimeout(timeout)
          resolve()
        },
        {once: true},
      )
    })
  }
  worker.postMessage({type: 'files', files: toTransferable(files), gameList})
}

/** @param {ServiceWorkerRegistration} registration */
function waitForActiveWorker(registration) {
  const existing = registration.active
  if (existing) return Promise.resolve(existing)
  if (registration.waiting) return Promise.resolve(registration.waiting)

  const installing = registration.installing
  if (!installing) return Promise.reject(new Error('Could not start the player'))

  return new Promise((resolve, reject) => {
    installing.addEventListener('statechange', () => {
      if (installing.state === 'activated') resolve(installing)
      else if (installing.state === 'redundant') {
        reject(new Error('Could not start the player'))
      }
    })
  })
}

/**
 * Play a VNDS archive.
 *
 * @param blobUrl  PDS blob URL for the .tar.gz or .zip
 * @param onStatus progress callback
 * @param width    recorded player width, for the engine's own layout math
 * @param height   recorded player height
 */
export async function play({blobUrl, onStatus, width, height}) {
  const {readArchive} = await import('./game-vnds-archive.js')

  onStatus('Downloading game…')
  const response = await fetch(blobUrl)
  if (!response.ok) throw new Error('Could not download the game')
  const files = await readArchive(new Uint8Array(await response.arrayBuffer()))
  /* Archives carry no directory entries, so look for a script file, not a dir. */
  const hasScripts = Array.from(files.keys()).some(path =>
    path.startsWith('script/'),
  )
  if (!hasScripts) {
    throw new Error('That archive does not contain a VNDS game')
  }

  onStatus('Preparing game…')

  /*
   * `game.dir` must be the worker's prefix, without a trailing slash: every
   * asset path is `dir + '/background/...'`, so a trailing one yields `//`.
   */
  const dir = new URL('./vnds/game/', window.location.href).pathname.replace(
    /\/$/,
    '',
  )
  /* The engine's autostart matches the hash against this, and it also namespaces saves. */
  const shortName = dir.split('/').filter(Boolean).pop()
  await installWorker(
    files,
    JSON.stringify(buildGameList(files, dir, shortName, width, height)),
  )

  /*
   * The engine is only correct at the game's own resolution: its CSS, its
   * 120px message box and its font scale math all assume it. So run it at
   * native size and let the embed scale the whole iframe up to fit.
   */
  const native = readNativeSize(files, width, height)
  const shell = new URL('./vnds/shell.html', window.location.href)
  shell.searchParams.set('w', String(native.width))
  shell.searchParams.set('h', String(native.height))
  shell.hash = shortName
  window.location.replace(shell.toString())
}

/**
 * The resolution the engine draws at. It prefers `img.ini`, which most archives
 * omit, so fall back to the recorded dimensions and then to the DS's 256x192.
 */
function readNativeSize(files, width, height) {
  const ini = files.get('img.ini')
  if (ini) {
    const match = /width=(\d+)\s*height=(\d+)/.exec(new TextDecoder().decode(ini))
    if (match) return {width: Number(match[1]), height: Number(match[2])}
  }
  return {width: width || 256, height: height || 192}
}
