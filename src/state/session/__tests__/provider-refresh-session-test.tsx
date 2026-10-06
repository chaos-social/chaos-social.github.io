import {PasswordSession} from '@atproto/lex-password-session'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {act, render} from '@testing-library/react-native'

import {type SessionAccount} from '../types'

/*
 * The provider pulls the whole app shell in through `#/state/util` and the
 * account factories. These mocks cut the tree back to the session lifecycle
 * itself, mirroring provider-clients-test.tsx.
 */
const mockPersist = jest.fn<(...args: unknown[]) => Promise<void>>()
let mockSessionUpdate: (session: {
  accounts: SessionAccount[]
  currentAccount?: {did: string}
}) => void
jest.mock('#/state/persisted', () => {
  const {
    defaults,
  }: typeof import('#/state/persisted/schema') = require('#/state/persisted/schema')
  return {
    defaults,
    get: (key: keyof typeof defaults) => defaults[key],
    write: (...args: unknown[]) => mockPersist(...args),
    readLatest: (key: keyof typeof defaults) => defaults[key],
    onUpdate: (key: string, callback: typeof mockSessionUpdate) => {
      if (key === 'session') mockSessionUpdate = callback
      return () => {}
    },
  }
})
jest.mock('#/state/util', () => ({useCloseAllActiveElements: () => () => {}}))
jest.mock('#/components/dialogs/Context', () => ({
  useGlobalDialogsControlContext: () => ({signinDialogControl: {open() {}}}),
}))
jest.mock('#/analytics', () => ({
  AnalyticsContext: ({children}: {children: React.ReactNode}) => children,
  useAnalyticsBase: () => ({metric() {}, logger: {debug() {}, error() {}}}),
  utils: {accountToSessionMetadata: () => ({}), useMeta: () => undefined},
}))
jest.mock('#/state/shell/onboarding', () => ({
  useOnboardingDispatch: () => () => {},
}))
jest.mock('#/ageAssurance/data', () => ({
  clearAgeAssuranceServerDataForAll: () => {},
  clearAgeAssuranceServerDataForDid: () => {},
}))
jest.mock('#/lib/persisted-query-storage', () => ({
  clearPersistedQueryStorage: () => Promise.resolve(),
}))
jest.mock('#/lib/notifications/notifications', () => ({
  unregisterPushToken: () => Promise.resolve(),
}))
jest.mock('jwt-decode', () => ({
  jwtDecode: () => ({scope: 'com.atproto.access'}),
}))
jest.mock('#/state/events', () => ({
  emitSessionDropped: () => {},
  emitNetworkConfirmed: () => {},
  emitNetworkLost: () => {},
}))

const mockLogin = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.mock('../session-core', () => ({
  ...jest.requireActual<object>('../session-core'),
  createSessionBundleAndLogin: (...args: unknown[]) => mockLogin(...args),
}))
const mockAuthorize = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.mock('../oauth-native-sign-in', () => ({
  signInNative: (...args: unknown[]) => mockAuthorize(...args),
}))
jest.mock('../oauth-web-client', () => ({
  getWebOAuthClient: () => ({
    signIn: (...args: unknown[]) => mockAuthorize(...args),
  }),
}))
const mockOAuthResume = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.mock('../oauth-session-bundle', () => ({
  createOAuthSessionBundleAndLogin: () => new Promise(() => {}),
  createOAuthSessionBundleAndResume: (...args: unknown[]) =>
    mockOAuthResume(...args),
}))
jest.mock('../agent', () => ({
  Agent: class {},
  agentToSessionAccount: () => undefined,
  createAgentAndResume: () => new Promise(() => {}),
  createPublicAgent: () => ({}),
}))
const mockReauthenticate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockReauthenticationOptions = jest.fn()
jest.mock('../ephemeral-login', () => ({
  readEphemeralLogin: () => undefined,
  openEphemeralLogin: async (
    account: SessionAccount,
    authenticate: (input: unknown, signal: AbortSignal) => Promise<unknown>,
    options: unknown,
  ) => {
    mockReauthenticationOptions(options)
    return authenticate(
      await mockReauthenticate(account.did),
      new AbortController().signal,
    )
  },
}))
jest.mock('../oauth-agent', () => ({
  OauthBskyAppAgent: class {},
  oauthAgentAndSessionToSessionAccountOrThrow: (
    _agent: unknown,
    session: {did: string},
  ) =>
    Promise.resolve({
      did: session.did,
      handle: 'alternate.test',
      service: 'https://pds.test',
      isOauthSession: true,
    }),
  oauthResumeSession: () => new Promise(() => {}),
}))
jest.mock('../create-account', () => ({
  createSessionBundleAndCreateAccount: () => new Promise(() => {}),
}))

jest.mock('../moderation', () => ({
  configureModerationForAccount: () => {},
  configureModerationForGuest: () => {},
}))
const mockNetwork =
  jest.fn<(input: URL | string, init?: RequestInit) => Promise<Response>>()
jest.mock('../network', () => ({
  networkAwareFetch: (...args: Parameters<typeof mockNetwork>) =>
    mockNetwork(...args),
}))

import {AuthorFeedAPI} from '#/lib/api/feed/author'
import {
  Provider,
  usePdsClient,
  useSession,
  useSessionApi,
} from '#/state/session'
import {type SessionApiContext} from '#/state/session/types'
import {buildAppviewClient, buildChatClient, buildPdsClient} from '../clients'
import {
  buildBundle,
  makeSessionHooks,
  type OnSessionChange,
  registerBundleKillSwitch,
  type SessionBundle,
} from '../session-core'
import {sessionAccountToSessionData} from '../session-data'
import {
  asFetch,
  DID,
  HANDLE,
  json,
  makeAccount,
  makeMockFetch,
  type MockFetch,
} from './mock-fetch'

/**
 * Build a bundle whose session is a real `PasswordSession` over the stubbed
 * network, since `refreshSession` drives the session's own refresh machinery.
 */
function makeBundle(
  account: SessionAccount,
  fetchMock: MockFetch,
): SessionBundle {
  const session = new PasswordSession(sessionAccountToSessionData(account), {
    fetch: asFetch(fetchMock),
  })
  return {
    session,
    appviewClient: buildAppviewClient(session),
    pdsClient: buildPdsClient(session),
    chatClient: buildChatClient(session),
    service: new URL(account.service),
  }
}

type Harness = {
  api: SessionApiContext
  currentAccount: () => SessionAccount | undefined
  accounts: () => SessionAccount[]
  client: () => ReturnType<typeof usePdsClient>
}

function renderProvider(): Harness {
  let api!: SessionApiContext
  let currentAccount: SessionAccount | undefined
  let accounts: SessionAccount[] = []
  let client!: ReturnType<typeof usePdsClient>
  function Probe() {
    api = useSessionApi()
    client = usePdsClient()
    const state = useSession()
    currentAccount = state.currentAccount
    accounts = state.accounts
    return null
  }
  render(
    <Provider>
      <Probe />
    </Provider>,
  )
  return {
    api,
    currentAccount: () => currentAccount,
    accounts: () => accounts,
    client: () => client,
  }
}

/** Render the provider and log `account` in through the stubbed login factory. */
async function renderLoggedIn(
  account: SessionAccount,
  fetchMock: MockFetch,
): Promise<Harness> {
  const bundle = makeBundle(account, fetchMock)
  const harness = renderProvider()
  mockLogin.mockResolvedValueOnce({bundle, account})
  await act(async () => {
    await harness.api.login({} as never, 'LoginForm')
  })
  return harness
}

beforeEach(() => {
  mockPersist.mockReset().mockResolvedValue(undefined)
  mockOAuthResume.mockImplementation(() => new Promise(() => {}))
  mockLogin.mockReset()
})

describe('refreshSession', () => {
  it('resolves with the rotated account snapshot', async () => {
    const fetchMock = makeMockFetch()
    const {api} = await renderLoggedIn(makeAccount(), fetchMock)

    let refreshed: SessionAccount | undefined
    await act(async () => {
      refreshed = await api.refreshSession()
    })

    /* the mock's refresh response rotates both tokens */
    expect(refreshed?.accessJwt).toBe('access-jwt-2')
    expect(refreshed?.refreshJwt).toBe('refresh-jwt-2')
    expect(refreshed?.did).toBe(DID)
    expect(refreshed?.handle).toBe(HANDLE)
  })

  it('exposes the fresh tokens before the store has caught up', async () => {
    const fetchMock = makeMockFetch()
    const {api, currentAccount} = await renderLoggedIn(makeAccount(), fetchMock)

    /*
     * The point of the return value: `SignupQueued` branches on the fresh
     * accessJwt synchronously, without waiting for `onUpdated` -> dispatch ->
     * re-render.
     */
    let refreshed: SessionAccount | undefined
    const before = currentAccount()?.accessJwt
    await act(async () => {
      refreshed = await api.refreshSession()
    })
    expect(before).toBe('access-jwt')
    expect(refreshed?.accessJwt).toBe('access-jwt-2')
  })

  it('resolves with undefined when logged out', async () => {
    const {api} = renderProvider()

    let refreshed: SessionAccount | undefined = makeAccount()
    await act(async () => {
      refreshed = await api.refreshSession()
    })

    expect(refreshed).toBeUndefined()
  })

  it('rejects when the refresh rotated nothing', async () => {
    /*
     * A transient failure: `PasswordSession.refresh()` reports through
     * `onUpdateFailure` and resolves with the SAME data object. Callers read
     * resolution as "tokens rotated", so this must reject.
     */
    const fetchMock = makeMockFetch({
      'com.atproto.server.refreshSession': () =>
        json({error: 'InternalServerError'}, 500),
    })
    const {api} = await renderLoggedIn(makeAccount(), fetchMock)

    await expect(
      act(async () => {
        await api.refreshSession()
      }),
    ).rejects.toThrow('Failed to refresh session')
  })
})

it('does not cancel reauthentication when email state refreshes on window focus', async () => {
  const fetchMock = makeMockFetch()
  const harness = await renderLoggedIn(makeAccount(), fetchMock)
  const replacement = makeAccount({handle: 'updated.example.com'})
  const replacementBundle = makeBundle(replacement, fetchMock)
  let finishLogin!: (value: unknown) => void
  mockLogin.mockReturnValueOnce(
    new Promise(resolve => {
      finishLogin = resolve
    }),
  )
  await act(async () => {
    const login = harness.api.login({} as never, 'Settings')
    await harness.api.partialRefreshSession()
    finishLogin({bundle: replacementBundle, account: replacement})
    await login
  })
  expect(harness.currentAccount()?.handle).toBe('updated.example.com')
})

it('does not cancel login when another tab broadcasts an OAuth account', async () => {
  const fetchMock = makeMockFetch()
  const account = makeAccount()
  const harness = await renderLoggedIn(account, fetchMock)
  const replacement = makeAccount({handle: 'blacksky.example.com'})
  let finishLogin!: (value: unknown) => void
  mockLogin.mockReturnValueOnce(
    new Promise(resolve => {
      finishLogin = resolve
    }),
  )
  await act(async () => {
    const login = harness.api.login({} as never, 'Settings')
    mockSessionUpdate({
      accounts: [
        {
          ...account,
          isOauthSession: true,
          refreshJwt: undefined,
          accessJwt: undefined,
        },
      ],
      currentAccount: {did: account.did},
    })
    finishLogin({
      bundle: makeBundle(replacement, fetchMock),
      account: replacement,
    })
    await login
  })
  expect(harness.currentAccount()?.handle).toBe('blacksky.example.com')
})

it('refreshes an alternate account without replacing the active session', async () => {
  const active = makeAccount()
  const alternate: SessionAccount = {
    ...makeAccount(),
    did: 'did:plc:alternate',
    handle: 'alternate.test',
  }
  const harness = await renderLoggedIn(active, makeMockFetch())
  act(() => {
    mockSessionUpdate({
      accounts: [active, alternate],
      currentAccount: {did: active.did},
    })
  })
  const before = harness.currentAccount()
  mockReauthenticate.mockResolvedValueOnce({oauthSession: {did: alternate.did}})
  await act(async () => {
    await harness.api.reauthenticateAccount(alternate)
  })
  expect(harness.currentAccount()).toEqual(before)
  expect(
    harness.accounts().find(a => a.did === alternate.did)?.isOauthSession,
  ).toBe(true)
  expect(mockReauthenticate).toHaveBeenLastCalledWith(alternate.did)
})

it('keeps the active account when alternate login is cancelled or mismatched', async () => {
  const active = makeAccount()
  const harness = await renderLoggedIn(active, makeMockFetch())
  const alternate: SessionAccount = {...active, did: 'did:plc:alternate'}
  mockReauthenticate.mockRejectedValueOnce(new Error('OAUTH_CANCELLED'))
  await expect(harness.api.reauthenticateAccount(alternate)).rejects.toThrow(
    'OAUTH_CANCELLED',
  )
  mockReauthenticate.mockResolvedValueOnce({oauthSession: {did: active.did}})
  await expect(harness.api.reauthenticateAccount(alternate)).rejects.toThrow(
    'same account',
  )
  expect(harness.currentAccount()?.did).toBe(active.did)
})

it('accepts legacy login for an alternate account without switching', async () => {
  const active = makeAccount()
  const alternate: SessionAccount = {...active, did: 'did:plc:alternate'}
  const harness = await renderLoggedIn(active, makeMockFetch())
  act(() =>
    mockSessionUpdate({
      accounts: [active, alternate],
      currentAccount: {did: active.did},
    }),
  )
  const bundle = makeBundle(alternate, makeMockFetch())
  mockLogin.mockResolvedValueOnce({account: alternate, bundle})
  mockReauthenticate.mockResolvedValueOnce({
    service: alternate.service,
    identifier: alternate.handle,
    password: 'test',
  })
  await act(async () => {
    await harness.api.reauthenticateAccount(alternate)
  })
  expect(harness.currentAccount()?.did).toBe(active.did)
  expect(
    harness.accounts().find(a => a.did === alternate.did)?.isOauthSession,
  ).toBe(false)
})

it('restores an OAuth account received from another tab without rebroadcasting', async () => {
  const harness = renderProvider()
  const account = makeAccount({
    isOauthSession: true,
    accessJwt: undefined,
    refreshJwt: undefined,
  })
  const bundle = makeBundle(makeAccount(), makeMockFetch())
  mockOAuthResume.mockResolvedValueOnce({bundle, account})
  mockPersist.mockClear()
  await act(() => {
    mockSessionUpdate({accounts: [account], currentAccount: {did: account.did}})
    return Promise.resolve()
  })
  expect(harness.currentAccount()?.did).toBe(account.did)
  expect(mockPersist).not.toHaveBeenCalled()
})

it('keeps the synced current account persisted while OAuth restore is pending', async () => {
  const harness = renderProvider()
  const account = makeAccount({
    isOauthSession: true,
    accessJwt: undefined,
    refreshJwt: undefined,
  })
  await act(() => {
    mockSessionUpdate({accounts: [account], currentAccount: {did: account.did}})
    harness.api.reorderAccounts([account])
    return Promise.resolve()
  })
  expect(mockPersist).toHaveBeenLastCalledWith('session', {
    accounts: [account],
    currentAccount: account,
  })
})

it('does not revive an OAuth account after a later cross-tab logout', async () => {
  const harness = renderProvider()
  const account = makeAccount({
    isOauthSession: true,
    accessJwt: undefined,
    refreshJwt: undefined,
  })
  let finishRestore!: (value: unknown) => void
  mockOAuthResume.mockReturnValueOnce(
    new Promise(resolve => {
      finishRestore = resolve
    }),
  )
  await act(() => {
    mockSessionUpdate({accounts: [account], currentAccount: {did: account.did}})
    mockSessionUpdate({accounts: [account]})
    finishRestore({bundle: makeBundle(makeAccount(), makeMockFetch()), account})
    return Promise.resolve()
  })
  expect(harness.currentAccount()).toBeUndefined()
})

it('keeps the current account when login for an expired saved account is cancelled', async () => {
  const active = makeAccount()
  const alternate = makeAccount({
    did: 'did:plc:alternate',
    refreshJwt: undefined,
    accessJwt: undefined,
  })
  const harness = await renderLoggedIn(active, makeMockFetch())
  act(() =>
    mockSessionUpdate({
      accounts: [active, alternate],
      currentAccount: {did: active.did},
    }),
  )
  mockReauthenticate.mockRejectedValueOnce(
    new Error('Authentication cancelled'),
  )
  await act(async () => {
    await expect(harness.api.resumeSession(alternate, true)).rejects.toThrow(
      'cancelled',
    )
  })
  expect(mockReauthenticate).toHaveBeenCalledWith(alternate.did)
  expect(harness.currentAccount()?.did).toBe(active.did)
})

it('offers the login chooser when an OAuth account lacks access to the appview', async () => {
  const active = makeAccount()
  const alternate = makeAccount({
    did: 'did:plc:alternate',
    isOauthSession: true,
    refreshJwt: undefined,
    accessJwt: undefined,
  })
  const harness = await renderLoggedIn(active, makeMockFetch())
  act(() =>
    mockSessionUpdate({
      accounts: [active, alternate],
      currentAccount: {did: active.did},
    }),
  )
  mockOAuthResume.mockRejectedValueOnce(
    new Error('Please authorize this account for the selected app server'),
  )
  mockReauthenticate.mockRejectedValueOnce(
    new Error('Authentication cancelled'),
  )
  await act(async () => {
    await expect(harness.api.resumeSession(alternate, true)).rejects.toThrow(
      'cancelled',
    )
  })
  expect(mockReauthenticate).toHaveBeenCalledWith(alternate.did)
  expect(mockReauthenticationOptions).toHaveBeenLastCalledWith({
    allowAppServerSwitch: true,
  })
  expect(harness.currentAccount()?.did).toBe(active.did)
})

it('starts permission OAuth immediately without opening the login chooser', async () => {
  mockReauthenticate.mockClear()
  const active = makeAccount()
  const harness = await renderLoggedIn(active, makeMockFetch())
  mockAuthorize.mockResolvedValueOnce({did: active.did})
  await act(async () => {
    const result = harness.api.reauthenticateAccount(active, {
      scope: 'atproto account:email?action=manage',
      directOAuth: true,
    })
    expect(mockAuthorize).toHaveBeenCalledWith(
      active.did,
      expect.objectContaining({scope: 'atproto account:email?action=manage'}),
    )
    await result
  })
  expect(mockReauthenticate).not.toHaveBeenCalled()
})

/** Log in with the real session hooks and disposal guard used by the app. */
async function renderHookedPasswordSession() {
  const account = makeAccount()
  mockNetwork.mockImplementation(
    makeMockFetch({'app.bsky.feed.getAuthorFeed': () => json({feed: []})}),
  )
  let bundle!: SessionBundle
  mockLogin.mockImplementationOnce((_params, onSessionChange) => {
    const hooks = makeSessionHooks({
      getBundle: () => bundle,
      getDid: () => account.did,
      onSessionChange: onSessionChange as OnSessionChange,
    })
    bundle = buildBundle(
      new PasswordSession(sessionAccountToSessionData(account), hooks),
    )
    registerBundleKillSwitch(bundle, hooks.kill)
    hooks.arm()
    return Promise.resolve({account, bundle})
  })
  const harness = renderProvider()
  await act(async () => {
    await harness.api.login({} as never, 'LoginForm')
  })
  return {account, bundle, harness}
}

describe('password session persistence notifications', () => {
  it.each([false, true])(
    'keeps a retained profile feed usable after refresh (same-tab notification: %s)',
    async notifySameTab => {
      const {account, bundle, harness} = await renderHookedPasswordSession()
      const retainedFeed = new AuthorFeedAPI({
        client: bundle.appviewClient,
        feedParams: {actor: account.did},
      })
      if (notifySameTab) {
        mockPersist.mockImplementation((key, value) => {
          if (key === 'session') mockSessionUpdate(value as never)
          return Promise.resolve()
        })
      }
      await act(async () => {
        await bundle.session.refresh()
      })
      expect(harness.currentAccount()?.refreshJwt).toBe('refresh-jwt-2')
      expect(bundle.session.session.refreshJwt).toBe('refresh-jwt-2')
      expect(harness.client()).toBe(bundle.pdsClient)
      await expect(
        retainedFeed.fetch({cursor: undefined, limit: 30}),
      ).resolves.toEqual({cursor: undefined, feed: []})
    },
  )

  it('still installs rotated tokens received from another tab', async () => {
    const {account, bundle, harness} = await renderHookedPasswordSession()
    const updated = {
      ...account,
      accessJwt: 'other-tab-access',
      refreshJwt: 'other-tab-refresh',
    }
    act(() => {
      mockSessionUpdate({
        accounts: [updated],
        currentAccount: {did: account.did},
      })
    })
    expect(harness.client()).not.toBe(bundle.pdsClient)
    expect(harness.currentAccount()?.refreshJwt).toBe('other-tab-refresh')
    const feed = new AuthorFeedAPI({
      client: harness.client(),
      feedParams: {actor: account.did},
    })
    await expect(feed.fetch({cursor: undefined, limit: 30})).resolves.toEqual({
      cursor: undefined,
      feed: [],
    })
    const [, init] = mockNetwork.mock.calls.at(-1)!
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer other-tab-access',
    )
  })
})
