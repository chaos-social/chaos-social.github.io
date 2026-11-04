import {fireEvent, render} from '@testing-library/react-native'

jest.mock('@lingui/react', () => {
  const format = (
    message:
      {message?: string; values?: Record<string, string | number>} | string,
  ) => {
    if (typeof message === 'string') return message
    return (message.message ?? '').replace(/{(\w+)}/g, (_, key: string) =>
      String(message.values?.[key] ?? ''),
    )
  }
  return {
    useLingui: () => ({_: format}),
    Trans: ({
      id,
      message,
      values,
    }: {
      id: string
      message?: string
      values?: Record<string, string | number>
    }) => format({message: message ?? id, values}),
  }
})
jest.mock('#/alf', () => {
  const blank = new Proxy({}, {get: () => ({})})
  return {
    atoms: blank,
    useTheme: () => ({
      atoms: blank,
      palette: new Proxy({}, {get: () => '#000'}),
    }),
  }
})
jest.mock('#/components/icons/CalendarDays', () => ({
  CalendarDays_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/Button', () => {
  const {Pressable} = require('react-native')
  return {
    Button: ({
      accessibilityHint,
      children,
      disabled,
      label,
      onPress,
      testID,
    }: {
      accessibilityHint: string
      children: React.ReactNode
      disabled?: boolean
      label: string
      onPress: () => void
      testID?: string
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{disabled: !!disabled}}
        disabled={disabled}
        onPress={onPress}
        testID={testID}>
        {children}
      </Pressable>
    ),
  }
})

const mockMetric = jest.fn()
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: mockMetric}),
}))

import {SelectEventBtn} from '../SelectEventBtn'

describe('SelectEventBtn', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens the event editor and reports it', () => {
    const onPress = jest.fn()
    const {getByTestId} = render(<SelectEventBtn onPress={onPress} />)

    const button = getByTestId('openEventBtn')
    expect(button).toHaveProp('accessibilityLabel', 'Add event')
    fireEvent.press(button)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(mockMetric).toHaveBeenCalledWith('composer:event:open', {})
  })

  it('does nothing when disabled', () => {
    const onPress = jest.fn()
    const {getByTestId} = render(<SelectEventBtn onPress={onPress} disabled />)
    fireEvent.press(getByTestId('openEventBtn'))
    expect(onPress).not.toHaveBeenCalled()
    expect(mockMetric).not.toHaveBeenCalled()
  })
})
