const BSKY_PDS_HOSTNAMES = ['bsky.social', 'staging.bsky.dev']
const BSKY_PDS_SUFFIX = '.bsky.network'
const BRIDGY_FED_HOSTNAME = 'atproto.brid.gy'

export function isBskyPdsUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return (
      BSKY_PDS_HOSTNAMES.includes(hostname) ||
      hostname.endsWith(BSKY_PDS_SUFFIX)
    )
  } catch {
    return false
  }
}

export function isBridgedPdsUrl(url: string): boolean {
  try {
    return new URL(url).hostname === BRIDGY_FED_HOSTNAME
  } catch {
    return false
  }
}

export function getFaviconServiceUrl(
  pdsUrl: string,
  faviconService: string,
): string | undefined {
  try {
    const hostname = new URL(pdsUrl).hostname
    return faviconService.replace('(pds)', hostname)
  } catch {
    return undefined
  }
}

export function getPdsFallbackFaviconUrl(pdsUrl: string): string | undefined {
  try {
    return new URL('/favicon.ico', pdsUrl).toString()
  } catch {
    return undefined
  }
}
