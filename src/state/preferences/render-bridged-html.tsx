import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['renderBridgedHtml']
type SetContext = (v: persisted.Schema['renderBridgedHtml']) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.renderBridgedHtml,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['renderBridgedHtml']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('renderBridgedHtml'))

  const setStateWrapped = useCallback(
    (renderBridgedHtml: persisted.Schema['renderBridgedHtml']) => {
      setState(renderBridgedHtml)
      void persisted.write('renderBridgedHtml', renderBridgedHtml)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('renderBridgedHtml', nextRenderBridgedHtml => {
      setState(nextRenderBridgedHtml)
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

export function useRenderBridgedHtml() {
  return useContext(stateContext)
}

export function useSetRenderBridgedHtml() {
  return useContext(setContext)
}
