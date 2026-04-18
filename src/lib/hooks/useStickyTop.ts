// sticky headers need top offset for safe area on iOS PWA
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {atoms as a, web} from '#/alf'

export function useStickyTop() {
  const {top} = useSafeAreaInsets()
  return web([a.sticky, {top}, a.z_10])
}
