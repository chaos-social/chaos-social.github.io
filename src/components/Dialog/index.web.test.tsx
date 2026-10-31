import {act} from 'react'
import {createRoot} from 'react-dom/client'

import {type DialogControlProps} from '#/components/Dialog/types'
import {Inner, Outer} from './index.web'

jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('#/env', () => ({IS_DEV: false}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: (message: {message: string}) => message.message}),
}))
jest.mock('#/lib/shapes', () => ({SHARP_CORNERS: {}}))
jest.mock('#/lib/userstyles', () => ({userStyle: () => ({})}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/state/a11y', () => ({
  useA11y: () => ({reduceMotionEnabled: true}),
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'round',
}))
jest.mock('#/state/dialogs', () => ({
  useDialogStateControlContext: () => ({setDialogIsOpen: jest.fn()}),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  web: (style: unknown) => style,
  flatten:
    jest.requireActual<typeof import('react-native')>('react-native-web')
      .StyleSheet.flatten,
  useBreakpoints: () => ({gtMobile: true}),
  useTheme: () => ({atoms: {}, palette: {}, name: 'light'}),
}))
jest.mock('#/components/Button', () => ({}))
jest.mock('#/components/Dialog/shared', () => ({}))
jest.mock('#/components/forms/TextField', () => ({}))
jest.mock('#/components/Portal', () => ({
  Portal: ({children}: React.PropsWithChildren) => children,
}))

afterEach(() => jest.clearAllMocks())

function setup({handleBack = true} = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onClose = jest.fn()
  const control: DialogControlProps = {
    id: 'test-dialog',
    ref: {current: null},
    open: () => control.ref.current?.open(),
    close: callback => control.ref.current?.close(callback),
  }
  const onBack = jest.fn(() => control.close())
  act(() =>
    root.render(
      <Outer
        control={control}
        onClose={onClose}
        onBack={handleBack ? onBack : undefined}>
        <Inner label="Exit composer">
          <input aria-label="Post" />
        </Inner>
      </Outer>,
    ),
  )
  act(() => control.open())
  return {
    container,
    onClose,
    onBack,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

it('routes escape to the explicit back handler', () => {
  const screen = setup()
  try {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    expect(screen.onBack).toHaveBeenCalledTimes(1)
    expect(screen.onClose).toHaveBeenCalledTimes(1)
  } finally {
    screen.unmount()
  }
})

it('closes on escape normally when no back handler is provided', () => {
  const screen = setup({handleBack: false})
  try {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    expect(screen.onBack).not.toHaveBeenCalled()
    expect(screen.onClose).toHaveBeenCalledTimes(1)
  } finally {
    screen.unmount()
  }
})

it('closes on backdrop presses without treating them as back commands', () => {
  const screen = setup()
  try {
    const backdrop = screen.container.querySelector(
      '[aria-label="Close active dialog"]',
    )
    expect(backdrop).not.toBeNull()
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('click', {bubbles: true}))
    })
    expect(screen.onBack).not.toHaveBeenCalled()
    expect(screen.onClose).toHaveBeenCalledTimes(1)
  } finally {
    screen.unmount()
  }
})
