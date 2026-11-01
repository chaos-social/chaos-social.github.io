import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'

const stateContext = createContext(false)
const setContext = createContext<(value: boolean) => void>(() => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState(persisted.get('deckLayoutEnabled') ?? false)

  function setPreference(value: boolean) {
    setState(value)
    void persisted.write('deckLayoutEnabled', value)
  }

  useEffect(() => {
    return persisted.onUpdate('deckLayoutEnabled', value => {
      setState(value ?? false)
    })
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setPreference}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

/** Whether Home renders one column per pinned feed, with the deck shell. */
export function useDeckLayoutEnabled() {
  return useContext(stateContext)
}

export function useSetDeckLayoutEnabled() {
  return useContext(setContext)
}
