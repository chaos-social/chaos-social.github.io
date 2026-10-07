/** @jest-environment jsdom */

import {act} from 'react'
import {createRoot} from 'react-dom/client'

import {switchPageTab} from '#/features/keyboardShortcuts/postNavigation.web'
import {TabBar} from './TabBar.web'

jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'sharp',
}))
jest.mock('#/lib/userstyles', () => ({userStyle: () => ({})}))
jest.mock('#/alf', () => ({
  atoms: {},
  useBreakpoints: () => ({gtMobile: true}),
  useTheme: () => ({atoms: {}, palette: {}}),
  web: (value: unknown) => value,
}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native-web')
    .Text,
}))
jest.mock('../util/PressableWithHover', () => ({
  PressableWithHover:
    jest.requireActual<typeof import('react-native')>('react-native-web')
      .Pressable,
}))
jest.mock('./DraggableScrollView', () => ({
  DraggableScrollView:
    jest.requireActual<typeof import('react-native')>('react-native-web').View,
}))

it('exposes the selected page tab to keyboard navigation on web', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onSelect = jest.fn()
  try {
    act(() => {
      root.render(
        <TabBar
          selectedPage={1}
          items={['Posts', 'Replies', 'Media']}
          onSelect={onSelect}
        />,
      )
    })
    const bar = container.querySelector<HTMLElement>('[role="tablist"]')!
    bar.getBoundingClientRect = () => ({
      top: 0,
      bottom: 50,
      left: 0,
      right: 600,
      width: 600,
      height: 50,
      x: 0,
      y: 0,
      toJSON() {},
    })
    expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe(
      'Replies',
    )
    act(() => {
      expect(switchPageTab(1)).toBe(true)
    })
    expect(onSelect).toHaveBeenLastCalledWith(2)
    act(() => {
      expect(switchPageTab(-1)).toBe(true)
    })
    expect(onSelect).toHaveBeenLastCalledWith(0)
  } finally {
    act(() => root.unmount())
    container.remove()
  }
})
