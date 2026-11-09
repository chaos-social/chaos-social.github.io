import {fireEvent, render} from '@testing-library/react-native'

import {CheckboxItemText} from '#/components/Menu/CheckboxItem'
import {device} from '#/storage'
import {getCopyShareLinks} from '#/storage/hooks/copy-share-links'

jest.mock('#/alf', () => ({atoms: {}}))
jest.mock('#/components/forms/Toggle', () => {
  const {Pressable, Text} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    Item: ({
      value,
      onChange,
    }: {
      value: boolean
      onChange: (next: boolean) => void
    }) => (
      <Pressable
        role="checkbox"
        accessibilityLabel="Copy"
        accessibilityHint="Copy share links"
        accessibilityState={{checked: value}}
        onPress={() => onChange(!value)}
      />
    ),
    Checkbox: () => null,
    LabelText: Text,
  }
})

afterEach(() => device.remove(['copyShareLinks']))

it('updates immediately in both directions when submenu props stay unchanged', () => {
  const screen = render(
    <CheckboxItemText
      value={false}
      label="Copy"
      onChange={next => device.set(['copyShareLinks'], next)}>
      Copy
    </CheckboxItemText>,
  )
  const checkbox = () => screen.getByRole('checkbox')
  fireEvent.press(checkbox())
  expect(screen.getByRole('checkbox', {checked: true})).toBeTruthy()
  expect(getCopyShareLinks()).toBe(true)
  fireEvent.press(checkbox())
  expect(screen.getByRole('checkbox', {checked: false})).toBeTruthy()
  expect(getCopyShareLinks()).toBe(false)
})
