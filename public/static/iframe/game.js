/*
 * Game player. Loaded in an iframe by the app and opened directly from the
 * post's link card, so it must work with nothing but query parameters.
 *
 * Query params:
 *   game  - player page URL, https://witchsky.app/game/<did>/<cid>
 *   kind  - flash | jar | vnds
 *   w, h  - optional player dimensions
 *   alt   - optional description
 */
;(function () {
  var KINDS = ['flash', 'jar', 'vnds']
  var root = document.getElementById('root')
  var params = new URLSearchParams(window.location.search)

  function fail(message) {
    var el = document.createElement('p')
    el.className = 'status status--error'
    el.textContent = message
    root.replaceChildren(el)
    post('game-error', message)
  }

  function post(type, message) {
    if (window.parent === window) return
    window.parent.postMessage({type: type, message: message}, window.location.origin)
  }

  function setStatus(text) {
    var el = document.createElement('p')
    el.className = 'status'
    el.textContent = text
    root.replaceChildren(el)
  }

  /**
   * The blob URL as served by the owner's PDS. `game` is the published player
   * page URL, whose path is /game/<did>/<cid>.
   */
  function getGamePath(gameUrl) {
    var match = /\/game\/([^/]+)\/([^/?#]+)/.exec(new URL(gameUrl).pathname)
    if (!match) return undefined
    return {did: decodeURIComponent(match[1]), cid: decodeURIComponent(match[2])}
  }

  /**
   * Resolve the owner's PDS the same way the app does: fetch the DID document,
   * then take the `#atproto_pds` service. `did:plc` documents live at
   * plc.directory; `did:web` documents at the DID's own host.
   */
  function resolvePdsUrl(did) {
    var docUrl
    if (did.indexOf('did:plc:') === 0) {
      docUrl = 'https://plc.directory/' + did
    } else if (did.indexOf('did:web:') === 0) {
      var host = did.slice('did:web:'.length).split(':')[0]
      docUrl = 'https://' + decodeURIComponent(host) + '/.well-known/did.json'
    } else {
      return Promise.reject(new Error('Unsupported account identifier'))
    }

    return fetch(docUrl, {
      headers: {accept: 'application/did+ld+json, application/json'},
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Could not resolve the game’s account')
        return r.json()
      })
      .then(function (doc) {
        var services = doc && doc.service
        if (!Array.isArray(services)) return undefined
        for (var i = 0; i < services.length; i++) {
          var service = services[i]
          if (service.id === '#atproto_pds' && service.serviceEndpoint) {
            return service.serviceEndpoint
          }
        }
        return undefined
      })
  }

  function getBlobUrl(gameUrl) {
    /*
     * The composer previews an unsaved file, which has no repo location yet,
     * so it passes the object URL straight through.
     */
    if (/^(blob|data):/.test(gameUrl)) return Promise.resolve(gameUrl)

    var path = getGamePath(gameUrl)
    if (!path) throw new Error('Invalid game URL')
    return resolvePdsUrl(path.did).then(function (pds) {
      if (!pds) throw new Error('Could not find the game’s hosting server')
      var url = new URL('/xrpc/com.atproto.sync.getBlob', pds)
      url.searchParams.set('did', path.did)
      url.searchParams.set('cid', path.cid)
      return url.toString()
    })
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var tag = document.createElement('script')
      tag.src = src
      tag.async = true
      tag.onload = function () {
        resolve()
      }
      tag.onerror = function () {
        reject(new Error('Could not load the player runtime'))
      }
      document.head.appendChild(tag)
    })
  }

  function playFlash(blobUrl) {
    if (typeof window.RufflePlayer === 'undefined') {
      setStatus('Loading Flash player…')
      return loadScript('https://unpkg.com/@ruffle-rs/ruffle').then(function () {
        return playFlash(blobUrl)
      })
    }
    var player = window.RufflePlayer.newest().createPlayer()
    player.style.width = '100%'
    player.style.height = '100%'
    root.replaceChildren(player)
    // Script access and networking let a SWF reach the surrounding page and the
    // network; both stay off since the file is untrusted.
    return player.ruffle().load({
      url: blobUrl,
      autoplay: 'on',
      allowScriptAccess: false,
      allowNetworking: 'none',
    })
  }

  function playJar(blobUrl) {
    if (typeof window.cheerpjInit === 'undefined') {
      setStatus('Loading Java runtime…')
      return loadScript('https://cjrtnc.leaningtech.com/4.0/loader.js').then(function () {
        return playJar(blobUrl)
      })
    }
    var display = document.createElement('div')
    display.style.width = '100%'
    display.style.height = '100%'
    root.replaceChildren(display)
    return window
      .cheerpjInit({status: 'none', disableScaling: true})
      .then(function () {
        window.cheerpjCreateDisplay(-1, -1, display)
        return window.cheerpjRunJar(blobUrl)
      })
  }

  function playVnds(blobUrl) {
    return import('./game-vnds.js').then(function (mod) {
      return mod.play({
        blobUrl,
        onStatus: setStatus,
        width: Number(params.get('w')) || undefined,
        height: Number(params.get('h')) || undefined,
      })
    })
  }

  function main() {
    var kind = params.get('kind')
    var gameUrl = params.get('game')
    if (KINDS.indexOf(kind) === -1) return fail('Unknown game type')
    if (!gameUrl) return fail('Missing game reference')

    getBlobUrl(gameUrl)
      .then(function (blobUrl) {
        if (kind === 'flash') return playFlash(blobUrl)
        if (kind === 'jar') return playJar(blobUrl)
        return playVnds(blobUrl)
      })
      .then(function () {
        post('game-ready')
      })
      .catch(function (error) {
        fail(error && error.message ? error.message : 'This game could not be played.')
      })
  }

  main()
})()
