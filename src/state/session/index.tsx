import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {type Client} from '@atproto/lex'
import {type SessionData} from '@atproto/lex-password-session'

import * as persisted from '#/state/persisted'
import {type Schema as PersistedSchema} from '#/state/persisted/schema'
import {useCloseAllActiveElements} from '#/state/util'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import {AnalyticsContext, useAnalyticsBase, utils} from '#/analytics'
import {IS_WEB} from '#/env'
import {com} from '#/lexicons'
import {device} from '#/storage'
import {emitSessionDropped} from '../events'
import {getPublicAppviewClient} from './clients'
import {createSessionBundleAndCreateAccount} from './create-account'
import {isEphemeralAuthError} from './ephemeral-auth'
import {type LoginInput, openEphemeralLogin} from './ephemeral-login'
import {pickExpiryRescueCandidate} from './expiry-rescue'
import {signInNative} from './oauth-native-sign-in'
import {getOAuthScope} from './oauth-scopes'
import {getWebOAuthClient} from './oauth-web-client'
import {getWebOAuthDisplay} from './oauth-web-display'
import {type Action, getInitialState, reducer, type State} from './reducer'
import {
  type ActiveSessionBundle,
  type AtpSessionEvent,
  createSessionBundleAndLogin,
  createSessionBundleAndResume,
  createSessionBundleFromStoredAccount,
  disposeBundle,
  type PublicSessionBundle,
  type SessionBundle,
  sessionDataToSessionAccount,
} from './session-core'
export {isSignupQueued} from './session-data'
import {
  addSessionDebugLog,
  getBundleId,
  redactAccount,
  redactPersistedSession,
  redactSessionData,
  redactState,
} from './logging'
import {
  createOAuthSessionBundleAndLogin,
  createOAuthSessionBundleAndResume,
} from './oauth-session-bundle'
export type {SessionAccount} from '#/state/session/types'

import {type AtpAgent} from '@atproto/api'

import {clearPersistedQueryStorage} from '#/lib/persisted-query-storage'
import {
  type SessionAccount,
  type SessionApiContext,
  type SessionStateContext,
} from '#/state/session/types'
import {useOnboardingDispatch} from '#/state/shell/onboarding'
import {
  clearAgeAssuranceServerDataForAll,
  clearAgeAssuranceServerDataForDid,
} from '#/ageAssurance/data'
import {
  Agent as LegacyAgent,
  agentToSessionAccount,
  createAgentAndResume,
  createPublicAgent,
} from './agent'
import {
  oauthAgentAndSessionToSessionAccountOrThrow,
  OauthBskyAppAgent,
  oauthResumeSession,
} from './oauth-agent'

const StateContext = createContext<SessionStateContext>({
  accounts: [],
  currentAccount: undefined,
  hasSession: false,
})
StateContext.displayName = 'SessionStateContext'

/** Active account bundle, or the public bundle when logged out. */
const BundleContext = createContext<
  ActiveSessionBundle | PublicSessionBundle | null
>(null)
BundleContext.displayName = 'SessionBundleContext'

const ApiContext = createContext<SessionApiContext>({
  createAccount: async () => {},
  login: async () => {},
  logoutCurrentAccount: () => {},
  logoutEveryAccount: () => {},
  resumeSession: async () => {},
  removeAccount: () => {},
  reorderAccounts: () => {},
  partialRefreshSession: async () => {},
  refreshSession: () => Promise.resolve(undefined),
  reauthenticateAccount: () => Promise.reject(new Error('No session provider')),
  createEphemeralAgent: () => {
    throw new Error('Not implemented')
  },
})
ApiContext.displayName = 'SessionApiContext'

class SessionStore {
  private state: State
  private persisting = false
  // A synced account can be selected before its asynchronous restore finishes.
  private selectedDid: string | undefined =
    persisted.get('session').currentAccount?.did
  private listeners = new Set<() => void>()

  constructor() {
    // Careful: By the time this runs, `persisted` needs to already be filled.
    const initialState = getInitialState(persisted.get('session').accounts)
    addSessionDebugLog({type: 'reducer:init', state: redactState(initialState)})
    this.state = initialState
  }

  getState = (): State => {
    return this.state
  }

  /** Whether this store is making a synchronous call to persistence. */
  isPersisting = (): boolean => {
    return this.persisting
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispatch = (action: Action) => {
    const previous = this.state
    const nextState = reducer(this.state, action)
    this.state = nextState
    if (action.type === 'synced-accounts') {
      this.selectedDid = action.syncedCurrentDid
    } else if (
      action.type === 'switched-to-account' ||
      action.type === 'logged-out-current-account' ||
      action.type === 'logged-out-every-account' ||
      (action.type === 'removed-account' &&
        action.accountDid === this.selectedDid) ||
      (action.type === 'received-session-event' &&
        action.sessionEvent === 'expired' &&
        previous.currentBundleState.did !== nextState.currentBundleState.did)
    ) {
      this.selectedDid = nextState.currentBundleState.did
    }
    // Persist synchronously without waiting for the React render cycle.
    if (nextState.needsPersist) {
      nextState.needsPersist = false
      const persistedData = {
        accounts: nextState.accounts,
        currentAccount: nextState.accounts.find(
          a => a.did === this.selectedDid,
        ),
      }
      addSessionDebugLog({
        type: 'persisted:broadcast',
        data: redactPersistedSession(persistedData),
      })
      this.persisting = true
      try {
        void persisted.write('session', persistedData)
      } finally {
        this.persisting = false
      }
    }
    this.listeners.forEach(listener => listener())
  }
}

export function Provider({children}: PropsWithChildren<{}>) {
  const ax = useAnalyticsBase()
  const cancelPendingTask = useOneTaskAtATime()
  // eslint-disable-next-line react/hook-use-state
  const [store] = useState(() => new SessionStore())
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const onboardingDispatch = useOnboardingDispatch()

  // Refresh-token generations that have already failed during expiry rescue.
  const failedExpiryTokensRef = useRef<Map<string, Set<string>>>(new Map())
  /*
   * Rescued bundles need this callback for their own events. A ref avoids a
   * self-reference in the callback's dependency list. It is filled by the
   * insertion effect below, which commits well before any session hook can
   * fire: hooks are armed only after an asynchronous session factory resolves.
   */
  const onSessionChangeRef = useRef<
    | ((
        bundle: SessionBundle,
        accountDid: string,
        sessionEvent: AtpSessionEvent,
        sessionData?: SessionData,
      ) => void)
    | null
  >(null)

  const onSessionChange = useCallback(
    (
      bundle: SessionBundle,
      accountDid: string,
      sessionEvent: AtpSessionEvent,
      sessionData?: SessionData,
    ) => {
      /*
       * Only the live bundle may reset the expiry-rescue bookkeeping: a stale
       * bundle's late update would otherwise clear the failed-generation set
       * that bounds the rescue loop. (Its dispatch below is separately dropped
       * by the reducer's identity guard.)
       */
      if (
        sessionEvent === 'update' &&
        sessionData &&
        (store.getState().currentBundleState.bundle as unknown as
          ActiveSessionBundle | PublicSessionBundle) === bundle
      ) {
        failedExpiryTokensRef.current.get(accountDid)?.clear()
      }

      /*
       * PasswordSession invokes its hooks before updating its live getter. Use
       * the delivered payload so a refresh persists the newly rotated tokens.
       *
       * A refresh payload carries no didDoc unless the server sends one, so the
       * stored account's `pdsUrl` is threaded in as the fallback. Without it the
       * refresh would persist `pdsUrl: undefined` and the next cold start would
       * route pre-refresh requests to the entryway instead of the PDS.
       */
      const refreshedAccount =
        sessionEvent === 'update' && sessionData
          ? sessionDataToSessionAccount(
              sessionData,
              sessionData.service,
              store.getState().accounts.find(a => a.did === accountDid)?.pdsUrl,
            )
          : undefined

      /*
       * A stale tab may expire a token after another tab has already rotated it.
       * Prefer a newer persisted or reducer generation over logging every tab
       * out. Failed generations are recorded and bounded to guarantee that a
       * repeatedly expiring session eventually falls through to logout.
       */
      if (sessionEvent === 'expired') {
        const current = store.getState()
        const currentBundle = current.currentBundleState.bundle as unknown as
          ActiveSessionBundle | PublicSessionBundle
        const dyingRefreshJwt = sessionData?.refreshJwt
        // Stale bundle events are handled by the reducer's identity guard.
        if (
          currentBundle === bundle &&
          current.currentBundleState.did === accountDid &&
          dyingRefreshJwt
        ) {
          let failedSet = failedExpiryTokensRef.current.get(accountDid)
          if (!failedSet) {
            failedSet = new Set()
            failedExpiryTokensRef.current.set(accountDid, failedSet)
          }
          failedSet.add(dyingRefreshJwt)

          const persistedCandidate = persisted
            .readLatest('session')
            .accounts.find(a => a.did === accountDid)
          const reducerCandidate = current.accounts.find(
            a => a.did === accountDid,
          )
          const candidate = pickExpiryRescueCandidate({
            dyingRefreshJwt,
            candidates: [persistedCandidate, reducerCandidate],
            failedRefreshJwts: failedSet,
          })

          if (candidate) {
            const rebuilt = createSessionBundleFromStoredAccount(
              candidate,
              onSessionChangeRef.current!,
            )
            if (rebuilt) {
              store.dispatch({
                type: 'replaced-current-bundle',
                newBundle: rebuilt.bundle,
                newAccount: rebuilt.account,
              })
              return
            }
          }
        }
      }

      // Only the current bundle may report that its session was dropped.
      if (
        sessionEvent === 'expired' &&
        store.getState().currentBundleState.bundle === bundle
      ) {
        emitSessionDropped()
      }
      // Bundle identity prevents stale sessions from changing the active account.
      store.dispatch({
        type: 'received-session-event',
        bundle,
        refreshedAccount,
        accountDid,
        sessionEvent,
      })
    },
    [store],
  )
  /*
   * Writing the ref during render is forbidden under React Compiler. An
   * insertion effect is the earliest commit-time slot, and the only reader
   * (`onSessionChange`'s expiry-rescue path) runs from armed session hooks,
   * which cannot fire before the first commit.
   */
  useInsertionEffect(() => {
    onSessionChangeRef.current = onSessionChange
  }, [onSessionChange])

  const createAccount = useCallback<SessionApiContext['createAccount']>(
    async (params, metrics) => {
      addSessionDebugLog({type: 'method:start', method: 'createAccount'})
      const signal = cancelPendingTask()
      ax.metric('account:create:begin', {})
      const {bundle, account} = await createSessionBundleAndCreateAccount(
        params,
        onSessionChange,
      )

      if (signal.aborted) {
        // The factory returns an armed bundle, so a superseded signup must dispose it.
        disposeBundle(bundle)
        return
      }
      store.dispatch({
        type: 'switched-to-account',
        newBundle: bundle,
        newAccount: account,
      })
      ax.metric('account:create:success', metrics, {
        session: utils.accountToSessionMetadata(account),
      })
      addSessionDebugLog({
        type: 'method:end',
        method: 'createAccount',
        account: redactAccount(account),
      })
    },
    [ax, store, onSessionChange, cancelPendingTask],
  )

  const login = useCallback<SessionApiContext['login']>(
    async (params, logContext) => {
      addSessionDebugLog({type: 'method:start', method: 'login'})
      const signal = cancelPendingTask()
      const {bundle, account} = params.oauthSession
        ? await createOAuthSessionBundleAndLogin(params.oauthSession)
        : await createSessionBundleAndLogin(params, onSessionChange)

      if (signal.aborted) {
        // The factory returns an armed bundle, so a superseded login must dispose it.
        disposeBundle(bundle)
        return
      }
      store.dispatch({
        type: 'switched-to-account',
        newBundle: bundle,
        newAccount: account,
      })
      ax.metric(
        'account:loggedIn',
        {logContext, withPassword: !params.oauthSession},
        {session: utils.accountToSessionMetadata(account)},
      )
      addSessionDebugLog({
        type: 'method:end',
        method: 'login',
        account: redactAccount(account),
      })
    },
    [ax, store, onSessionChange, cancelPendingTask],
  )

  const logoutCurrentAccount = useCallback<
    SessionApiContext['logoutCurrentAccount']
  >(
    logContext => {
      addSessionDebugLog({type: 'method:start', method: 'logout'})
      cancelPendingTask()
      const prevState = store.getState()
      store.dispatch({
        type: 'logged-out-current-account',
      })
      ax.metric(
        'account:loggedOut',
        {logContext, scope: 'current'},
        {
          session: utils.accountToSessionMetadata(
            prevState.accounts.find(
              a => a.did === prevState.currentBundleState.did,
            ),
          ),
        },
      )
      addSessionDebugLog({type: 'method:end', method: 'logout'})
      if (prevState.currentBundleState.did) {
        clearAgeAssuranceServerDataForDid({
          did: prevState.currentBundleState.did,
        })
        void clearPersistedQueryStorage(prevState.currentBundleState.did)
      }
      // reset onboarding flow on logout
      onboardingDispatch({type: 'skip'})
    },
    [ax, store, cancelPendingTask, onboardingDispatch],
  )

  const logoutEveryAccount = useCallback<
    SessionApiContext['logoutEveryAccount']
  >(
    logContext => {
      addSessionDebugLog({type: 'method:start', method: 'logout'})
      cancelPendingTask()
      const prevState = store.getState()
      store.dispatch({
        type: 'logged-out-every-account',
      })
      ax.metric(
        'account:loggedOut',
        {logContext, scope: 'every'},
        {
          session: utils.accountToSessionMetadata(
            prevState.accounts.find(
              a => a.did === prevState.currentBundleState.did,
            ),
          ),
        },
      )
      addSessionDebugLog({type: 'method:end', method: 'logout'})
      clearAgeAssuranceServerDataForAll()
      for (const account of prevState.accounts) {
        void clearPersistedQueryStorage(account.did)
      }
      // reset onboarding flow on logout
      onboardingDispatch({type: 'skip'})
    },
    [store, cancelPendingTask, onboardingDispatch, ax],
  )

  const reauthenticateAccount = useCallback<
    SessionApiContext['reauthenticateAccount']
  >(
    (account, options) => {
      const authenticate = async (props: LoginInput, signal: AbortSignal) => {
        let refreshed: SessionAccount
        if (props.oauthSession) {
          refreshed = await oauthAgentAndSessionToSessionAccountOrThrow(
            new OauthBskyAppAgent(props.oauthSession),
            props.oauthSession,
          )
        } else {
          const result = await createSessionBundleAndLogin(props, () => {})
          refreshed = result.account
          disposeBundle(result.bundle)
        }
        if (signal.aborted) throw new Error('Authentication cancelled')
        if (refreshed.did !== account.did) {
          throw new Error('Please sign in to the same account to continue')
        }
        if (
          !store.getState().accounts.some(saved => saved.did === account.did)
        ) {
          throw new Error('This account was removed while signing in')
        }
        const updated = {
          ...refreshed,
          isOauthSession: !!props.oauthSession,
          accessJwt: props.oauthSession ? undefined : refreshed.accessJwt,
          refreshJwt: props.oauthSession ? undefined : refreshed.refreshJwt,
        }
        store.dispatch({type: 'updated-stored-account', account: updated})
        return updated
      }
      if (options?.directOAuth) {
        const scope = options.scope ?? getOAuthScope()
        const authorization = IS_WEB
          ? getWebOAuthClient().signIn(account.did, {
              scope,
              display: getWebOAuthDisplay(),
            })
          : signInNative(account.did, {scope})
        return authorization.then(oauthSession =>
          authenticate(
            {service: '', identifier: '', password: '', oauthSession},
            new AbortController().signal,
          ),
        )
      }
      return openEphemeralLogin(account, authenticate, options)
    },
    [store],
  )

  const resumeSession = useCallback<SessionApiContext['resumeSession']>(
    async (storedAccount, isSwitchingAccounts = false) => {
      addSessionDebugLog({
        type: 'method:start',
        method: 'resumeSession',
        account: redactAccount(storedAccount),
      })
      if (IS_WEB && isSwitchingAccounts && storedAccount.isOauthSession) {
        const {ensureAppViewAccess} = await import('./oauth-appview-switch')
        if (!(await ensureAppViewAccess(storedAccount.did))) {
          storedAccount = await reauthenticateAccount(storedAccount, {
            allowAppServerSwitch: true,
          })
        }
      }
      if (
        isSwitchingAccounts &&
        !storedAccount.isOauthSession &&
        !storedAccount.refreshJwt
      ) {
        storedAccount = await reauthenticateAccount(storedAccount, {
          allowAppServerSwitch: true,
        })
      }
      const signal = cancelPendingTask()
      const restore = () =>
        storedAccount.isOauthSession
          ? createOAuthSessionBundleAndResume(storedAccount)
          : createSessionBundleAndResume(storedAccount, onSessionChange)
      let restored: Awaited<ReturnType<typeof restore>>
      try {
        restored = await restore()
      } catch (error) {
        if (
          signal.aborted ||
          !isSwitchingAccounts ||
          !isEphemeralAuthError(error)
        ) {
          throw error
        }
        storedAccount = await reauthenticateAccount(storedAccount, {
          allowAppServerSwitch: true,
        })
        if (signal.aborted) return
        restored = await restore()
      }
      const {bundle, account} = restored

      if (signal.aborted) {
        // The factory returns an armed bundle, so a superseded resume must dispose it.
        disposeBundle(bundle)
        return
      }
      /*
       * A cross-tab logout may clear or remove the account while resume is in
       * flight. Check the account entry rather than the current did so ordinary
       * account switching remains valid.
       */
      const latest = store.getState()
      const latestEntry = latest.accounts.find(a => a.did === account.did)
      if (
        !latestEntry ||
        (!latestEntry.isOauthSession && !latestEntry.refreshJwt)
      ) {
        disposeBundle(bundle)
        return
      }
      store.dispatch({
        type: 'switched-to-account',
        newBundle: bundle,
        newAccount: account,
      })
      addSessionDebugLog({
        type: 'method:end',
        method: 'resumeSession',
        account: redactAccount(account),
      })
      if (isSwitchingAccounts) {
        // reset onboarding flow on switch account
        onboardingDispatch({type: 'skip'})
      }
    },
    [
      store,
      onSessionChange,
      cancelPendingTask,
      onboardingDispatch,
      reauthenticateAccount,
    ],
  )

  const partialRefreshSession = useCallback<
    SessionApiContext['partialRefreshSession']
  >(async () => {
    /*
     * Read the live bundle rather than the one captured by this render: a
     * dispatch that lands before the next render would otherwise leave this
     * holding a disposed bundle, whose clients dispatch through a disabled
     * fetch.
     */
    const bundle = store.getState().currentBundleState
      .bundle as unknown as ActiveSessionBundle
    /* getSession targets the PDS; only the persisted account fields are patched. */
    const data = await bundle.pdsClient.call(com.atproto.server.getSession, {})
    // A background email check must not cancel an in-flight login or server switch.
    if (
      (store.getState().currentBundleState.bundle as unknown) !==
      (bundle as unknown)
    )
      return
    store.dispatch({
      type: 'partial-refresh-session',
      /*
       * Read the did off the response rather than the session: the bundle may
       * have been disposed while the request was in flight, and the live
       * getters throw in that state.
       */
      accountDid: data.did,
      patch: {
        emailConfirmed: data.emailConfirmed,
        emailAuthFactor: data.emailAuthFactor,
      },
    })
  }, [store])

  /**
   * Rotate the session's tokens and hand back the resulting account snapshot.
   *
   * Rejects when the rotation was a no-op, restoring the contract the
   * `agent.resumeSession(agent.session!)` call sites were written against.
   * `PasswordSession.refresh()` resolves with the
   * unchanged `SessionData` on a transient failure - a 500 or a network error
   * reported through `onUpdateFailure` - and reserves rejection for a
   * definitively dead session. Callers here all read resolution as "tokens
   * rotated": the verification dialogs close, `Deactivated` clears its error
   * state, and `SignupQueued` re-checks the token scope, so a resolved no-op
   * would report success or loop silently. Identity, not a field comparison, is
   * the signal: `PasswordSession` allocates a new object per successful
   * rotation and returns the existing one untouched otherwise. Capturing the
   * data immediately before the call also handles concurrent refreshes, since a
   * rotation another caller's queued refresh performed still differs from what
   * we captured.
   *
   * Like {@link partialRefreshSession}, the bundle comes from
   * `store.getState()` rather than the render's `state`: a dispatch landing
   * before the next render would otherwise leave this holding a disposed
   * bundle, and reading live also keeps the callback's identity stable across
   * unrelated state updates.
   */
  const refreshSession = useCallback<
    SessionApiContext['refreshSession']
  >(async () => {
    const bundle = store.getState().currentBundleState.bundle as unknown as
      ActiveSessionBundle | PublicSessionBundle
    if (!bundle.session) return undefined // logged out: nothing to refresh
    const before = bundle.session.session
    const after = await bundle.session.refresh()
    if (after === before) {
      throw new Error('Failed to refresh session')
    }
    /*
     * The user may have logged out or switched accounts while the refresh was
     * in flight. Reporting success then would run the caller's success path
     * (dialogs closing, success toasts, SignupQueued advancing) against an
     * account that is no longer active, so a stale bundle rejects instead.
     */
    if (
      (store.getState().currentBundleState.bundle as unknown) !==
      (bundle as unknown)
    ) {
      throw new Error('The session changed while it was being refreshed')
    }
    /*
     * The session's `onUpdated` hook dispatches the new tokens into the store,
     * but that lands a render away; this snapshot exposes them immediately.
     */
    return sessionDataToSessionAccount(after, after.service)
  }, [store])

  const createEphemeralAgent = useCallback<
    SessionApiContext['createEphemeralAgent']
  >(
    async storedAccount => {
      storedAccount =
        store.getState().accounts.find(a => a.did === storedAccount.did) ??
        storedAccount
      if (storedAccount.isOauthSession) {
        try {
          const {agent} = await oauthResumeSession(storedAccount, false)
          return agent as unknown as AtpAgent
        } catch {
          const {agent} = await oauthResumeSession(storedAccount, 'auto')
          return agent as unknown as AtpAgent
        }
      }
      const {agent} = await createAgentAndResume(
        storedAccount,
        ephemeralAgent => {
          const refreshedAccount = agentToSessionAccount(ephemeralAgent)
          if (refreshedAccount) {
            store.dispatch({
              type: 'updated-stored-account',
              account: refreshedAccount,
            })
          }
        },
      )
      return agent
    },
    [store],
  )

  const removeAccount = useCallback<SessionApiContext['removeAccount']>(
    account => {
      addSessionDebugLog({
        type: 'method:start',
        method: 'removeAccount',
        account: redactAccount(account),
      })
      cancelPendingTask()
      store.dispatch({
        type: 'removed-account',
        accountDid: account.did,
      })
      addSessionDebugLog({
        type: 'method:end',
        method: 'removeAccount',
        account: redactAccount(account),
      })
      clearAgeAssuranceServerDataForDid({did: account.did})
      void clearPersistedQueryStorage(account.did)
    },
    [store, cancelPendingTask],
  )
  const reorderAccounts = useCallback<SessionApiContext['reorderAccounts']>(
    accounts => {
      store.dispatch({
        type: 'reordered-accounts',
        accounts,
      })
    },
    [store],
  )
  useEffect(() => {
    let syncGeneration = 0
    const syncSession = (nextSession: PersistedSchema['session']) => {
      const generation = ++syncGeneration
      const before = store.getState()
      const synced = nextSession
      addSessionDebugLog({
        type: 'persisted:receive',
        data: redactPersistedSession(synced),
      })
      store.dispatch({
        type: 'synced-accounts',
        syncedAccounts: synced.accounts,
        syncedCurrentDid: synced.currentAccount?.did,
      })
      const syncedAccount = synced.accounts.find(
        a => a.did === synced.currentAccount?.did,
      )
      /*
       * Cancel pending work when another tab logs out the account this tab
       * considers current. Do not cancel unrelated work between logged-out tabs.
       */
      const syncedDid =
        syncedAccount?.refreshJwt || syncedAccount?.isOauthSession
          ? syncedAccount.did
          : undefined
      if (
        syncedDid === undefined &&
        before.currentBundleState.did !== undefined
      ) {
        cancelPendingTask()
      }
      if (syncedAccount?.isOauthSession) {
        const expectedBundle = store.getState().currentBundleState.bundle
        // Restoring a follower must neither cancel an interactive login nor
        // broadcast its temporarily empty bundle back as a logout.
        void createOAuthSessionBundleAndResume(syncedAccount).then(
          ({bundle, account}) => {
            if (
              generation !== syncGeneration ||
              store.getState().currentBundleState.bundle !== expectedBundle
            ) {
              disposeBundle(bundle)
              return
            }
            store.dispatch({
              type: 'replaced-current-bundle',
              newBundle: bundle,
              newAccount: account,
            })
          },
          () => {
            // A failed restore must not delete the session another tab owns.
          },
        )
        return
      }
      if (syncedAccount && syncedAccount.refreshJwt) {
        if (syncedAccount.did !== before.currentBundleState.did) {
          // The leader refreshes before broadcasting, so followers receive fresh tokens.
          void resumeSession(syncedAccount)
        } else {
          /*
           * PasswordSession cannot be patched in place. Rebuild from the tokens
           * the leader already refreshed, then dispose the previous bundle.
           */
          const prevBundle = before.currentBundleState.bundle as unknown as
            ActiveSessionBundle | PublicSessionBundle
          // Avoid replacing the live bundle for an unrelated account update.
          const live =
            prevBundle.session && !prevBundle.session.destroyed
              ? prevBundle.session.session
              : undefined
          if (
            live &&
            live.accessJwt === syncedAccount.accessJwt &&
            live.refreshJwt === syncedAccount.refreshJwt
          ) {
            return
          }
          const rebuilt = createSessionBundleFromStoredAccount(
            syncedAccount,
            onSessionChange,
            newBundle => {
              const current = store.getState()
              const latestAccount = current.accounts.find(
                account => account.did === syncedAccount.did,
              )
              const isCurrent =
                current.currentBundleState.bundle === prevBundle &&
                latestAccount?.accessJwt === syncedAccount.accessJwt &&
                latestAccount?.refreshJwt === syncedAccount.refreshJwt
              if (isCurrent) {
                addSessionDebugLog({
                  type: 'bundle:patch',
                  bundleId: getBundleId(newBundle),
                  prevSession: redactSessionData(
                    prevBundle.session && !prevBundle.session.destroyed
                      ? prevBundle.session.session
                      : undefined,
                  ),
                  nextSession: redactSessionData(newBundle.session.session),
                })
              }
              return isCurrent
            },
          )
          if (!rebuilt) {
            return
          }
          const {bundle: newBundle, account: newAccount} = rebuilt
          store.dispatch({
            type: 'replaced-current-bundle',
            newBundle,
            newAccount,
          })
        }
      }
    }
    const unsubscribe = persisted.onUpdate('session', nextSession => {
      /*
       * Web persistence notifies this tab synchronously during write(). The
       * store already applied that update, while PasswordSession's onUpdated
       * hook has not yet committed its new tokens to the live session. Treating
       * our own write as a remote update would replace and kill that session.
       */
      if (!store.isPersisting()) {
        syncSession(nextSession)
      }
    })
    // AppView selection can change while the saved account itself is identical.
    // Defer until both the DID and URL have been written by the callback.
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener = device.addOnValueChangedListener(
      ['customAppViewDid'],
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => syncSession(persisted.get('session')), 0)
      },
    )
    return () => {
      ++syncGeneration
      clearTimeout(timer)
      listener.remove()
      unsubscribe()
    }
  }, [store, resumeSession, onSessionChange, cancelPendingTask])

  const stateContext = useMemo(
    () => ({
      accounts: state.accounts,
      currentAccount: state.accounts.find(
        a => a.did === state.currentBundleState.did,
      ),
      hasSession: !!state.currentBundleState.did,
    }),
    [state],
  )

  const api = useMemo(
    () => ({
      createAccount,
      login,
      logoutCurrentAccount,
      logoutEveryAccount,
      resumeSession,
      removeAccount,
      reorderAccounts,
      partialRefreshSession,
      refreshSession,
      createEphemeralAgent,
      reauthenticateAccount,
    }),
    [
      createAccount,
      login,
      logoutCurrentAccount,
      logoutEveryAccount,
      resumeSession,
      removeAccount,
      reorderAccounts,
      partialRefreshSession,
      refreshSession,
      createEphemeralAgent,
      reauthenticateAccount,
    ],
  )

  const bundle = state.currentBundleState.bundle as unknown as
    ActiveSessionBundle | PublicSessionBundle

  useEffect(() => {
    if (!__DEV__ || !IS_WEB) return
    // @ts-expect-error window type is not declared, debug only
    window.bundle = bundle
  }, [bundle])

  const currentBundleRef = useRef(bundle)
  /*
   * Disposal is deferred to this post-commit effect deliberately: components may
   * still render against the outgoing bundle during the commit that swaps it, so
   * disabling its session inline would pull the transport out from under them.
   * The reducer's bundle-identity guard drops any events the not-yet-disposed
   * session emits in that window.
   */
  useEffect(() => {
    if (currentBundleRef.current !== bundle) {
      const prevBundle = currentBundleRef.current
      currentBundleRef.current = bundle
      addSessionDebugLog({
        type: 'bundle:switch',
        prevBundleId: getBundleId(prevBundle),
        nextBundleId: getBundleId(bundle),
      })
      // Replaced bundles must never consume another refresh token.
      disposeBundle(prevBundle)
    }
  }, [bundle])

  return (
    <BundleContext.Provider value={bundle}>
      <StateContext.Provider value={stateContext}>
        <ApiContext.Provider value={api}>
          <AnalyticsContext
            metadata={utils.useMeta({
              session: utils.accountToSessionMetadata(
                stateContext.currentAccount,
              ),
            })}>
            {children}
          </AnalyticsContext>
        </ApiContext.Provider>
      </StateContext.Provider>
    </BundleContext.Provider>
  )
}

function useOneTaskAtATime() {
  const abortController = useRef<AbortController | null>(null)
  const cancelPendingTask = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()
    return abortController.current.signal
  }, [])
  return cancelPendingTask
}

export function useSession() {
  return useContext(StateContext)
}

export function useSessionApi() {
  return useContext(ApiContext)
}

/**
 * Compatibility surface for Witchsky features that still use the legacy
 * `@atproto/api` agent. Requests share the active PasswordSession, so token
 * refresh and logout remain owned by the upstream session bundle rather than
 * a second credential manager.
 */
export function useAgent(): AtpAgent {
  const bundle = useContext(BundleContext)
  if (!bundle) {
    throw Error('useAgent() must be below <SessionProvider>.')
  }

  return useMemo(() => {
    if ('oauthAgent' in bundle) {
      return bundle.oauthAgent as unknown as AtpAgent
    }

    if (!bundle.session) {
      return createPublicAgent()
    }

    const agent = new LegacyAgent(null, bundle.session)
    return agent as unknown as AtpAgent
  }, [bundle])
}

export function useRequireAuth() {
  const {hasSession} = useSession()
  const closeAll = useCloseAllActiveElements()
  const {signinDialogControl} = useGlobalDialogsControlContext()

  return useCallback(
    (fn: () => unknown) => {
      if (hasSession) {
        fn()
      } else {
        closeAll()
        signinDialogControl.open()
      }
    },
    [hasSession, signinDialogControl, closeAll],
  )
}

/**
 * Client for appview reads. Logged out, this is the bundle's public client,
 * which dispatches unauthenticated against the public appview.
 */
export function useAppviewClient(): Client {
  const bundle = useContext(BundleContext)
  if (!bundle) {
    throw Error('useAppviewClient() must be below <SessionProvider>.')
  }
  return bundle.appviewClient
}

/**
 * Client for account-host requests. It shares the active session's auth
 * lifecycle but sets no proxy or labeler headers, so calls target the PDS.
 * Logged out, calls throw `NotAuthenticatedError` before network I/O. Use
 * {@link useMaybePdsClient} when the caller must branch on authentication.
 */
export function usePdsClient(): Client {
  const bundle = useContext(BundleContext)
  if (!bundle) {
    throw Error('usePdsClient() must be below <SessionProvider>.')
  }
  return bundle.pdsClient
}

/**
 * Client for `chat.bsky.*` calls. Logged-out calls throw
 * `NotAuthenticatedError`; use {@link useMaybeChatClient} to branch on auth.
 */
export function useChatClient(): Client {
  const bundle = useContext(BundleContext)
  if (!bundle) {
    throw Error('useChatClient() must be below <SessionProvider>.')
  }
  return bundle.chatClient
}

/**
 * Account-host client for the active session, or `null` when logged out.
 */
export function useMaybePdsClient(): Client | null {
  const bundle = useContext(BundleContext)
  return bundle?.session ? bundle.pdsClient : null
}

/**
 * Chat client for the active session, or `null` when logged out.
 */
export function useMaybeChatClient(): Client | null {
  const bundle = useContext(BundleContext)
  return bundle?.session ? bundle.chatClient : null
}

/**
 * The unauthenticated client for public appview reads.
 */
export function usePublicAppviewClient(): Client {
  return getPublicAppviewClient()
}
