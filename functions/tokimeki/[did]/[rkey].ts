/*
 * /tokimeki/<did>/<rkey> — a CORS-safe read of a TOKIMEKI poll.
 *
 * TOKIMEKI only reflects an `Access-Control-Allow-Origin` for its own origins,
 * so the web build cannot fetch a poll's tally directly. Native has no CORS and
 * talks to the service straight; this function only gives the browser a same
 * origin route.
 */

const UPSTREAM = 'https://poll.tokimeki.tech/xrpc/tech.tokimeki.poll.getPoll'
const POLL_CACHE_SECONDS = 15

type Context = {
  params: Record<string, string | string[]>
  request: Request
}

export const onRequestGet = async (context: Context) => {
  const did = String(context.params.did)
  const rkey = String(context.params.rkey)
  const viewer = new URL(context.request.url).searchParams.get('viewer')

  if (
    !/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(did) ||
    !/^[a-zA-Z0-9._:~-]{1,512}$/.test(rkey) ||
    (viewer && !/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(viewer))
  ) {
    return json({error: 'bad request'}, 400)
  }

  const url = new URL(UPSTREAM)
  url.searchParams.set('uri', `at://${did}/tech.tokimeki.poll.poll/${rkey}`)
  if (viewer) url.searchParams.set('viewer', viewer)

  let upstream: Response
  try {
    upstream = await fetch(url, {headers: {accept: 'application/json'}})
  } catch {
    return json({error: 'unreachable'}, 502)
  }

  if (!upstream.ok) {
    return json({error: 'not found'}, upstream.status === 404 ? 404 : 502)
  }

  return new Response(await upstream.text(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      /*
       * The body carries the caller's own vote, so the browser may cache it but
       * no shared cache should.
       */
      'Cache-Control': `private, max-age=${POLL_CACHE_SECONDS}`,
    },
  })
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
