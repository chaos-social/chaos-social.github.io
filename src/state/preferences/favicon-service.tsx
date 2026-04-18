import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['faviconService']
type SetContext = (v: persisted.Schema['faviconService']) => void

const stateContext = React.createContext<StateContext>(
  persisted.defaults.faviconService,
)
const setContext = React.createContext<SetContext>(
  (_: persisted.Schema['faviconService']) => {},
)

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState(persisted.get('faviconService'))

  const setStateWrapped = React.useCallback(
    (faviconService: persisted.Schema['faviconService']) => {
      setState(faviconService)
      persisted.write('faviconService', faviconService)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('faviconService', next => {
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

export function useFaviconService() {
  return React.useContext(stateContext) ?? persisted.defaults.faviconService
}

export function useSetFaviconService() {
  const setFaviconService = React.useContext(setContext)
  return setFaviconService
}
