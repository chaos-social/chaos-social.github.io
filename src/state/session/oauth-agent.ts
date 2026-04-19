import {Agent, type AtpSessionData} from '@atproto/api'
import {type OutputSchema} from '@atproto/api/dist/client/types/com/atproto/server/getSession'
import {type OAuthSession} from '@atproto/oauth-client-browser'

import {BLUESKY_PROXY_HEADER, BSKY_SERVICE} from '#/lib/constants'
import {logger} from '#/logger'
import {sessionAccountToSession} from './agent'
import {configureModerationForAccount} from './moderation'
import {restoreOAuthSession} from './oauth-client-adapter'
import {type SessionAccount} from './types'

export async function oauthCreateAgent(session: OAuthSession) {
  const agent = new OauthBskyAppAgent(session)
  const account = await oauthAgentAndSessionToSessionAccountOrThrow(
    agent,
    session,
  )
  const gates = Promise.resolve()
  const moderation = configureModerationForAccount(agent, account)
  return agent.prepare(account, gates, moderation)
}

const OAUTH_RESTORE_TIMEOUT_MS = 10_000

export async function oauthResumeSession(account: SessionAccount) {
  let session: OAuthSession
  try {
    session = await Promise.race([
      restoreOAuthSession(account.did),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('OAuth session restore timed out')),
          OAUTH_RESTORE_TIMEOUT_MS,
        ),
      ),
    ])
  } catch (e) {
    logger.error('oauthResumeSession: restore failed', {
      did: account.did,
      error: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
  return await oauthCreateAgent(session)
}

export async function oauthAgentAndSessionToSessionAccountOrThrow(
  agent: Agent,
  session: OAuthSession,
): Promise<SessionAccount> {
  const account = await oauthAgentAndSessionToSessionAccount(agent, session)
  if (!account) {
    throw Error('Expected an active session')
  }
  return account
}

export async function oauthAgentAndSessionToSessionAccount(
  agent: Agent,
  session: OAuthSession,
): Promise<SessionAccount | undefined> {
  let data: OutputSchema
  try {
    const res = await Promise.race([
      agent.com.atproto.server.getSession(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('getSession timed out')),
          OAUTH_RESTORE_TIMEOUT_MS,
        ),
      ),
    ])
    data = res.data
  } catch (e: any) {
    logger.error('oauthAgentAndSessionToSessionAccount: getSession failed', e)
    return undefined
  }
  let aud: string
  try {
    const tokenInfo = await Promise.race([
      session.getTokenInfo(false),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('getTokenInfo timed out')),
          OAUTH_RESTORE_TIMEOUT_MS,
        ),
      ),
    ])
    aud = tokenInfo.aud
  } catch (e: any) {
    logger.error('oauthAgentAndSessionToSessionAccount: getTokenInfo failed', e)
    return undefined
  }
  return {
    service: session.serverMetadata.issuer,
    did: session.did,
    handle: data.handle,
    email: data.email,
    emailConfirmed: data.emailConfirmed,
    emailAuthFactor: data.emailAuthFactor,
    active: data.active,
    status: data.status,
    pdsUrl: aud,
    isSelfHosted: !session.server.issuer.startsWith(BSKY_SERVICE),
    isOauthSession: true,
  }
}

export class OauthBskyAppAgent extends Agent {
  readonly sessionManager: OAuthSession
  session?: AtpSessionData
  private _serviceUrl: URL
  private _pdsUrl?: URL

  constructor(session: OAuthSession) {
    super(session)
    this.sessionManager = session
    this._serviceUrl = new URL(session.serverMetadata.issuer)
  }

  clone(): this {
    const cloned = this.copyInto(new OauthBskyAppAgent(this.sessionManager))
    cloned.session = this.session
    cloned._serviceUrl = this._serviceUrl
    cloned._pdsUrl = this._pdsUrl
    return cloned as this
  }

  get serviceUrl() {
    return this._serviceUrl
  }

  get pdsUrl() {
    return this._pdsUrl
  }

  get dispatchUrl() {
    return this.pdsUrl || this.serviceUrl
  }

  /** @deprecated use {@link serviceUrl} instead */
  get service() {
    return this.serviceUrl
  }

  async prepare(
    account: SessionAccount,
    gates: Promise<void>,
    moderation: Promise<void>,
  ) {
    this.session = sessionAccountToSession(account)
    this._serviceUrl = new URL(account.service)
    this._pdsUrl = account.pdsUrl ? new URL(account.pdsUrl) : undefined
    this.configureProxy(BLUESKY_PROXY_HEADER.get())

    await Promise.all([gates, moderation])

    return {account, agent: this}
  }

  dispose() {}

  cloneWithoutProxy(): OauthBskyAppAgent {
    const cloned = this.clone()
    cloned.configureProxy(null)
    return cloned
  }
}
