import {device} from '#/storage'
import {
  completeWebOAuth,
  ensureAppViewAccess,
  readOAuthCallbackParams,
  startAppViewSwitch,
} from '../oauth-appview-switch'
import {restoreOAuthSession} from '../oauth-client-adapter'
import {buildOAuthScope} from '../oauth-config'
import {getWebOAuthClient} from '../oauth-web-client'

jest.mock('../oauth-client-adapter', () => ({restoreOAuthSession: jest.fn()}))
jest.mock('#/storage', () => ({device: {get: jest.fn(), set: jest.fn()}}))
jest.mock('../oauth-scopes', () => ({
  getOAuthAudiences: () => ({
    appview: 'did:web:api.bsky.app#bsky_appview',
    chat: 'did:web:api.bsky.chat#bsky_chat',
  }),
}))
jest.mock('../oauth-web-client', () => ({getWebOAuthClient: jest.fn()}))

const selection = {
  did: 'did:web:api.eurosky.network',
  url: 'https://api.eurosky.network',
}
const initCallback = jest.fn()
const signIn = jest.fn()
const login = jest.fn()
const values = new Map<string, string>()
const account = 'did:plc:account'
const session = {
  did: account,
  getTokenInfo: () =>
    Promise.resolve({scope: buildOAuthScope(selection.did + '#bsky_appview')}),
}

beforeEach(() => {
  jest.resetAllMocks()
  values.clear()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {hash: '', search: '', pathname: '/auth/web/callback'},
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  })
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {randomUUID: () => 'switch-state'},
  })
  jest
    .mocked(getWebOAuthClient)
    .mockReturnValue({initCallback, signIn} as never)
  login.mockResolvedValue(undefined)
})

function legacyCallback() {
  window.location.hash = '#state=opaque-state&code=authorization-code'
  values.set(
    'oauth_appview_switch',
    JSON.stringify({
      account,
      state: 'switch-state',
      selection,
      previous: {},
      audiences: {
        appview: selection.did + '#bsky_appview',
        chat: 'did:web:api.bsky.chat#bsky_chat',
      },
    }),
  )
}

it('opens a popup immediately and leaves source routing intact until consent', async () => {
  let authorize!: (value: typeof session) => void
  signIn.mockReturnValue(
    new Promise(resolve => {
      authorize = resolve
    }),
  )
  const switching = startAppViewSwitch(account, selection, login)
  expect(signIn).toHaveBeenCalledWith(account, {
    scope: buildOAuthScope(),
    display: 'popup',
  })
  expect(JSON.parse(values.get('oauth_appview_switch')!)).toMatchObject({
    mode: 'popup',
  })
  expect(device.set).not.toHaveBeenCalled()
  expect(login).not.toHaveBeenCalled()
  authorize(session)
  await switching
  expect(device.set).toHaveBeenCalledWith(['customAppViewDid'], selection.did)
  expect(login).toHaveBeenCalledWith(session)
  expect(values.size).toBe(0)
})

it('redirects installed PWAs and completes the app server switch on return', async () => {
  window.matchMedia = jest.fn().mockReturnValue({matches: true})
  signIn.mockReturnValueOnce(new Promise(() => {}))
  void startAppViewSwitch(account, selection, login)
  expect(signIn).toHaveBeenCalledWith(account, {
    scope: buildOAuthScope(),
    display: 'page',
    state: 'switch-state',
  })
  expect(
    JSON.parse(values.get('oauth_appview_switch')!) as object,
  ).not.toHaveProperty('mode')
  expect(device.set).not.toHaveBeenCalled()
  window.location.hash = '#state=switch-state&code=authorization-code'
  initCallback.mockResolvedValueOnce({state: 'switch-state', session})
  await expect(completeWebOAuth(login)).resolves.toBe(true)
  expect(device.set).toHaveBeenCalledWith(['customAppViewDid'], selection.did)
  expect(login).toHaveBeenCalledWith(session)
})

it.each(['access_denied', 'cancelled'])(
  'preserves routing after %s',
  async reason => {
    signIn.mockRejectedValue(new Error(reason))
    await expect(startAppViewSwitch(account, selection, login)).rejects.toThrow(
      reason,
    )
    expect(device.set).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
    expect(values.size).toBe(0)
  },
)

it('rejects the wrong account before changing routing', async () => {
  signIn.mockResolvedValue({...session, did: 'did:plc:other'})
  await expect(startAppViewSwitch(account, selection, login)).rejects.toThrow(
    'Unexpected OAuth',
  )
  expect(device.set).not.toHaveBeenCalled()
  expect(login).not.toHaveBeenCalled()
})

it('rejects a grant that omitted the selected AppView', async () => {
  signIn.mockResolvedValue({
    ...session,
    getTokenInfo: () => Promise.resolve({scope: 'atproto'}),
  })
  await expect(startAppViewSwitch(account, selection, login)).rejects.toThrow(
    'Please authorize',
  )
  expect(device.set).not.toHaveBeenCalled()
})

it('keeps the new routing when loading fails after the old grant was replaced', async () => {
  signIn.mockResolvedValue(session)
  login.mockRejectedValue(new Error('network unavailable'))
  await expect(startAppViewSwitch(account, selection, login)).rejects.toThrow(
    'network unavailable',
  )
  expect(device.set).toHaveBeenCalledTimes(2)
  expect(device.set).toHaveBeenLastCalledWith(
    ['customAppViewUrl'],
    selection.url,
  )
  expect(values.size).toBe(0)
})

it('completes a redirect started by an older client using its requested audience', async () => {
  legacyCallback()
  initCallback.mockResolvedValue({session, state: 'switch-state'})
  login.mockImplementationOnce(() => {
    expect(device.set).toHaveBeenCalledWith(['customAppViewDid'], selection.did)
    return Promise.resolve()
  })
  await expect(completeWebOAuth(login)).resolves.toBe(true)
  expect(getWebOAuthClient).toHaveBeenLastCalledWith({
    appview: selection.did + '#bsky_appview',
    chat: 'did:web:api.bsky.chat#bsky_chat',
  })
  expect(values.size).toBe(0)
})

it('shares the callback exchange between startup and the callback route', async () => {
  legacyCallback()
  let finish!: (value: unknown) => void
  initCallback.mockImplementation(() => {
    window.location.hash = ''
    return new Promise(resolve => {
      finish = resolve
    })
  })
  const first = completeWebOAuth(login)
  const secondLogin = jest.fn()
  const second = completeWebOAuth(secondLogin)
  expect(first).toBe(second)
  expect(initCallback).toHaveBeenCalledTimes(1)
  finish({session, state: 'switch-state'})
  await first
  expect(login).toHaveBeenCalledTimes(1)
  expect(secondLogin).not.toHaveBeenCalled()
  await expect(completeWebOAuth(secondLogin)).resolves.toBe(false)
  expect(initCallback).toHaveBeenCalledTimes(1)
})

it.each(['hash', 'search'] as const)(
  'recognizes callback parameters in %s',
  key => {
    window.location[key] = `${key === 'hash' ? '#' : '?'}state=opaque&code=code`
    expect(readOAuthCallbackParams()?.get('code')).toBe('code')
  },
)

it('does not restore or reauthenticate on a bare callback route', async () => {
  await expect(completeWebOAuth(login)).resolves.toBe(false)
  expect(initCallback).not.toHaveBeenCalled()
  expect(login).not.toHaveBeenCalled()
})

it('leaves popup login and routing to the initiating page', async () => {
  legacyCallback()
  const pending = JSON.parse(values.get('oauth_appview_switch')!)
  values.set(
    'oauth_appview_switch',
    JSON.stringify({...pending, mode: 'popup'}),
  )
  const handoff = Object.assign(new Error('continued in parent'), {
    code: 'LOGIN_CONTINUED_IN_PARENT_WINDOW',
  })
  initCallback.mockRejectedValue(handoff)
  await expect(completeWebOAuth(login)).rejects.toBe(handoff)
  expect(device.set).not.toHaveBeenCalled()
  expect(login).not.toHaveBeenCalled()
})

it.each([
  {did: 'did:plc:other', state: 'switch-state'},
  {did: account, state: 'different-switch'},
])('rejects a mismatched redirect callback %j', async ({did, state}) => {
  legacyCallback()
  initCallback.mockResolvedValue({session: {did}, state})
  await expect(completeWebOAuth(login)).rejects.toThrow('Unexpected OAuth')
  expect(device.set).not.toHaveBeenCalled()
  expect(login).not.toHaveBeenCalled()
})

it('reports a missing grant without starting OAuth or changing routing', async () => {
  jest.mocked(restoreOAuthSession).mockResolvedValue({
    ...session,
    getTokenInfo: () => Promise.resolve({scope: 'atproto'}),
  } as never)
  expect(await ensureAppViewAccess(account)).toBe(false)
  expect(signIn).not.toHaveBeenCalled()
  expect(device.set).not.toHaveBeenCalled()
})

it('stops waiting on a stuck browser lock without launching authorization', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(restoreOAuthSession).mockReturnValueOnce(new Promise(() => {}))
    const access = ensureAppViewAccess(account)
    const rejected = expect(access).rejects.toMatchObject({
      name: 'OAuthSessionBusyError',
    })
    await jest.advanceTimersByTimeAsync(10_000)
    await rejected
    expect(signIn).not.toHaveBeenCalled()
    expect(device.set).not.toHaveBeenCalled()
    jest.mocked(restoreOAuthSession).mockResolvedValueOnce({
      getTokenInfo: () => Promise.resolve({scope: buildOAuthScope()}),
    } as never)
    await expect(ensureAppViewAccess(account)).resolves.toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

it('resumes a production transition grant on a custom AppView without login', async () => {
  jest.mocked(restoreOAuthSession).mockResolvedValue(session as never)
  await expect(ensureAppViewAccess(account)).resolves.toBe(true)
  expect(signIn).not.toHaveBeenCalled()
  expect(device.set).not.toHaveBeenCalled()
})
