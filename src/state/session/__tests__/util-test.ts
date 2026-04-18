import {describe, expect, it, jest} from '@jest/globals'

jest.mock('#/state/persisted', () => ({
  get: jest.fn(),
}))

jest.mock('../agent', () => ({
  sessionAccountToSession: jest.fn(),
}))

import {canAttemptSessionResume} from '../util'

describe('canAttemptSessionResume', () => {
  it('allows OAuth accounts without persisted JWTs', () => {
    expect(
      canAttemptSessionResume({
        service: 'https://bsky.social',
        did: 'did:plc:alice',
        handle: 'alice.test',
        isOauthSession: true,
      }),
    ).toBe(true)
  })

  it('allows legacy accounts with a refresh token even if access token is missing', () => {
    expect(
      canAttemptSessionResume({
        service: 'https://bsky.social',
        did: 'did:plc:alice',
        handle: 'alice.test',
        refreshJwt: 'refresh-token',
      }),
    ).toBe(true)
  })

  it('rejects accounts with no resumable session state', () => {
    expect(
      canAttemptSessionResume({
        service: 'https://bsky.social',
        did: 'did:plc:alice',
        handle: 'alice.test',
      }),
    ).toBe(false)
  })
})
