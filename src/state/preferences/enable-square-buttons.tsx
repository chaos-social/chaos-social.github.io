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

type StateContext = persisted.Schema['enableSquareButtons']
type SetContext = (v: persisted.Schema['enableSquareButtons']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.enableSquareButtons,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['enableSquareButtons']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('enableSquareButtons'))

  const setStateWrapped = useCallback(
    (value: persisted.Schema['enableSquareButtons']) => {
      setState(value)
      void persisted.write('enableSquareButtons', value)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('enableSquareButtons', next => {
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

export function useEnableSquareButtons() {
  return useContext(stateContext)
}

export function useSetEnableSquareButtons() {
  return useContext(setContext)
}
