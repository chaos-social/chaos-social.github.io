import {type Client} from '@atproto/lex'

import {PUBLIC_BSKY_SERVICE} from '#/lib/constants'
import {createLexClient} from '#/lib/lexClient'
import {getErrorName, getErrorStatus} from '#/lib/xrpc-error'
import {isBlackskySearchUpstreamFailure} from '#/state/queries/search-fallback'
import {app} from '#/lexicons'

const BLUESKY_APPVIEW = 'did:web:api.bsky.app#bsky_appview'
let publicBlueskyClient: Client | undefined

/** Try the selected AppView before falling back for unavailable actor search. */
export async function searchActorsTypeahead(
  client: Client,
  params: app.bsky.actor.searchActorsTypeahead.$Params,
): Promise<app.bsky.actor.searchActorsTypeahead.$OutputBody> {
  try {
    return await client.call(app.bsky.actor.searchActorsTypeahead, params)
  } catch (error) {
    const unavailable =
      [404, 501].includes(getErrorStatus(error) ?? 0) ||
      ['MethodNotImplemented', 'NotImplemented', 'UnsupportedMethod'].includes(
        getErrorName(error) ?? '',
      ) ||
      isBlackskySearchUpstreamFailure(error)
    if (!unavailable || client.xrpcDefaults.service === BLUESKY_APPVIEW) {
      throw error
    }
  }

  if (client.did) {
    /* Keep the account's auth and labelers, changing only this request's proxy. */
    return client.call(app.bsky.actor.searchActorsTypeahead, params, {
      service: BLUESKY_APPVIEW,
    })
  }

  /* A guest has no PDS to proxy through, so use Bluesky's public endpoint. */
  publicBlueskyClient ??= createLexClient({service: PUBLIC_BSKY_SERVICE})
  return publicBlueskyClient.call(app.bsky.actor.searchActorsTypeahead, params)
}
