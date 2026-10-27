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
    const enable = () => {
      if (!cancelled) {
        setReady(true)
      }
    }

    let cancel: () => void
    if (
      typeof requestIdleCallback === 'function' &&
      typeof cancelIdleCallback === 'function'
    ) {
      const handle = requestIdleCallback(enable)
      cancel = () => cancelIdleCallback(handle)
    } else {
      // Safari does not provide idle callbacks, so yield using a timer instead.
      const handle = setTimeout(enable, 100)
      cancel = () => clearTimeout(handle)
    }

    return () => {
      cancelled = true
      cancel()
    }
  }, [enabled])

  return enabled && ready
}
