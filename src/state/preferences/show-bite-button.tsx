import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['showBiteButton']
type SetContext = (v: persisted.Schema['showBiteButton']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.showBiteButton,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['showBiteButton']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('showBiteButton'))

  const setStateWrapped = useCallback(
    (showBiteButton: persisted.Schema['showBiteButton']) => {
      setState(showBiteButton)
      void persisted.write('showBiteButton', showBiteButton)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('showBiteButton', nextShowBiteButton => {
      setState(nextShowBiteButton)
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

export function useShowBiteButton() {
  return useContext(stateContext)
}

export function useSetShowBiteButton() {
  return useContext(setContext)
}
