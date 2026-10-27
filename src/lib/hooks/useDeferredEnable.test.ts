import {act, renderHook} from '@testing-library/react-native'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'

const originalRequest = Object.getOwnPropertyDescriptor(
  globalThis,
  'requestIdleCallback',
)
const originalCancel = Object.getOwnPropertyDescriptor(
  globalThis,
  'cancelIdleCallback',
)

afterEach(() => {
  jest.useRealTimers()
  for (const [name, descriptor] of [
    ['requestIdleCallback', originalRequest],
    ['cancelIdleCallback', originalCancel],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
})

describe.each(['idle callbacks', 'no idle callbacks', 'no cancellation'])(
  '%s',
  mode => {
    beforeEach(() => {
      jest.useFakeTimers()
      Object.defineProperties(globalThis, {
        requestIdleCallback: {
          configurable: true,
          value:
            mode === 'no idle callbacks'
              ? undefined
              : jest.fn((callback: () => void) => setTimeout(callback, 1)),
        },
        cancelIdleCallback: {
          configurable: true,
          value: mode === 'idle callbacks' ? jest.fn(clearTimeout) : undefined,
        },
      })
    })

    it('defers enabling and resets when disabled', () => {
      const {result, rerender} = renderHook(
        ({enabled}: {enabled: boolean}) => useDeferredEnable(enabled),
        {initialProps: {enabled: false}},
      )
      expect(result.current).toBe(false)
      expect(jest.getTimerCount()).toBe(0)

      rerender({enabled: true})
      expect(result.current).toBe(false)
      act(() => jest.runAllTimers())
      expect(result.current).toBe(true)
      if (mode === 'idle callbacks') {
        expect(requestIdleCallback).toHaveBeenCalledTimes(1)
      }

      rerender({enabled: false})
      expect(result.current).toBe(false)
      rerender({enabled: true})
      expect(result.current).toBe(false)
      act(() => jest.runAllTimers())
      expect(result.current).toBe(true)
    })

    it('cancels pending work when disabled or unmounted', () => {
      const {result, rerender, unmount} = renderHook(
        ({enabled}: {enabled: boolean}) => useDeferredEnable(enabled),
        {initialProps: {enabled: true}},
      )
      expect(jest.getTimerCount()).toBe(1)
      rerender({enabled: false})
      expect(jest.getTimerCount()).toBe(0)
      act(() => jest.runAllTimers())
      expect(result.current).toBe(false)

      rerender({enabled: true})
      expect(jest.getTimerCount()).toBe(1)
      unmount()
      expect(jest.getTimerCount()).toBe(0)
      if (mode === 'idle callbacks') {
        expect(cancelIdleCallback).toHaveBeenCalledTimes(2)
      }
    })
  },
)
