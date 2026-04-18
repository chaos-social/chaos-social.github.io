import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['plcDirectory']
type SetContext = (v: persisted.Schema['plcDirectory']) => void

const stateContext = React.createContext<StateContext>(
  persisted.defaults.plcDirectory,
)
const setContext = React.createContext<SetContext>(
  (_: persisted.Schema['plcDirectory']) => {},
)

function normalizeOrigin(input: string) {
  try {
    return new URL(input).origin
  } catch {
    return null
  }
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState(persisted.get('plcDirectory'))

  const setStateWrapped = React.useCallback(
    (plcDirectory: persisted.Schema['plcDirectory']) => {
      setState(plcDirectory)
      persisted.write('plcDirectory', plcDirectory)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('plcDirectory', nextPlcDirectory => {
      setState(nextPlcDirectory)
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

export function usePlcDirectory() {
  return (
    normalizeOrigin(
      React.useContext(stateContext) ?? persisted.defaults.plcDirectory!,
    ) ?? persisted.defaults.plcDirectory!
  )
}

export function useSetPlcDirectory() {
  return React.useContext(setContext)
}

export function readPlcDirectory() {
  return (
    normalizeOrigin(
      persisted.get('plcDirectory') ?? persisted.defaults.plcDirectory!,
    ) ?? persisted.defaults.plcDirectory!
  )
}
