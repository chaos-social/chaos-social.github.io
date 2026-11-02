import {useEffect, useRef, useState} from 'react'
import {type View} from 'react-native'

import {createRowObserver} from '#/lib/createRowObserver'

/*
 * Games are heavy, so a game only stays mounted while its post is near the
 * viewport. Slightly tighter than the feed's 800px prefetch margin: a game
 * that is scrolling out of view has no reason to keep playing audio.
 */
const observeOnScreen = createRowObserver({rootMargin: '200px'})

/**
 * Whether an element is on screen. Elements inside a `display: none` tab are
 * never intersecting, which is what makes this also stop playback when the
 * user switches tabs - the web feed keeps every post mounted.
 */
export function useOnScreen() {
  const ref = useRef<React.ComponentRef<typeof View>>(null)
  const [isOnScreen, setIsOnScreen] = useState(false)

  useEffect(() => {
    // react-native-web hands the hook the real DOM node; the type only knows
    // React Native's element.
    const el = ref.current as unknown as Element | null
    if (!el) return
    return observeOnScreen(el, ([entry]) => setIsOnScreen(entry.isIntersecting))
  }, [])

  return {ref, isOnScreen}
}
