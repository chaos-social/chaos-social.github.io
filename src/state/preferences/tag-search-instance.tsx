import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['tagSearchInstance']
type SetContext = (v: persisted.Schema['tagSearchInstance']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.tagSearchInstance,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['tagSearchInstance']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('tagSearchInstance'))

  const setStateWrapped = useCallback(
    (tagSearchInstance: persisted.Schema['tagSearchInstance']) => {
      setState(tagSearchInstance)
      void persisted.write('tagSearchInstance', tagSearchInstance)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('tagSearchInstance', nextInstance => {
      setState(nextInstance)
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

export function useTagSearchInstanceSetting() {
  return useContext(stateContext)
}

export function useTagSearchInstance() {
  return useContext(stateContext) ?? persisted.defaults.tagSearchInstance!
}

export function useSetTagSearchInstance() {
  return useContext(setContext)
}
