/** @jest-environment jsdom */

import {act} from 'react'
import {createRoot} from 'react-dom/client'

import {Composer} from './Composer.web'

const mockCancel = jest.fn()
const mockMinimize = jest.fn()

jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('#/lib/shapes', () => ({SHARP_CORNERS: {}}))
jest.mock('#/state/a11y', () => ({
  useA11y: () => ({reduceMotionEnabled: true}),
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'round',
}))
jest.mock('#/state/shell/composer', () => ({useComposerState: () => ({})}))
jest.mock('#/alf', () => ({
  atoms: {},
  flatten:
    jest.requireActual<typeof import('react-native')>('react-native-web')
      .StyleSheet.flatten,
  useBreakpoints: () => ({gtMobile: true}),
  useTheme: () => ({atoms: {}}),
}))
jest.mock('#/view/com/composer/Composer', () => {
  const {Text} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  const {useImperativeHandle, useRef, useState} =
    jest.requireActual<typeof import('react')>('react')
  const {DismissableLayer} = jest.requireActual<
    typeof import('@radix-ui/react-dismissable-layer')
  >('@radix-ui/react-dismissable-layer')
  return {
    useComposerCancelRef: () => useRef(null),
    ComposePost: function ComposePost({
      cancelRef,
      renderPresentation,
    }: {
      cancelRef: React.Ref<{
        onPressCancel: () => void
        onPressMinimize: () => void
      }>
      renderPresentation: (children: React.ReactNode) => React.ReactNode
    }) {
      const [promptOpen, setPromptOpen] = useState(false)
      useImperativeHandle(cancelRef, () => ({
        onPressCancel: () => {
          mockCancel()
          setPromptOpen(true)
        },
        onPressMinimize: mockMinimize,
      }))
      return renderPresentation(
        <>
          <textarea aria-label="Post" />
          {promptOpen && (
            <DismissableLayer
              role="alertdialog"
              onEscapeKeyDown={event => {
                event.preventDefault()
                mockMinimize()
                setPromptOpen(false)
              }}
              onDismiss={() => {
                setPromptOpen(false)
              }}>
              <Text>Save draft?</Text>
            </DismissableLayer>
          )}
        </>,
      )
    },
  }
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it('does not block leaving the page with an unsaved composer', () => {
  const addListener = jest.spyOn(window, 'addEventListener')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    act(() => root.render(<Composer />))
    expect(
      addListener.mock.calls.some(([event]) => event === 'beforeunload'),
    ).toBe(false)
    const event = new Event('beforeunload', {cancelable: true})
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  } finally {
    act(() => root.unmount())
    container.remove()
  }
})

it('opens the exit prompt on the first escape and minimizes on the second', () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const escape = () =>
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    })

  try {
    act(() => root.render(<Composer />))
    escape()
    expect(mockCancel).toHaveBeenCalledTimes(1)
    expect(mockMinimize).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toBe(
      'Save draft?',
    )

    escape()
    expect(mockMinimize).toHaveBeenCalledTimes(1)
    expect(mockCancel).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()
  } finally {
    act(() => root.unmount())
    container.remove()
  }
})
