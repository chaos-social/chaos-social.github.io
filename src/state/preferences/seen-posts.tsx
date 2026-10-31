import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import * as persisted from '#/state/persisted'
import * as seenPosts from '#/state/seen-posts'

type StateContext = {enabled: boolean; ready: boolean}
type SetContext = (v: persisted.Schema['seenPostsEnabled']) => void

const stateContext = createContext<StateContext>({
  enabled: false,
  ready: false,
})
const setContext = createContext<SetContext>(
  (_: persisted.Schema['seenPostsEnabled']) => {},
)

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState(persisted.get('seenPostsEnabled'))
  const [ready, setReady] = useState(false)

  const setStateWrapped = useCallback(
    (seenPostsEnabled: persisted.Schema['seenPostsEnabled']) => {
      setState(seenPostsEnabled)
      void persisted.write('seenPostsEnabled', seenPostsEnabled)
    },
    [setState],
  )

  useEffect(() => {
    return persisted.onUpdate('seenPostsEnabled', nextValue => {
      setState(nextValue)
    })
  }, [setStateWrapped])

  // Feeds only filter once history is in memory, so they re-filter after load.
  useEffect(() => {
    if (state) void seenPosts.load().then(() => setReady(true))
  }, [state])

  return (
    <stateContext.Provider value={{enabled: !!state, ready}}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

/** Whether seen posts are tracked and hidden. False until history loads. */
export function useSeenPostsEnabled() {
  const {enabled, ready} = useContext(stateContext)
  return enabled && ready
}

/** The raw setting, for the settings toggle. */
export function useSeenPostsSetting() {
  return useContext(stateContext).enabled
}

export function useSetSeenPostsEnabled() {
  return useContext(setContext)
}
