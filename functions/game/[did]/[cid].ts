/*
 * /game/<did>/<cid> — the URL an external embed advertises.
 *
 * Stock clients show it as a link card and open it in a browser, so it has to
 * both carry Open Graph metadata for the card and land the visitor on a playable
 * page. Cloudflare Pages Functions handle the "page" part; the OG metadata is
 * what the AppView's unfurl already cached from this response.
 */

type Env = {ASSETS?: {fetch: (req: Request) => Promise<Response>}}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const onRequestGet: PagesFunction<Env> = async context => {
  const did = String(context.params.did)
  const cid = String(context.params.cid)

  /*
   * Both segments are opaque identifiers we pass back out into the player URL,
   * so reject anything that isn't shaped like one before reflecting it.
   */
  if (!/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(did) || !/^[a-zA-Z0-9]+$/.test(cid)) {
    return new Response('Not found', {status: 404})
  }

  const player = new URL('/static/iframe/game.html', context.request.url)
  player.searchParams.set('game', context.request.url)

  const title = 'Game on Witchsky'
  const description =
    'Play this Flash game, Java applet, or visual novel in your browser.'

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(context.request.url)}" />
<meta name="twitter:card" content="summary" />
<link rel="canonical" href="${escapeHtml(context.request.url)}" />
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  iframe { border: 0; width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<iframe src="${escapeHtml(player.toString())}" allow="autoplay; fullscreen; gamepad"
  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"></iframe>
</body>
</html>`

  return new Response(page, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      /* The page mirrors a DID/CID pair, so keep it out of other origins' reach. */
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}
