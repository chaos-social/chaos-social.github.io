import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

/** Shape preference: false is circular, true is rounded, and sharp has no rounding. */

type StateContext = persisted.Schema['enableSquareAvatars']
type SetContext = (v: persisted.Schema['enableSquareAvatars']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.enableSquareAvatars,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['enableSquareAvatars']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('enableSquareAvatars'))

  const setStateWrapped = useCallback(
    (value: persisted.Schema['enableSquareAvatars']) => {
      setState(value)
      void persisted.write('enableSquareAvatars', value)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('enableSquareAvatars', next => {
      setState(next)
    })
  }, [setStateWrapped])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useEnableSquareAvatars() {
  return useContext(stateContext)
}

export function useSetEnableSquareAvatars() {
  return useContext(setContext)
}
