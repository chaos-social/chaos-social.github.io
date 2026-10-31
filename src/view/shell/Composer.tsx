import {useEffect} from 'react'
import {SystemBars} from 'react-native-edge-to-edge'
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated'

import {useComposerState} from '#/state/shell/composer'
import {ComposePost} from '#/view/com/composer/Composer'
import {atoms as a, useTheme} from '#/alf'

export function Composer() {
  const state = useComposerState()
  const t = useTheme()

  const open = !!state && !state.isMinimized

  useEffect(() => {
    if (open) {
      const entry = SystemBars.pushStackEntry({
        style: {
          statusBar: t.name !== 'light' ? 'light' : 'dark',
        },
      })
      return () => SystemBars.popStackEntry(entry)
    }
  }, [open, t.name])

  if (!state) {
    return null
  }

  return (
    <ComposePost
      {...state}
      renderPresentation={children =>
        open ? (
          <Animated.View
            style={[a.absolute, a.inset_0, t.atoms.bg]}
            entering={SlideInDown.duration(300).easing(Easing.out(Easing.exp))}
            exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.quad))}
            aria-modal
            accessibilityViewIsModal>
            {children}
          </Animated.View>
        ) : null
      }
    />
  )
}
