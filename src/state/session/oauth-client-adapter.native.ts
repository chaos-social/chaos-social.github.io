import {type OAuthSession} from '@atproto/oauth-client-expo'

import {getNativeOAuthClient} from './oauth-native-client'

export function restoreOAuthSession(did: string): Promise<OAuthSession> {
  return getNativeOAuthClient().restore(did)
}
