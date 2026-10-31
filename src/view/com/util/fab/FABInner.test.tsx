import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render} from '@testing-library/react-native'

import {FABInner} from '#/view/com/util/fab/FABInner'

let mockComposer: {isMinimized?: boolean} | undefined
const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function Wrapper({children}: React.PropsWithChildren) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

jest.mock('#/state/shell/composer', () => ({
  useComposerState: () => mockComposer,
}))
jest.mock('#/lib/custom-animations/PressableScale', () => ({
  PressableScale:
    jest.requireActual<typeof import('react-native')>('react-native').Pressable,
}))
jest.mock('#/lib/haptics', () => ({useHaptics: () => ({})}))
jest.mock('#/lib/hooks/useMinimalShellTransform', () => ({
  useMinimalShellFabTransform: () => ({}),
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => false,
}))
jest.mock('#/alf', () => ({
  atoms: {},
  ios: () => undefined,
  useBreakpoints: () => ({gtMobile: false}),
  useTheme: () => ({palette: {primary_500: '#000'}}),
}))

beforeEach(() => {
  mockComposer = undefined
})

it('labels a retained composer as Open post and resets after it is closed', () => {
  const button = () => (
    <FABInner
      icon={<></>}
      userStyleVariant="compose"
      accessibilityLabel="New post"
      accessibilityHint=""
    />
  )
  const screen = render(button(), {wrapper: Wrapper})
  expect(screen.getByLabelText('New post')).toBeTruthy()

  mockComposer = {isMinimized: true}
  screen.rerender(button())
  expect(screen.getByLabelText('Open post')).toBeTruthy()

  mockComposer = undefined
  screen.rerender(button())
  expect(screen.getByLabelText('New post')).toBeTruthy()
})

it('does not relabel unrelated floating buttons', () => {
  mockComposer = {isMinimized: true}
  const screen = render(
    <FABInner
      icon={<></>}
      accessibilityLabel="Load new posts"
      accessibilityHint=""
    />,
    {wrapper: Wrapper},
  )
  expect(screen.getByLabelText('Load new posts')).toBeTruthy()
})
