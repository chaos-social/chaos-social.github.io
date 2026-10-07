import {StyleSheet, View} from 'react-native'
import {render} from '@testing-library/react-native'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'

jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: jest.fn(() => 'sharp'),
}))
jest.mock('#/alf', () => ({
  atoms: {rounded_md: {borderRadius: 8}},
  platform: ({native}: {native: unknown}) => native,
  useTheme: () => ({name: 'dark', atoms: {}}),
}))
jest.mock('#/env', () => ({IS_HIGH_DPI: false}))

function getBorderStyle(style?: React.ComponentProps<typeof View>['style']) {
  const {UNSAFE_getByType} = render(<MediaInsetBorder style={style} />)
  return StyleSheet.flatten(
    (UNSAFE_getByType(View).props as React.ComponentProps<typeof View>).style,
  )
}

it('removes the default rounding from media borders in sharp mode', () => {
  expect(getBorderStyle()?.borderRadius).toBe(0)
})

it('lets avatar borders keep their independently selected corners', () => {
  const style = getBorderStyle({borderRadius: 20})
  expect(style?.borderRadius).toBe(20)
  for (const key of Object.keys(SHARP_CORNERS)) {
    if (key !== 'borderRadius') {
      expect(style?.[key as keyof typeof SHARP_CORNERS]).toBeUndefined()
    }
  }
})

it('preserves default media rounding outside sharp mode', () => {
  jest.mocked(useEnableSquareButtons).mockReturnValue(true)
  expect(getBorderStyle()?.borderRadius).toBe(8)
})
