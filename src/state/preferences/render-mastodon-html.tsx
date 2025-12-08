import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = persisted.Schema['renderMastodonHtml']
type SetContext = (v: persisted.Schema['renderMastodonHtml']) => void

const stateContext = React.createContext<StateContext>(
  persisted.defaults.renderMastodonHtml,
)
const setContext = React.createContext<SetContext>(
  (_: persisted.Schema['renderMastodonHtml']) => {},
)

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState(persisted.get('renderMastodonHtml'))

  const setStateWrapped = React.useCallback(
    (renderMastodonHtml: persisted.Schema['renderMastodonHtml']) => {
      setState(renderMastodonHtml)
      persisted.write('renderMastodonHtml', renderMastodonHtml)
    },
    [setState],
  )

  React.useEffect(() => {
    return persisted.onUpdate('renderMastodonHtml', nextValue => {
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

export function useRenderMastodonHtml() {
  return (
    React.useContext(stateContext) ?? persisted.defaults.renderMastodonHtml
  )
}

export function useSetRenderMastodonHtml() {
  return React.useContext(setContext)
}
