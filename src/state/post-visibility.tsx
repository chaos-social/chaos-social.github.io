import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react'

import type {createPdsViewabilityStore} from './pds-viewability'

const PostVisibilityContext = createContext<ReturnType<
  typeof createPdsViewabilityStore
> | null>(null)

/**
 * Marks which posts a virtualized list has actually shown, so automatic
 * translation only spends requests on posts someone is looking at.
 */
export function PostVisibilityProvider({
  children,
  store,
}: PropsWithChildren<{store: ReturnType<typeof createPdsViewabilityStore>}>) {
  return (
    <PostVisibilityContext.Provider value={store}>
      {children}
    </PostVisibilityContext.Provider>
  )
}

/**
 * True once the list containing this post has scrolled it into view. Without
 * a provider (a quote chain, a thread outside a list) nothing is automatic:
 * nested post renderers mount many posts at once and must not each spend a
 * translation request.
 */
export function usePostVisible(uri: string): boolean {
  const store = useContext(PostVisibilityContext)
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(uri, listener) ?? (() => {}),
    [uri, store],
  )
  const getSnapshot = useCallback(
    () => store?.getPriority(uri) === 'visible',
    [uri, store],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
