/*
 * /poll/<id> — a CORS-safe read of a poll.blue poll.
 *
 * poll.blue sends no `Access-Control-Allow-Origin`, so the web build cannot
 * fetch a centralized poll's tally directly. Native has no CORS and talks to
 * poll.blue straight; this function only exists to give the browser a same
 * origin route.
 */

const UPSTREAM = 'https://poll.blue/api/poll'
const POLL_CACHE_SECONDS = 30

type Context = {params: Record<string, string | string[]>}

export const onRequestGet = async (context: Context) => {
  const id = String(context.params.id)

  if (!/^[A-Za-z0-9:~@-]{1,200}$/.test(id)) {
    return json({error: 'bad request'}, 400)
  }

  let upstream: Response
  try {
    upstream = await fetch(`${UPSTREAM}/${encodeURIComponent(id)}`, {
      headers: {accept: 'application/json'},
    })
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
      'Cache-Control': `public, max-age=${POLL_CACHE_SECONDS}`,
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
