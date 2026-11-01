/*
 * Serves an unpacked VNDS game from memory.
 *
 * The engine loads every asset through jQuery and CSS, which fetch by URL and
 * cannot be intercepted, so the bytes have to be reachable at their real paths.
 * The page hands the file map over with postMessage after registering.
 *
 * Scope is this directory, so only `/iframe/vnds/game/...` is intercepted;
 * the engine's own scripts in `/iframe/vnds/` pass through untouched.
 */

/*
 * The worker is scoped to the page's own directory, so the engine's files live
 * under `vnds/` relative to this worker.
 */
const DIR = new URL('./vnds/', self.location.href).pathname
/* Unpacked game assets; `game.dir` in the game list points here. */
const PREFIX = new URL('./vnds/game/', self.location.href).pathname
/* The engine fetches this relative to its own page, not to `dir`. */
const GAME_LIST = new URL('./vnds/games_list.json', self.location.href).pathname

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('message', event => {
  const data = event.data
  if (!data || data.type !== 'files') return
  self.__files = data.files
  self.__gameList = data.gameList
})

const AUDIO = /\.(mp3|ogg|oga|wav|aac|m4a|flac)$/i
const IMAGE = /\.(png|jpe?g|gif|bmp|webp|avif)$/i

/* 1x1 transparent PNG, and a 0.1s silent WAV, for assets the archive omits. */
const BLANK_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  ),
  c => c.charCodeAt(0),
)
const SILENT_WAV = (() => {
  const rate = 8000
  const samples = rate / 10
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  write(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  write(36, 'data')
  view.setUint32(40, samples, true)
  return new Uint8Array(buffer) // samples stay zero: silence
})()

function contentType(path) {
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.gif$/i.test(path)) return 'image/gif'
  if (/\.mp3$/i.test(path)) return 'audio/mpeg'
  if (/\.ogg$/i.test(path)) return 'audio/ogg'
  if (/\.(ttf|otf)$/i.test(path)) return 'font/ttf'
  if (/\.(scr|txt|dat)$/i.test(path)) return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

function respond(body, type) {
  return new Response(body, {
    headers: {'Content-Type': type, 'Cache-Control': 'no-store'},
  })
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (!self.__files) return

  /*
   * Only the iframe's own document is ours to serve from memory. Its scripts
   * and everything outside the engine directory must reach the real server,
   * or the player can't boot.
   */
  if (!url.pathname.startsWith(DIR)) return
  const rest = url.pathname.slice(DIR.length)

  /*
   * The engine builds its game menu from a list upstream generates server-side.
   * It asks for it relative to its own page, which is one level below the
   * worker's root, so accept both forms.
   */
  if (url.pathname === GAME_LIST || rest === 'games/games_list.json') {
    event.respondWith(respond(self.__gameList, 'application/json'))
    return
  }

  /*
   * The engine probes these to choose a game-list source. Answering "not
   * enabled" makes it use the JSON list above instead of the PHP/Lua ones.
   */
  if (rest === 'php/check_php.php' || rest === 'lua/check_lua.lua') {
    event.respondWith(respond('0', 'text/plain'))
    return
  }

  /* Log sinks. Nothing here is a server, so accept and discard. */
  if (rest.startsWith('php/') && rest.endsWith('.php')) {
    event.respondWith(respond('', 'text/plain'))
    return
  }

  /* The engine ships no icon assets; a blank one avoids a console 404. */
  if (rest.startsWith('images/')) {
    event.respondWith(respond(BLANK_PNG, 'image/png'))
    return
  }

  if (!url.pathname.startsWith(PREFIX)) return
  const key = url.pathname.slice(PREFIX.length)

  const data = self.__files[key]
  if (data) {
    event.respondWith(respond(data, contentType(key)))
    return
  }

  /*
   * Stubs, not 404s. A soundless game issues thousands of audio requests, and
   * every miss raises a modal the player would have to dismiss.
   */
  if (AUDIO.test(key)) {
    event.respondWith(respond(SILENT_WAV, 'audio/wav'))
  } else if (IMAGE.test(key)) {
    event.respondWith(respond(BLANK_PNG, 'image/png'))
  }
})
