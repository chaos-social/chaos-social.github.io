import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {ComposerExitDialog} from '#/components/ComposerExitDialog'

const mockClose = jest.fn<void, [(() => void)?]>()
const i18n = setupI18n({locale: 'en', messages: {en: {}}})

jest.mock('#/components/Dialog', () => ({
  useDialogContext: () => ({close: mockClose}),
}))
jest.mock('#/components/Prompt', () => {
  const {View, Text} = jest.requireActual('react-native')
  return {
    Outer: View,
    Content: View,
    Actions: View,
    TitleText: Text,
    DescriptionText: Text,
  }
})
jest.mock('#/components/Button', () => {
  const {Pressable, Text, View} = jest.requireActual('react-native')
  return {
    Button: Pressable,
    ButtonText: Text,
    ButtonIcon: () => <View testID="actionIcon" />,
  }
})
jest.mock('#/alf', () => ({atoms: {}}))

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

function setup({canSaveDraft = true, isEditingDraft = false} = {}) {
  const onSave = jest.fn()
  const onEditLater = jest.fn()
  const onDiscard = jest.fn()
  const screen = render(
    <I18nProvider i18n={i18n}>
      <ComposerExitDialog
        control={{
          id: 'exit',
          ref: {current: null},
          open: jest.fn(),
          close: mockClose,
        }}
        canSaveDraft={canSaveDraft}
        isEditingDraft={isEditingDraft}
        onSave={onSave}
        onEditLater={onEditLater}
        onDiscard={onDiscard}
      />
    </I18nProvider>,
  )
  return {screen, onSave, onEditLater, onDiscard}
}

it('renders all four exit actions with icons', () => {
  const {screen} = setup()
  for (const label of ['Save draft', 'Continue', 'Minimize', 'Discard']) {
    expect(screen.getByText(label)).toBeTruthy()
  }
  expect(screen.getAllByTestId('actionIcon')).toHaveLength(4)
})

it.each([
  ['composerSaveDraftBtn', 'onSave'],
  ['composerEditLaterBtn', 'onEditLater'],
  ['composerDiscardBtn', 'onDiscard'],
] as const)('runs %s only after the prompt closes', (testID, callback) => {
  const result = setup()
  fireEvent.press(result.screen.getByTestId(testID))
  expect(mockClose).toHaveBeenCalledTimes(1)
  expect(result[callback]).not.toHaveBeenCalled()
  mockClose.mock.calls[0][0]?.()
  expect(result[callback]).toHaveBeenCalledTimes(1)
})

it('keeps editing by closing only the prompt', () => {
  const {screen, onSave, onEditLater, onDiscard} = setup()
  fireEvent.press(screen.getByTestId('composerKeepEditingBtn'))
  expect(mockClose).toHaveBeenCalledWith(undefined)
  expect(onSave).not.toHaveBeenCalled()
  expect(onEditLater).not.toHaveBeenCalled()
  expect(onDiscard).not.toHaveBeenCalled()
})

it('keeps the grid intact but disables saving an over-limit composition', () => {
  const {screen, onSave} = setup({canSaveDraft: false})
  fireEvent.press(screen.getByTestId('composerSaveDraftBtn'))
  expect(mockClose).not.toHaveBeenCalled()
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getAllByTestId('actionIcon')).toHaveLength(4)
})

it('keeps the save draft button label when updating a loaded draft', () => {
  const {screen} = setup({isEditingDraft: true})
  expect(screen.getByText('Save draft')).toBeTruthy()
  expect(screen.getByTestId('composerSaveDraftBtn').props.label).toBe(
    'Save draft',
  )
})

it.each(['handle press', 'swipe down', 'backdrop press'])(
  'keeps editing after a %s dismisses the exit prompt',
  () => {
    const {screen, onEditLater, onSave, onDiscard} = setup()
    fireEvent(screen.getByTestId('composerExitDialog'), 'close')
    expect(onEditLater).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    expect(onDiscard).not.toHaveBeenCalled()
  },
)

it.each([
  'composerSaveDraftBtn',
  'composerKeepEditingBtn',
  'composerDiscardBtn',
])('does not minimize when %s closes the prompt', testID => {
  const {screen, onEditLater} = setup()
  fireEvent.press(screen.getByTestId(testID))
  mockClose.mock.calls[0][0]?.()
  fireEvent(screen.getByTestId('composerExitDialog'), 'close')
  expect(onEditLater).not.toHaveBeenCalled()
})

it('does not minimize twice when minimize closes the prompt', () => {
  const {screen, onEditLater} = setup()
  fireEvent.press(screen.getByTestId('composerEditLaterBtn'))
  mockClose.mock.calls[0][0]?.()
  fireEvent(screen.getByTestId('composerExitDialog'), 'close')
  expect(onEditLater).toHaveBeenCalledTimes(1)
})

it.each(['escape', 'native back'])(
  'minimizes after %s closes the exit prompt',
  () => {
    const {screen, onEditLater} = setup()
    fireEvent(screen.getByTestId('composerExitDialog'), 'back')
    expect(onEditLater).not.toHaveBeenCalled()
    expect(mockClose).toHaveBeenCalledTimes(1)
    mockClose.mock.calls[0][0]?.()
    expect(onEditLater).toHaveBeenCalledTimes(1)
  },
)

it('shows the shorter continue label while retaining the keep editing accessibility label', () => {
  const {screen} = setup()
  expect(screen.getByText('Continue')).toBeTruthy()
  expect(screen.getByTestId('composerKeepEditingBtn').props.label).toBe(
    'Keep editing',
  )
})
