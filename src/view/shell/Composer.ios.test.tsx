import {Modal} from 'react-native'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {fireEvent, render} from '@testing-library/react-native'

import * as env from '#/env'
import {Composer} from './Composer.ios'

const mockCancel = jest.fn()
const mockMinimize = jest.fn()
const mockMount = jest.fn()
const mockUnmount = jest.fn()
let mockComposerState: {isMinimized?: boolean} | undefined = {}

jest.mock('#/env', () => ({
  __esModule: true,
  IS_IPAD: true,
  IS_LIQUID_GLASS: true,
}))
jest.mock('#/state/shell/composer', () => ({
  useComposerState: () => mockComposerState,
}))
jest.mock('#/view/com/composer/Composer', () => ({
  ComposePost: function ComposePost({
    renderPresentation,
  }: {
    renderPresentation: (children: React.ReactNode) => React.ReactNode
  }) {
    const {useEffect} = jest.requireActual<typeof import('react')>('react')
    useEffect(() => {
      mockMount()
      return () => mockUnmount()
    }, [])
    return renderPresentation(null)
  },
  useComposerCancelRef: () => ({
    current: {onPressCancel: mockCancel, onPressMinimize: mockMinimize},
  }),
}))
jest.mock('#/alf', () => {
  const {createContext} = jest.requireActual<typeof import('react')>('react')
  return {
    atoms: {flex_1: {flex: 1}},
    BreakpointWidthContext: createContext<number | undefined>(undefined),
    useTheme: () => ({atoms: {bg: {backgroundColor: 'white'}}}),
  }
})
jest.mock('#/components/Tooltip', () => ({
  SheetCompatProvider: ({children}: React.PropsWithChildren) => children,
}))
jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: {pushStackEntry: jest.fn(), popStackEntry: jest.fn()},
}))

afterEach(() => {
  mockComposerState = {}
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it('presents the iPad composer as a form sheet with its own safe area', () => {
  const result = render(<Composer />)
  const modal = result.UNSAFE_getByType(Modal)

  expect(modal.props.presentationStyle).toBe('formSheet')
  expect(modal.props.supportedOrientations).toEqual([
    'portrait',
    'portrait-upside-down',
    'landscape-left',
    'landscape-right',
  ])
  expect(result.UNSAFE_getByType(SafeAreaProvider)).toBeTruthy()
})

it('preserves the portrait page sheet on iPhone', () => {
  jest.replaceProperty(env, 'IS_IPAD', false)
  const result = render(<Composer />)
  const modal = result.UNSAFE_getByType(Modal)

  expect(modal.props.presentationStyle).toBe('pageSheet')
  expect(modal.props.supportedOrientations).toEqual(['portrait'])
  expect(result.UNSAFE_queryByType(SafeAreaProvider)).toBeNull()
})

it('opens the exit prompt instead of minimizing on the first native back gesture', () => {
  const result = render(<Composer />)
  fireEvent(result.UNSAFE_getByType(Modal), 'requestClose')

  expect(mockCancel).toHaveBeenCalledTimes(1)
  expect(mockMinimize).not.toHaveBeenCalled()
  expect(result.UNSAFE_getByType(Modal).props.allowSwipeDismissal).not.toBe(
    true,
  )
})

it('retains the composer session while hiding and restoring its sheet', () => {
  const screen = render(<Composer />)
  expect(mockMount).toHaveBeenCalledTimes(1)

  mockComposerState = {isMinimized: true}
  screen.rerender(<Composer />)
  expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false)
  expect(mockUnmount).not.toHaveBeenCalled()

  mockComposerState = {isMinimized: false}
  screen.rerender(<Composer />)
  expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true)
  expect(mockMount).toHaveBeenCalledTimes(1)

  mockComposerState = undefined
  screen.rerender(<Composer />)
  expect(mockUnmount).toHaveBeenCalledTimes(1)
})
