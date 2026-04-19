import {ExpoOAuthClient} from '@atproto/oauth-client-expo'
import {createIdentityResolver} from './identity-resolver'

const OAUTH_BASE_URL: string =
  process.env.EXPO_PUBLIC_OAUTH_BASE_URL || 'https://witchsky.app'

const OAUTH_CLIENT_NAME: string =
  process.env.EXPO_PUBLIC_OAUTH_CLIENT_NAME || 'Witchsky'

const OAUTH_SCOPE =
  'atproto transition:generic transition:email transition:chat.bsky'

// Reverse-domain of witchsky.app → app.witchsky
const NATIVE_REDIRECT_URI = 'app.witchsky:/auth/callback'

const BSKY_OAUTH_CLIENT = new ExpoOAuthClient({
  identityResolver: createIdentityResolver(),
  clientMetadata: {
    client_id: `${OAUTH_BASE_URL}/oauth-client-metadata-native.json`,
    client_name: OAUTH_CLIENT_NAME,
    client_uri: OAUTH_BASE_URL,
    redirect_uris: [NATIVE_REDIRECT_URI],
    scope: OAUTH_SCOPE,
    token_endpoint_auth_method: 'none',
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    application_type: 'native',
    dpop_bound_access_tokens: true,
  },
})

export function getNativeOAuthClient() {
  return BSKY_OAUTH_CLIENT
}
