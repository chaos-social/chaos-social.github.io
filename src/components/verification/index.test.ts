import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import {NEVER_VERIFIED_DIDS} from '#/lib/constants'
import {useDeerVerificationEnabled} from '#/state/preferences/deer-verification'
import {usePreferencesQuery} from '#/state/queries/preferences'
import type * as bsky from '#/types/bsky'
import {useSimpleVerificationState} from './index'

jest.mock('#/state/queries/preferences', () => ({
  usePreferencesQuery: jest.fn(),
}))
jest.mock('#/state/preferences/deer-verification', () => ({
  useDeerVerificationEnabled: jest.fn(),
}))
jest.mock('#/state/queries/deer-verification', () => ({
  useMaybeDeerVerificationProfileOverlay: (profile: unknown) => profile,
}))
jest.mock('#/state/queries/useCurrentAccountProfile', () => ({
  useCurrentAccountProfile: () => undefined,
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: undefined}),
}))

const blockedDid = 'did:plc:neververified'
NEVER_VERIFIED_DIDS[blockedDid] = true

const profile = {
  did: blockedDid,
  handle: 'blocked.test',
  verification: {
    verifiedStatus: 'valid',
    trustedVerifierStatus: 'valid',
    verifications: [],
  },
} as unknown as bsky.profile.AnyProfileView

beforeEach(() => {
  jest
    .mocked(usePreferencesQuery)
    .mockReturnValue({data: undefined} as ReturnType<typeof usePreferencesQuery>)
})

it('hides badges for blocklisted accounts while the AppView is in charge', () => {
  jest.mocked(useDeerVerificationEnabled).mockReturnValue(false)
  expect(renderState()).toMatchObject({isVerified: false, showBadge: false})
})

it('leaves blocklisted accounts alone once custom verifiers are on', () => {
  jest.mocked(useDeerVerificationEnabled).mockReturnValue(true)
  expect(renderState()).toMatchObject({isVerified: true, showBadge: true})
})

function renderState() {
  let result = {} as ReturnType<typeof useSimpleVerificationState>
  function Probe() {
    result = useSimpleVerificationState({profile})
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  return result
}
