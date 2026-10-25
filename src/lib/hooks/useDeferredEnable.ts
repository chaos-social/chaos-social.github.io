import {useEffect, useState} from 'react'

/**
 * Delays enabling a query until after animations/interactions settle.
 * Keeps fork-specific network work off the cold render/scroll path without
 * restructuring upstream UI components.
 */
export function useDeferredEnable(enabled: boolean): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setReady(false)
      return
    }

    let cancelled = false
    const handle = requestIdleCallback(() => {
      if (!cancelled) {
        setReady(true)
      }
    })

    return () => {
      cancelled = true
      cancelIdleCallback(handle)
    }
  }, [enabled])

  return enabled && ready
}
