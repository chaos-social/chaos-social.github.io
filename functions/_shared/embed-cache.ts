const INTERNAL_EMBED_PREFIX = '/__embed'
const EMBED_CACHE_VERSION = 'v2'

const PROFILE_CACHE_SECONDS = 60 * 60
const POST_CACHE_SECONDS = 24 * 60 * 60
const STALE_CACHE_SECONDS = 7 * 24 * 60 * 60

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Transform Rules send crawlers to /__embed while keeping the shared URL in
 * the address bar. Strip that internal prefix from canonical metadata and the
 * cache key.
 */
export function getPublicUrl(requestUrl: string): string {
  const url = new URL(requestUrl)

  if (url.pathname.startsWith(`${INTERNAL_EMBED_PREFIX}/`)) {
    url.pathname = url.pathname.slice(INTERNAL_EMBED_PREFIX.length)
  }

  // Tracking parameters do not change a profile or post preview.
  url.search = ''
  url.hash = ''
  return url.toString()
}

function getCacheKey(publicUrl: string): Request {
  const cacheUrl = new URL(publicUrl)
  cacheUrl.searchParams.set('__witchsky_embed_cache', EMBED_CACHE_VERSION)
  return new Request(cacheUrl, {method: 'GET'})
}

function withCacheHeaders(response: Response, publicUrl: string): Response {
  const headers = new Headers(response.headers)

  if (headers.get('Cache-Control')?.includes('no-store')) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  const cacheSeconds = new URL(publicUrl).pathname.includes('/post/')
    ? POST_CACHE_SECONDS
    : PROFILE_CACHE_SECONDS

  // Cache API only honors Cache-Control and does not support stale directives.
  headers.set('Cache-Control', `public, max-age=${cacheSeconds}`)
  headers.set(
    'Cloudflare-CDN-Cache-Control',
    `public, max-age=${cacheSeconds}, stale-while-revalidate=${STALE_CACHE_SECONDS}, stale-if-error=${STALE_CACHE_SECONDS}`,
  )

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function withoutBody(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

function withCacheStatus(response: Response, status: 'HIT' | 'MISS'): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Witchsky-Embed-Cache', status)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function renderCachedEmbed({
  request,
  executionContext,
  render,
}: {
  request: Request
  executionContext: ExecutionContext
  render: (publicUrl: string) => Promise<Response>
}): Promise<Response> {
  const publicUrl = getPublicUrl(request.url)

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {Allow: 'GET, HEAD'},
    })
  }

  const cacheKey = getCacheKey(publicUrl)
  const cache = caches.default
  const cached = await cache.match(cacheKey)

  if (cached) {
    const response = withCacheStatus(cached, 'HIT')
    return request.method === 'HEAD' ? withoutBody(response) : response
  }

  const rendered = withCacheHeaders(await render(publicUrl), publicUrl)

  if (
    rendered.ok &&
    !rendered.headers.get('Cache-Control')?.includes('no-store')
  ) {
    executionContext.waitUntil(cache.put(cacheKey, rendered.clone()))
  }

  const response = withCacheStatus(rendered, 'MISS')
  return request.method === 'HEAD' ? withoutBody(response) : response
}
