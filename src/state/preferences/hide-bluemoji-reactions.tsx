import {createContext, useContext, useEffect, useState} from 'react'

import * as persisted from '#/state/persisted'

const stateContext = createContext(false)
const setContext = createContext<(value: boolean) => void>(() => {})

export function Provider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState(
    persisted.get('hideBluemojiReactions') ?? false,
  )

  function update(value: boolean) {
    setState(value)
    void persisted.write('hideBluemojiReactions', value)
  }

  useEffect(() => {
    return persisted.onUpdate('hideBluemojiReactions', value => {
      setState(value ?? false)
    })
  }, [])

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={update}>{children}</setContext.Provider>
    </stateContext.Provider>
  )
}

export function useHideBluemojiReactions() {
  return useContext(stateContext)
}

export function useSetHideBluemojiReactions() {
  return useContext(setContext)
}
