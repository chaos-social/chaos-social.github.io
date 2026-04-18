// measure safe area insets via getBoundingClientRect() on elements
// with height: env(safe-area-inset-*). Safari WebKit returns 0 for env() via
// getComputedStyle() in standalone PWA mode, but CSS rendering works — so we
// create elements sized by env() and measure their rendered dimensions.
//
// Usage: wrap children of SafeAreaProvider with <SafeAreaOverride> to replace
// the broken insets with our measured values.

import {type PropsWithChildren, useEffect, useState} from 'react'
import {type EdgeInsets} from 'react-native-safe-area-context'

// Access the context — exported as SafeAreaContext (alias for SafeAreaInsetsContext)
const {SafeAreaContext} = require('react-native-safe-area-context')

function createMeasureEl(id: string, heightEnv: string): HTMLElement {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('div')
    el.id = id
    el.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:1px',
      'visibility:hidden',
      'pointer-events:none',
      `height:${heightEnv}`,
    ].join(';')
    document.documentElement.appendChild(el)
  }
  return el
}

function measure(): EdgeInsets {
  if (typeof document === 'undefined') {
    return {top: 0, bottom: 0, left: 0, right: 0}
  }

  const topEl = createMeasureEl(
    'safe-area-measure-top',
    'env(safe-area-inset-top, 0px)',
  )
  const bottomEl = createMeasureEl(
    'safe-area-measure-bottom',
    'env(safe-area-inset-bottom, 0px)',
  )

  return {
    top: topEl.getBoundingClientRect().height,
    bottom: bottomEl.getBoundingClientRect().height,
    left: 0,
    right: 0,
  }
}

export function SafeAreaOverride({children}: PropsWithChildren) {
  const [insets, setInsets] = useState<EdgeInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  })

  useEffect(() => {
    // Measure after mount + a frame to ensure CSS env() has been resolved
    requestAnimationFrame(() => {
      setInsets(measure())
    })
  }, [])

  const Provider = SafeAreaContext.Provider
  return <Provider value={insets}>{children}</Provider>
}
