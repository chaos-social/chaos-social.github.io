import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['tokimekiInstance']
type SetContext = (v: persisted.Schema['tokimekiInstance']) => void
type CustomStateContext = persisted.Schema['tokimekiInstanceCustom']
type SetCustomContext = (v: persisted.Schema['tokimekiInstanceCustom']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.tokimekiInstance,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['tokimekiInstance']) => {},
)
const customStateContext = createContext<CustomStateContext>(undefined)
const setCustomContext = createContext<SetCustomContext>(
  (_: persisted.Schema['tokimekiInstanceCustom']) => {},
)

function normalizeOrigin(input: string) {
  try {
    return new URL(input).origin
  } catch {
    return null
  }
}

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('tokimekiInstance'))
  const [customState, setCustomState] = useState(
    persisted.get('tokimekiInstanceCustom'),
  )

  const setStateWrapped = useCallback(
    (tokimekiInstance: persisted.Schema['tokimekiInstance']) => {
      setState(tokimekiInstance)
      void persisted.write('tokimekiInstance', tokimekiInstance)
    },
    [],
  )

  const setCustomStateWrapped = useCallback(
    (tokimekiInstanceCustom: persisted.Schema['tokimekiInstanceCustom']) => {
      setCustomState(tokimekiInstanceCustom)
      void persisted.write('tokimekiInstanceCustom', tokimekiInstanceCustom)
    },
    [],
  )

  useEffect(
    () => persisted.onUpdate('tokimekiInstance', next => setState(next)),
    [],
  )

  useEffect(
    () =>
      persisted.onUpdate('tokimekiInstanceCustom', next =>
        setCustomState(next),
      ),
    [],
  )

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        <customStateContext.Provider value={customState}>
          <setCustomContext.Provider value={setCustomStateWrapped}>
            {children}
          </setCustomContext.Provider>
        </customStateContext.Provider>
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useTokimekiInstanceSetting() {
  return useContext(stateContext)
}

export function useTokimekiInstanceCustom() {
  return useContext(customStateContext)
}

/**
 * Did document of the TOKIMEKI AppView, in the `did#service` form the
 * `atproto-proxy` header takes. Read reactively so a settings change re-routes
 * and re-fetches bookmark lists.
 */
export function useTokimekiProxyService() {
  const instance =
    useContext(stateContext) ?? persisted.defaults.tokimekiInstance!
  return toProxyService(instance)
}

/**
 * Non-reactive read, for module-level helpers and query functions that do not
 * run inside a component.
 */
export function readTokimekiProxyService() {
  return toProxyService(
    persisted.get('tokimekiInstance') ?? persisted.defaults.tokimekiInstance!,
  )
}

/**
 * The proxy target keeps TOKIMEKI's published service id (`#tokimeki_api`) and
 * swaps only the host, so a self-hosted AppView is addressed the same way as
 * theirs.
 */
function toProxyService(instance: string) {
  const origin = normalizeOrigin(instance)
  const host = origin ? new URL(origin).host : 'api.tokimeki.tech'
  return `did:web:${host}#tokimeki_api` as const
}

export function useSetTokimekiInstance() {
  return useContext(setContext)
}

export function useSetTokimekiInstanceCustom() {
  return useContext(setCustomContext)
}
