import {TOKIMEKI_HOSTS, type TokimekiPollRef} from './types'

const DID_RE = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/
const RKEY_RE = /^[a-zA-Z0-9._:~-]{1,512}$/

/**
 * Reads a TOKIMEKI poll link, which posts carry as an ordinary external embed:
 * `https://poll.tokimeki.tech/p/<did>/<rkey>`. The `?options=` query is only a
 * layout hint for TOKIMEKI's own page, so it is ignored.
 */
export function parseTokimekiPollUrl(url: string): TokimekiPollRef | undefined {
  let urlp: URL
  try {
    urlp = new URL(url)
  } catch {
    return
  }
  if (!TOKIMEKI_HOSTS.includes(urlp.hostname)) return

  const parts = urlp.pathname.split('/').filter(Boolean)
  if (parts.length !== 3 || parts[0] !== 'p') return

  const [, did, rkey] = parts.map(part => decodeURIComponent(part))
  if (!DID_RE.test(did) || !RKEY_RE.test(rkey)) return
  return {did, rkey}
}
