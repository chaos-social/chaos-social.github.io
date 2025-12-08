import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['hideUnreplyablePosts']
type SetContext = (v: persisted.Schema['hideUnreplyablePosts']) => void

const stateContext = React.createContext<StateContext>(
  persisted.defaults.hideUnreplyablePosts,
)
const setContext = React.createContext<SetContext>(
  (_: persisted.Schema['hideUnreplyablePosts']) => {},
)

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState(
    persisted.get('hideUnreplyablePosts'),
  )

  const setStateWrapped = React.useCallback(
    (hideUnreplyablePosts: persisted.Schema['hideUnreplyablePosts']) => {
      setState(hideUnreplyablePosts)
      persisted.write('hideUnreplyablePosts', hideUnreplyablePosts)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('hideUnreplyablePosts', nextValue => {
      setState(nextValue)
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

export function useHideUnreplyablePosts() {
  return (
    React.useContext(stateContext) ?? persisted.defaults.hideUnreplyablePosts
  )
}

export function useSetHideUnreplyablePosts() {
  return React.useContext(setContext)
}
