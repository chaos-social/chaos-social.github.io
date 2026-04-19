import {type OAuthSession} from '@atproto/oauth-client-browser'

import {getWebOAuthClient} from './oauth-web-client'

export function restoreOAuthSession(did: string): Promise<OAuthSession> {
  return getWebOAuthClient().restore(did)
}
