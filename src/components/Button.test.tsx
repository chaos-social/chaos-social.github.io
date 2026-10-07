import {View} from 'react-native'
import {fireEvent, render} from '@testing-library/react-native'

import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {Button} from '#/components/Button'

jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: jest.fn(() => 'sharp'),
}))
jest.mock('#/state/shell', () => ({useThemePrefs: () => ({})}))
jest.mock('#/alf', () => ({
  atoms: {rounded_sm: {borderRadius: 4}, rounded_full: {borderRadius: 999}},
  useTheme: () => ({}),
}))
jest.mock('#/components/Typography', () => ({Text: 'Text'}))
jest.mock('#/env', () => ({IS_WEB: false, IS_WEB_TOUCH_DEVICE: false}))
jest.mock('#/features/themes/accentForeground', () => ({}))

it.each(['default', 'round', 'square', 'rectangular'] as const)(
  'keeps %s buttons sharp despite custom and hover corner styles',
  shape => {
    const {getByTestId} = render(
      <Button
        label="Test button"
        testID="button"
        size="small"
        shape={shape}
        style={{
          borderRadius: 20,
          borderTopLeftRadius: 12,
          borderEndStartRadius: 16,
          paddingLeft: 27,
        }}
        hoverStyle={{borderRadius: 30, borderBottomRightRadius: 24}}>
        <View />
      </Button>,
    )
    const expected = {
      borderRadius: 0,
      borderTopLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderEndStartRadius: 0,
      paddingLeft: 27,
    }
    expect(getByTestId('button')).toHaveStyle(expected)
    fireEvent(getByTestId('button'), 'hoverIn')
    expect(getByTestId('button')).toHaveStyle(expected)
  },
)

it('preserves custom rounding when sharp mode is disabled', () => {
  jest.mocked(useEnableSquareButtons).mockReturnValue(true)
  const {getByTestId} = render(
    <Button label="Test button" testID="button" style={{borderRadius: 20}}>
      <View />
    </Button>,
  )
  expect(getByTestId('button')).toHaveStyle({borderRadius: 20})
})
