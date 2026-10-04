import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'

const stateContext = createContext(false)
const setContext = createContext<(value: boolean) => void>(() => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState(
    persisted.get('pasteToLinkEnabled') ?? false,
  )

  function setPreference(value: boolean) {
    setState(value)
    void persisted.write('pasteToLinkEnabled', value)
  }

  useEffect(() => {
    return persisted.onUpdate('pasteToLinkEnabled', value => {
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

export function usePasteToLinkEnabled() {
  return useContext(stateContext)
}

export function useSetPasteToLinkEnabled() {
  return useContext(setContext)
}
