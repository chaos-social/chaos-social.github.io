import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['showLinkInHandleOnlyOnWorkingLinks']
type SetContext = (
  v: persisted.Schema['showLinkInHandleOnlyOnWorkingLinks'],
) => void

const stateContext = createContext<StateContext>(
  persisted.defaults.showLinkInHandleOnlyOnWorkingLinks,
)
const setContext = createContext<SetContext>(
  (_: persisted.Schema['showLinkInHandleOnlyOnWorkingLinks']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(
    persisted.get('showLinkInHandleOnlyOnWorkingLinks'),
  )

  const setStateWrapped = useCallback(
    (
      showLinkInHandleOnlyOnWorkingLinks: persisted.Schema['showLinkInHandleOnlyOnWorkingLinks'],
    ) => {
      setState(showLinkInHandleOnlyOnWorkingLinks)
      void persisted.write(
        'showLinkInHandleOnlyOnWorkingLinks',
        showLinkInHandleOnlyOnWorkingLinks,
      )
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate(
      'showLinkInHandleOnlyOnWorkingLinks',
      nextShowLinkInHandleOnlyOnWorkingLinks => {
        setState(nextShowLinkInHandleOnlyOnWorkingLinks)
      },
    )
  }, [setStateWrapped])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useShowLinkInHandleOnlyOnWorkingLinks() {
  return useContext(stateContext)
}

export function useSetShowLinkInHandleOnlyOnWorkingLinks() {
  return useContext(setContext)
}
