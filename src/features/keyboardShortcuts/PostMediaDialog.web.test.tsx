/** @jest-environment jsdom */

import {act} from 'react'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {createRoot} from 'react-dom/client'

import {type DialogControlProps} from '#/components/Dialog'
import {PostMediaDialog} from './PostMediaDialog.web'

jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({atoms: {}}),
  web: (style: object) => style,
}))
jest.mock('#/components/Typography', () => ({
  Text: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
}))
jest.mock('#/components/Button', () => ({
  Button: ({
    children,
    onPress,
    testID,
  }: React.PropsWithChildren<{onPress: () => void; testID: string}>) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  ButtonText: ({children}: {children: React.ReactNode}) => (
    <span>{children}</span>
  ),
}))
jest.mock('#/components/Dialog', () => {
  const {useState, useImperativeHandle} =
    jest.requireActual<typeof import('react')>('react')
  const {FocusScope} = jest.requireActual<
    typeof import('@radix-ui/react-focus-scope')
  >('@radix-ui/react-focus-scope')
  return {
    Outer: function Outer({
      children,
      control,
      onOpen,
    }: React.PropsWithChildren<{
      control: DialogControlProps
      onOpen: () => void
    }>) {
      const [open, setOpen] = useState(false)
      useImperativeHandle(control.ref, () => ({
        open: () => {
          onOpen()
          setOpen(true)
        },
        close: (callback?: () => void) => {
          setOpen(false)
          if (callback) setTimeout(callback)
        },
      }))
      return open ? children : null
    },
    ScrollableInner: function Inner({
      children,
      onCloseAutoFocus,
    }: React.PropsWithChildren<{onCloseAutoFocus: (event: Event) => void}>) {
      return (
        <FocusScope loop trapped onUnmountAutoFocus={onCloseAutoFocus}>
          {children}
        </FocusScope>
      )
    },
    Close: () => null,
  }
})

it('hands focus to the chosen video and restores the post only when cancelled', () => {
  jest.useFakeTimers()
  const post = document.createElement('div')
  post.tabIndex = 0
  const player = document.createElement('div')
  player.dataset.testid = 'postVideoFocusTarget'
  player.tabIndex = -1
  const play = document.createElement('button')
  player.append(play)
  post.append(player)
  const container = document.createElement('div')
  document.body.append(post, container)
  const control: DialogControlProps = {
    id: 'media-picker',
    ref: {current: null},
    open: () => control.ref.current?.open(),
    close: callback => control.ref.current?.close(callback),
  }
  const root = createRoot(container)
  try {
    post.focus()
    act(() =>
      root.render(
        <I18nProvider i18n={i18n}>
          <PostMediaDialog
            control={control}
            targets={[{kind: 'media', control: play}]}
          />
        </I18nProvider>,
      ),
    )
    act(() => control.open())
    expect(document.activeElement).toBe(container.querySelector('button'))
    act(() => container.querySelector<HTMLButtonElement>('button')!.click())
    act(() => jest.runAllTimers())
    expect(document.activeElement).toBe(player)

    post.focus()
    act(() => control.open())
    act(() => control.close())
    act(() => jest.runAllTimers())
    expect(document.activeElement).toBe(post)
  } finally {
    act(() => root.unmount())
    container.remove()
    post.remove()
    jest.useRealTimers()
  }
})
