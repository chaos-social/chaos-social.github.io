/** @jest-environment jsdom */

import {act, useState} from 'react'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {createRoot} from 'react-dom/client'

import {TabPills} from '#/screens/Notifications/components/TabPills'
import {switchPageTab} from '#/features/keyboardShortcuts/postNavigation.web'
import {TabBar} from './TabBar.web'

jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'sharp',
}))
jest.mock('#/lib/userstyles', () => ({userStyle: () => ({})}))
jest.mock('#/alf', () => ({
  atoms: {rounded_sm: {borderRadius: 6}},
  tokens: {space: {lg: 24, md: 16}},
  utils: {alpha: (color: string) => color},
  useAlf: () => ({fonts: {scaleMultiplier: 1, family: 'system'}, flags: {}}),
  useBreakpoints: () => ({gtMobile: true}),
  useTheme: () => ({
    atoms: {
      bg: {backgroundColor: '#ffffff'},
      text_contrast_high: {color: '#000000'},
    },
    palette: {primary_500: '#ed5345', white: '#ffffff'},
  }),
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

jest.mock('react-native-reanimated', () => {
  const {View, Text} =
    jest.requireActual<typeof import('react-native')>('react-native-web')
  return {
    __esModule: true,
    default: {View, Text},
    useAnimatedStyle: () => ({}),
    useDerivedValue: (value: () => unknown) => ({get: value}),
  }
})
jest.mock('#/view/shell/BlockDrawerGesture', () => ({
  BlockDrawerGesture: ({children}: React.PropsWithChildren) => children,
}))
jest.mock('#/alf/typography', () => ({normalizeTextStyles: () => ({})}))
jest.mock('#/components/Button', () => ({
  Button:
    jest.requireActual<typeof import('react-native')>('react-native-web')
      .Pressable,
  ButtonIcon: () => null,
}))
jest.mock('#/components/icons/Arrow', () => ({}))
jest.mock('#/env', () => ({IS_WEB: true}))

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

it('switches the actual notification pills in both directions and wraps around', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalScrollTo = HTMLElement.prototype.scrollTo
  HTMLElement.prototype.scrollTo = jest.fn()
  function NotificationsTabs() {
    const [selectedTab, setSelectedTab] = useState('all')
    return (
      <TabPills
        tabs={[
          {key: 'all', label: 'All'},
          {key: 'mentions', label: 'Mentions'},
          {key: 'follows', label: 'Follows'},
        ]}
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
        dragProgress={
          {get: () => 0} as React.ComponentProps<
            typeof TabPills
          >['dragProgress']
        }
      />
    )
  }
  try {
    act(() =>
      root.render(
        <I18nProvider i18n={i18n}>
          <NotificationsTabs />
        </I18nProvider>,
      ),
    )
    const bar = container.querySelector<HTMLElement>(
      '[data-keyboard-navigation-tabs]',
    )!
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
    expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe('All')
    act(() => {
      expect(switchPageTab(1)).toBe(true)
    })
    expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe(
      'Mentions',
    )
    act(() => {
      expect(switchPageTab(-1)).toBe(true)
    })
    expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe('All')
    act(() => {
      expect(switchPageTab(-1)).toBe(true)
    })
    expect(bar.querySelector('[aria-selected="true"]')?.textContent).toBe(
      'Follows',
    )
  } finally {
    act(() => root.unmount())
    container.remove()
    HTMLElement.prototype.scrollTo = originalScrollTo
  }
})
