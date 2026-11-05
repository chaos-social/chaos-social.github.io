const FALLBACK_PDS = 'https://bsky.social'

/**
 * The video blob lives on the author's PDS, not on the video service, so resolve
 * it from the DID document. bsky.social already redirects getBlob to an account's
 * real PDS, so it is a working fallback when the lookup fails.
 */
export async function getVideoBlobUrl(
  did: string,
  cid: string,
): Promise<string> {
  const pds = (await resolvePds(did)) ?? FALLBACK_PDS
  const url = new URL('/xrpc/com.atproto.sync.getBlob', pds)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid)
  return url.toString()
}

/**
 * Where a DID document can be fetched. Mirrors `getDidDocumentUrl` in
 * `src/lib/atproto/did.ts`; functions cannot import from the app bundle.
 */
export function getDidDocumentUrl(did: string): string | undefined {
  if (did.startsWith('did:plc:')) {
    return `https://plc.directory/${did}`
  }
  if (!did.startsWith('did:web:')) return

  const [hostEnc, ...pathSegments] = did.slice('did:web:'.length).split(':')
  if (!hostEnc) return

  // `%3A` encodes the port separator, and localhost is served over plain http
  const host = hostEnc.replace(/%3A/gi, ':')
  const scheme = host.startsWith('localhost') ? 'http' : 'https'
  const path = pathSegments.length
    ? `/${pathSegments.join('/')}/did.json`
    : '/.well-known/did.json'

  return `${scheme}://${host}${path}`
}

async function resolvePds(did: string): Promise<string | undefined> {
  const docUrl = getDidDocumentUrl(did)
  if (!docUrl) return

  try {
    const response = await fetch(docUrl, {
      headers: {accept: 'application/did+ld+json, application/json'},
    })
    if (!response.ok) return

    const doc = (await response.json()) as {
      service?: Array<{id?: string; serviceEndpoint?: string}>
    }
    const pds = doc.service?.find(
      service =>
        service.id === '#atproto_pds' &&
        typeof service.serviceEndpoint === 'string',
    )
    return pds?.serviceEndpoint
  } catch {
    return
  }
}
