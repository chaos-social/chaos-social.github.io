import {loadTestImage} from '#/lib/infrastructure/load-test-image'

const INFRASTRUCTURE_URL_TEST_TIMEOUT_MS = 15_000

/** Bluesky AppView DID – should resolve on any working PLC directory. */
const PLC_TEST_DID = 'did:plc:z72i7hdynmk6r22z27h6tvur'

/**
 * Known Bluesky avatar on the default CDN. Alternate image CDNs should serve
 * the same `/img/` path.
 */
const IMAGE_CDN_TEST_PATH =
  '/img/avatar/plain/did:plc:z72i7hdynmk6r22z27h6tvur/bafkreihwihm6kpd6zuwhhlro75p5qks5qtrcu55jp3gddbfjsieiv7wuka'

const headers = new Headers({
  Accept: 'application/json',
  'User-Agent': 'Witchsky (witchsky.app)',
})

async function withFetchTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    INFRASTRUCTURE_URL_TEST_TIMEOUT_MS,
  )
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

function normalizeOrigin(url: string) {
  return new URL(url).origin
}

export async function testConstellationUrl(url: string): Promise<boolean> {
  try {
    return await withFetchTimeout(async signal => {
      const testUrl = new URL('/links/all', normalizeOrigin(url))
      testUrl.searchParams.set('target', PLC_TEST_DID)
      const res = await fetch(testUrl, {method: 'GET', headers, signal})
      if (!res.ok) {
        return false
      }
      const json = await res.json()
      return typeof json === 'object' && json !== null && 'links' in json
    })
  } catch {
    return false
  }
}

export async function testSlingshotUrl(url: string): Promise<boolean> {
  try {
    return await withFetchTimeout(async signal => {
      const testUrl = new URL(
        '/xrpc/com.atproto.repo.getRecord',
        normalizeOrigin(url),
      )
      testUrl.searchParams.set('repo', PLC_TEST_DID)
      testUrl.searchParams.set('collection', 'app.bsky.actor.profile')
      testUrl.searchParams.set('rkey', 'self')
      const res = await fetch(testUrl, {method: 'GET', headers, signal})
      if (!res.ok) return false
      const json: unknown = await res.json()
      return (
        typeof json === 'object' &&
        json !== null &&
        'uri' in json &&
        typeof json.uri === 'string' &&
        'value' in json &&
        typeof json.value === 'object'
      )
    })
  } catch {
    return false
  }
}

export async function testLibreTranslateUrl(url: string): Promise<boolean> {
  try {
    return await withFetchTimeout(async signal => {
      const languagesUrl = new URL('/languages', normalizeOrigin(url))
      const res = await fetch(languagesUrl, {method: 'GET', signal})
      if (!res.ok) {
        return false
      }
      const json = await res.json()
      return Array.isArray(json)
    })
  } catch {
    return false
  }
}

export async function testImageCdnUrl(url: string): Promise<boolean> {
  try {
    await withFetchTimeout(async signal => {
      const testUrl = new URL(IMAGE_CDN_TEST_PATH, normalizeOrigin(url))
      await loadTestImage(testUrl.toString(), signal)
    })
    return true
  } catch {
    return false
  }
}

export async function testPlcDirectoryUrl(url: string): Promise<boolean> {
  try {
    return await withFetchTimeout(async signal => {
      const res = await fetch(`${normalizeOrigin(url)}/${PLC_TEST_DID}`, {
        method: 'GET',
        headers,
        signal,
      })
      if (!res.ok) {
        return false
      }
      const json: unknown = await res.json()
      return (
        typeof json === 'object' &&
        json !== null &&
        'id' in json &&
        json.id === PLC_TEST_DID
      )
    })
  } catch {
    return false
  }
}

export async function testTagSearchUrl(url: string): Promise<boolean> {
  try {
    return await withFetchTimeout(async signal => {
      // an empty query is a 400 NoTags error, which still proves it's a tag search server
      const res = await fetch(new URL('/search?tags=', normalizeOrigin(url)), {
        method: 'GET',
        headers,
        signal,
      })
      const json: unknown = await res.json()
      return (
        typeof json === 'object' &&
        json !== null &&
        (('posts' in json && Array.isArray(json.posts)) ||
          ('error' in json && typeof json.error === 'string'))
      )
    })
  } catch {
    return false
  }
}
