import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['bluemojiInstance']
type SetContext = (v: persisted.Schema['bluemojiInstance']) => void
type CustomStateContext = persisted.Schema['bluemojiInstanceCustom']
type SetCustomContext = (v: persisted.Schema['bluemojiInstanceCustom']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.bluemojiInstance,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['bluemojiInstance']) => {},
)
const customStateContext = createContext<CustomStateContext>(undefined)
const setCustomContext = createContext<SetCustomContext>(
  (_: persisted.Schema['bluemojiInstanceCustom']) => {},
)

function normalizeOrigin(input: string) {
  try {
    return new URL(input).origin
  } catch {
    return null
  }
}

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('bluemojiInstance'))
  const [customState, setCustomState] = useState(
    persisted.get('bluemojiInstanceCustom'),
  )

  const setStateWrapped = useCallback(
    (bluemojiInstance: persisted.Schema['bluemojiInstance']) => {
      setState(bluemojiInstance)
      void persisted.write('bluemojiInstance', bluemojiInstance)
    },
    [],
  )

  const setCustomStateWrapped = useCallback(
    (bluemojiInstanceCustom: persisted.Schema['bluemojiInstanceCustom']) => {
      setCustomState(bluemojiInstanceCustom)
      void persisted.write('bluemojiInstanceCustom', bluemojiInstanceCustom)
    },
    [],
  )

  useEffect(
    () => persisted.onUpdate('bluemojiInstance', next => setState(next)),
    [],
  )

  useEffect(
    () =>
      persisted.onUpdate('bluemojiInstanceCustom', next =>
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

export function useBluemojiInstanceSetting() {
  return useContext(stateContext)
}

export function useBluemojiInstanceCustom() {
  return useContext(customStateContext)
}

/**
 * Origin of the Bluemoji AppView, without a trailing slash, so callers can
 * join paths onto it.
 */
export function useBluemojiInstance() {
  return (
    normalizeOrigin(
      useContext(stateContext) ?? persisted.defaults.bluemojiInstance!,
    ) ?? normalizeOrigin(persisted.defaults.bluemojiInstance!)!
  )
}

export function useSetBluemojiInstance() {
  return useContext(setContext)
}

export function useSetBluemojiInstanceCustom() {
  return useContext(setCustomContext)
}

/**
 * Non-reactive read, for code that runs outside a component (query functions
 * and module-level clients).
 */
export function readBluemojiInstance() {
  return (
    normalizeOrigin(
      persisted.get('bluemojiInstance') ?? persisted.defaults.bluemojiInstance!,
    ) ?? normalizeOrigin(persisted.defaults.bluemojiInstance!)!
  )
}
