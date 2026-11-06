import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'

const stateContext = createContext(true)
const setContext = createContext<(value: boolean) => void>(() => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState(
    persisted.get('showThreadPostNumbers') ?? true,
  )

  function setStateWrapped(value: boolean) {
    setState(value)
    void persisted.write('showThreadPostNumbers', value)
  }

  useEffect(() => {
    return persisted.onUpdate('showThreadPostNumbers', value => {
      setState(value ?? true)
    })
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

/**
 * Whether posts show a numbered badge (1/2, 2/2, ...) inside the text when
 * they are part of a thread by the same author. Enabled by default.
 */
export function useShowThreadPostNumbers() {
  return useContext(stateContext)
}

export function useSetShowThreadPostNumbers() {
  return useContext(setContext)
}
