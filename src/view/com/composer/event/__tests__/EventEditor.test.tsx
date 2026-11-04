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
  const useLingui = () => ({_: format, t: format, i18n: {date: () => 'date'}})
  return {
    useLingui,
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
      scheme: 'light',
    }),
  }
})
jest.mock('#/components/Typography', () => {
  const {Text} = require('react-native')
  return {Text}
})
jest.mock('#/components/icons/CalendarDays', () => ({
  CalendarDays_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {
    Button: ({
      children,
      disabled,
      label,
      onPress,
      testID,
    }: {
      children?: React.ReactNode | ((state: object) => React.ReactNode)
      disabled?: boolean
      label: string
      onPress?: () => void
      testID?: string
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint=""
        disabled={disabled}
        onPress={onPress}
        testID={testID}>
        {typeof children === 'function' ? children({}) : children}
        {label ? <Text>{label}</Text> : null}
      </Pressable>
    ),
    ButtonText: ({children}: {children: React.ReactNode}) => (
      <Text>{children}</Text>
    ),
  }
})
jest.mock('#/components/forms/TextField', () => {
  const {TextInput} = require('react-native')
  return {
    Root: ({children}: {children: React.ReactNode}) => children,
    LabelText: ({children}: {children: React.ReactNode}) => {
      const {Text} = require('react-native')
      return <Text>{children}</Text>
    },
    Input: ({
      label,
      onChangeText,
      placeholder,
      testID,
      value,
    }: {
      label: string
      onChangeText: (text: string) => void
      placeholder: string
      testID: string
      value: string
    }) => (
      <TextInput
        accessibilityLabel={label}
        accessibilityHint=""
        onChangeText={onChangeText}
        placeholder={placeholder}
        testID={testID}
        value={value}
      />
    ),
  }
})
jest.mock('#/components/forms/SegmentedControl', () => {
  const {Pressable, Text} = require('react-native')
  // Root hands its onChange to the Items through a module-level bridge, which
  // avoids nested mock-scope references the babel plugin rejects.
  const bridge = globalThis as {__onSegmentChange?: (v: string) => void}
  return {
    Root: ({
      children,
      onChange,
    }: {
      children: React.ReactNode
      onChange: (v: string) => void
    }) => {
      bridge.__onSegmentChange = onChange
      return children
    },
    Item: ({
      children,
      label,
      value,
    }: {
      children: React.ReactNode
      label: string
      value: string
    }) => (
      <Pressable
        accessibilityRole="radio"
        onPress={() => bridge.__onSegmentChange?.(value)}
        testID={`segment-${value}`}>
        {children}
        <Text>{label}</Text>
      </Pressable>
    ),
    ItemText: ({children}: {children: React.ReactNode}) => (
      <Text>{children}</Text>
    ),
  }
})
jest.mock('#/components/forms/DateTimeField', () => {
  const {TextInput} = require('react-native')
  return {
    DateTimeField: ({
      label,
      onChangeDateTime,
      testID,
      value,
    }: {
      label: string
      onChangeDateTime: (v: string) => void
      testID: string
      value: string
    }) => (
      <TextInput
        accessibilityLabel={label}
        accessibilityHint=""
        onChangeText={onChangeDateTime}
        testID={testID}
        value={value}
      />
    ),
  }
})

const mockMetric = jest.fn()
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: mockMetric}),
}))

import {type EventDraft} from '#/lib/api/event'
import {type PostAction} from '#/view/com/composer/state/composer'
import {EventEditor} from '../EventEditor'

const base: EventDraft = {
  name: 'Meetup',
  date: '2026-10-01',
  time: '18:00',
  timezone: 'Europe/Berlin',
  mode: 'inperson',
}

function renderEditor(event: EventDraft = base) {
  const dispatch = jest.fn<void, [PostAction]>()
  const utils = render(<EventEditor event={event} dispatch={dispatch} />)
  return {dispatch, ...utils}
}

describe('EventEditor', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows a hint until the event has a name', () => {
    const {getByTestId} = renderEditor({...base, name: ''})
    expect(getByTestId('eventNameHint')).toBeTruthy()
  })

  it('does not show the name hint once named', () => {
    const {queryByTestId} = renderEditor()
    expect(queryByTestId('eventNameHint')).toBeNull()
  })

  it('dispatches a name update', () => {
    const {dispatch, getByTestId} = renderEditor()
    fireEvent.changeText(getByTestId('eventNameInput'), 'Garden party')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'embed_update_event',
      patch: {name: 'Garden party'},
    })
  })

  it('splits a combined start value into date and time', () => {
    const {dispatch, getByTestId} = renderEditor()
    fireEvent.changeText(getByTestId('eventStartField'), '2026-11-02T20:30')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'embed_update_event',
      patch: {date: '2026-11-02', time: '20:30'},
    })
  })

  it('removes an end that ends up before a new start', () => {
    const {dispatch, getByTestId} = renderEditor({
      ...base,
      endsDate: '2026-10-01',
      endsTime: '20:00',
    })
    fireEvent.changeText(getByTestId('eventStartField'), '2026-10-05T18:00')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'embed_update_event',
      patch: {
        date: '2026-10-05',
        time: '18:00',
        endsDate: undefined,
        endsTime: undefined,
      },
    })
  })

  it('dispatches a mode change', () => {
    const {dispatch, getByTestId} = renderEditor()
    fireEvent.press(getByTestId('segment-virtual'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'embed_update_event',
      patch: {mode: 'virtual'},
    })
  })

  it('removes the event', () => {
    const {dispatch, getByTestId} = renderEditor()
    fireEvent.press(getByTestId('removeEventBtn'))
    expect(mockMetric).toHaveBeenCalledWith('composer:event:remove', {})
    expect(dispatch).toHaveBeenCalledWith({type: 'embed_remove_event'})
  })
})
