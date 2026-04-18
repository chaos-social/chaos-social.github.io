import {type OAuthSession} from '@atproto/oauth-client-browser'
import {describe, expect, it, jest} from '@jest/globals'

jest.mock('../agent', () => ({
  sessionAccountToSession(account: {did: string; handle: string}) {
    return {
      accessJwt: '',
      did: account.did,
      emailAuthFactor: false,
      emailConfirmed: false,
      handle: account.handle,
      refreshJwt: '',
      active: true,
    }
  },
}))

jest.mock('../moderation', () => ({
  configureModerationForAccount() {
    return Promise.resolve()
  },
}))

jest.mock('../oauth-web-client', () => ({
  getWebOAuthClient() {
    throw new Error('not used in this test')
  },
}))

import {OauthBskyAppAgent} from '../oauth-agent'

function createOAuthSession(): OAuthSession {
  return {
    did: 'did:plc:alice',
    serverMetadata: {
      issuer: 'https://bsky.social',
    },
    fetchHandler() {
      throw new Error('not implemented in test')
    },
  } as unknown as OAuthSession
}

describe('OauthBskyAppAgent', () => {
  it('preserves service and dispatch urls when cloned and proxied', async () => {
    const agent = new OauthBskyAppAgent(createOAuthSession())

    expect(agent.serviceUrl.toString()).toBe('https://bsky.social/')
    expect(agent.dispatchUrl.toString()).toBe('https://bsky.social/')

    await agent.prepare(
      {
        service: 'https://bsky.social',
        did: 'did:plc:alice',
        handle: 'alice.test',
        active: true,
        emailConfirmed: false,
        emailAuthFactor: false,
        pdsUrl: 'https://alice.pds.example',
        isSelfHosted: false,
        isOauthSession: true,
      },
      Promise.resolve(),
      Promise.resolve(),
    )

    expect(agent.serviceUrl.toString()).toBe('https://bsky.social/')
    expect(agent.pdsUrl?.toString()).toBe('https://alice.pds.example/')
    expect(agent.dispatchUrl.toString()).toBe('https://alice.pds.example/')

    const proxied = agent.withProxy('bsky_fg', 'did:plc:feed')
    expect(proxied).toBeInstanceOf(OauthBskyAppAgent)
    expect(proxied.serviceUrl.toString()).toBe('https://bsky.social/')
    expect(proxied.dispatchUrl.toString()).toBe('https://alice.pds.example/')

    const pdsAgent = agent.cloneWithoutProxy()
    expect(pdsAgent.proxy).toBeUndefined()
    expect(pdsAgent.serviceUrl.toString()).toBe('https://bsky.social/')
    expect(pdsAgent.dispatchUrl.toString()).toBe('https://alice.pds.example/')
  })
})
