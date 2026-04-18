import {
  getPdsFallbackFaviconUrl,
  isBridgedPdsUrl,
  isBskyPdsUrl,
} from '#/state/queries/pds-label.util'

describe('pds-label helpers', () => {
  it('builds a favicon.ico fallback URL from the PDS origin', () => {
    expect(getPdsFallbackFaviconUrl('https://pds.example')).toBe(
      'https://pds.example/favicon.ico',
    )
    expect(getPdsFallbackFaviconUrl('https://pds.example/xrpc')).toBe(
      'https://pds.example/favicon.ico',
    )
  })

  it('returns undefined for an invalid PDS URL', () => {
    expect(getPdsFallbackFaviconUrl('not a url')).toBeUndefined()
  })

  it('detects special-case PDS hosts', () => {
    expect(isBskyPdsUrl('https://bsky.social')).toBe(true)
    expect(isBskyPdsUrl('https://foo.host.bsky.network')).toBe(true)
    expect(isBridgedPdsUrl('https://atproto.brid.gy')).toBe(true)
  })
})
