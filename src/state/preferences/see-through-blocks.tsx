import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['seeThroughBlocks']
type SetContext = (v: persisted.Schema['seeThroughBlocks']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.seeThroughBlocks,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['seeThroughBlocks']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('seeThroughBlocks'))

  const setStateWrapped = useCallback(
    (seeThroughBlocks: persisted.Schema['seeThroughBlocks']) => {
      setState(seeThroughBlocks)
      void persisted.write('seeThroughBlocks', seeThroughBlocks)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('seeThroughBlocks', nextSeeThroughBlocks => {
      setState(nextSeeThroughBlocks)
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

export function useSeeThroughBlocks() {
  return useContext(stateContext)
}

export function useSetSeeThroughBlocks() {
  return useContext(setContext)
}
