/** @jest-environment jsdom */

import {act, useState} from 'react'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {createRoot} from 'react-dom/client'

import {useSetSubtitlesEnabled} from '#/state/preferences'
import {useFullscreen} from '#/components/hooks/useFullscreen'
import {Controls} from './VideoControls'

jest.mock('#/components/icons/TEMPLATE', () => ({
  createSinglePathSVG: ({path}: {path: string}) =>
    function Icon() {
      return (
        <svg>
          <path d={path} />
        </svg>
      )
    },
}))
jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('./VideoControls', () => jest.requireActual('./VideoControls.tsx'))
jest.mock('#/env', () => ({IS_WEB: true}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({palette: {white: '#fff'}}),
  web: (style: object) => style,
}))
jest.mock('#/state/preferences', () => ({
  useAutoplayDisabled: () => true,
  useSubtitlesEnabled: () => false,
  useSetSubtitlesEnabled: jest.fn(),
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'round',
}))
jest.mock('#/components/dms/MessageContext', () => ({
  useIsWithinMessage: () => false,
}))
jest.mock('#/components/hooks/useFullscreen', () => ({
  useFullscreen: jest.fn(() => [false, jest.fn()]),
}))
jest.mock('#/components/Post/Embed/VideoEmbed/VideoVolumeContext', () => ({
  useVideoVolumeState: () => [1, jest.fn()],
}))
jest.mock('../../useVideoPlaybackSpeed', () => ({
  useVideoPlaybackSpeed: () => [1, jest.fn()],
}))
jest.mock('./SettingsMenu', () => ({SettingsMenu: () => null}))
jest.mock('./ControlButton', () => ({ControlButton: () => null}))
jest.mock('./Scrubber', () => ({Scrubber: () => null}))
jest.mock('./VolumeControl', () => ({
  VolumeControl: () => null,
  videoVolumeToSliderVolume: (value: number) => Math.round(value ** 0.25 * 100),
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
}))
jest.mock('../TimeIndicator', () => ({TimeIndicator: () => null}))
jest.mock('../../GifPresentationControls', () => ({
  GifPresentationControls: () => null,
}))

it('shows keyboard actions, refreshes the timeout, and ignores editable targets', () => {
  jest.useFakeTimers()
  const setSubtitlesEnabled = jest.fn()
  jest.mocked(useSetSubtitlesEnabled).mockReturnValue(setSubtitlesEnabled)
  const container = document.createElement('div')
  const video = document.createElement('video')
  const input = document.createElement('input')
  const otherPlayer = document.createElement('div')
  document.body.append(container, otherPlayer)
  container.append(video, input)
  Object.defineProperty(video, 'duration', {value: 60})
  Object.defineProperty(video, 'readyState', {value: 4})
  let paused = true
  Object.defineProperty(video, 'paused', {get: () => paused})
  const pause = jest.spyOn(video, 'pause').mockImplementation(() => {
    paused = true
    video.dispatchEvent(new Event('pause'))
  })
  const play = jest.spyOn(video, 'play').mockImplementation(() => {
    paused = false
    video.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  const rootContainer = document.createElement('div')
  container.append(rootContainer)
  const root = createRoot(rootContainer)
  const press = (key: string, target: HTMLElement = document.body) => {
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}),
      )
    })
  }
  try {
    act(() =>
      root.render(
        <I18nProvider i18n={i18n}>
          <Controls
            videoRef={{current: video}}
            hlsRef={{current: null}}
            active
            setActive={() => {}}
            focused
            setFocused={() => {}}
            onScreen
            fullscreenRef={{current: container}}
            hlsLoading={false}
            hasSubtitleTrack
            isGif={false}
            updateCuePositions={() => {}}
          />
        </I18nProvider>,
      ),
    )
    press('ArrowRight')
    expect(video.currentTime).toBe(5)
    expect(container.textContent).toContain('+5')
    const badge = () =>
      rootContainer.querySelector<HTMLElement>(
        '[data-testid="videoKeyboardFeedback"]',
      )!
    expect(badge().style.width).toBe('')
    expect(badge().style.height).toBe('')
    act(() => jest.advanceTimersByTime(600))
    press('ArrowLeft')
    expect(video.currentTime).toBe(0)
    expect(container.textContent).toContain('-5')
    act(() => jest.advanceTimersByTime(600))
    expect(container.textContent).toContain('-5')
    expect(badge().style.opacity).toBe('1')
    act(() => jest.advanceTimersByTime(50))
    expect(badge().style.opacity).toBe('0')
    press('ArrowLeft')
    expect(badge().style.opacity).toBe('1')
    act(() => jest.advanceTimersByTime(800))
    expect(
      rootContainer.querySelector('[data-testid="videoKeyboardFeedback"]'),
    ).toBeNull()

    press('c')
    expect(setSubtitlesEnabled).toHaveBeenCalledWith(true)
    press('c', input)
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'c', repeat: true, bubbles: true}),
      )
    })
    expect(setSubtitlesEnabled).toHaveBeenCalledTimes(1)

    press('m')
    expect(video.muted).toBe(true)
    expect(container.textContent).toContain('0%')
    press('m')
    expect(video.muted).toBe(false)
    expect(container.textContent).toContain('100%')
    expect(badge().style.width).toBe('72px')
    expect(badge().style.height).toBe('72px')
    press('ArrowDown')
    expect(video.volume).toBeCloseTo(0.95 ** 4)
    expect(container.textContent).toContain('95%')
    press('>')
    expect(video.playbackRate).toBe(1.25)
    expect(container.textContent).toContain('1.25×')
    act(() => jest.advanceTimersByTime(800))
    press('.')
    expect(pause).toHaveBeenCalled()
    expect(video.currentTime).toBeCloseTo(1 / 30)
    expect(badge()).toBeNull()
    press(',')
    expect(video.currentTime).toBeCloseTo(0)
    expect(badge()).toBeNull()
    press('k')
    expect(play).toHaveBeenCalled()
    expect(badge()).toBeNull()
    act(() => jest.advanceTimersByTime(800))
    press('f')
    expect(badge()).toBeNull()

    act(() => jest.advanceTimersByTime(800))
    press('ArrowRight', input)
    expect(video.currentTime).toBeCloseTo(0)
    expect(
      rootContainer.querySelector('[data-testid="videoKeyboardFeedback"]'),
    ).toBeNull()
    const releaseSpace = () =>
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keyup', {
            key: ' ',
            bubbles: true,
            cancelable: true,
          }),
        )
      })
    const holdBadge = () =>
      rootContainer.querySelector('[data-testid="videoHoldSpeedFeedback"]')
    press(' ')
    act(() => jest.advanceTimersByTime(299))
    expect(video.paused).toBe(false)
    expect(video.playbackRate).toBe(1.25)
    expect(holdBadge()).toBeNull()
    releaseSpace()
    expect(video.paused).toBe(true)

    press(' ')
    act(() => jest.advanceTimersByTime(300))
    expect(video.paused).toBe(false)
    expect(video.playbackRate).toBe(2)
    expect(holdBadge()?.textContent).toBe('2×')
    act(() => jest.advanceTimersByTime(2000))
    expect(holdBadge()).not.toBeNull()
    press('>')
    expect(video.playbackRate).toBe(2)
    releaseSpace()
    expect(video.playbackRate).toBe(1.25)
    expect(video.paused).toBe(true)
    expect(holdBadge()).toBeNull()

    press('k')
    press(' ')
    act(() => jest.advanceTimersByTime(300))
    releaseSpace()
    expect(video.playbackRate).toBe(1.25)
    expect(video.paused).toBe(false)
    press(' ')
    act(() => jest.advanceTimersByTime(300))
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(video.playbackRate).toBe(1.25)
    expect(holdBadge()).toBeNull()
    releaseSpace()
    expect(video.paused).toBe(false)

    const surface = rootContainer.querySelector<HTMLButtonElement>(
      '[data-testid="postMediaOpenBtn"]',
    )!
    act(() => surface.click())
    act(() => surface.focus())
    expect(video.paused).toBe(true)
    press(' ', surface)
    act(() => jest.advanceTimersByTime(300))
    expect(video.playbackRate).toBe(2)
    expect(video.paused).toBe(false)
    releaseSpace()
    expect(video.playbackRate).toBe(1.25)
    expect(video.paused).toBe(true)
    press(' ', surface)
    releaseSpace()
    expect(video.paused).toBe(false)

    otherPlayer.tabIndex = 0
    act(() => otherPlayer.focus())
    press('ArrowRight')
    expect(video.currentTime).toBeCloseTo(0)
  } finally {
    act(() => root.unmount())
    container.remove()
    otherPlayer.remove()
    jest.restoreAllMocks()
    jest.useRealTimers()
  }
})

it('boosts only mouse holds and restores playback without toggling on release', () => {
  jest.useFakeTimers()
  jest.mocked(useSetSubtitlesEnabled).mockReturnValue(jest.fn())
  const toggleFullscreen = jest.fn()
  jest.mocked(useFullscreen).mockReturnValue([false, toggleFullscreen])
  const container = document.createElement('div')
  const video = document.createElement('video')
  document.body.append(container)
  const videoRef = {current: video}
  const fullscreenRef = {current: container}
  const hlsRef = {current: null}
  Object.defineProperty(video, 'duration', {value: 60})
  Object.defineProperty(video, 'readyState', {value: 4})
  let paused = true
  Object.defineProperty(video, 'paused', {get: () => paused})
  jest.spyOn(video, 'play').mockImplementation(() => {
    paused = false
    video.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  jest.spyOn(video, 'pause').mockImplementation(() => {
    paused = true
    video.dispatchEvent(new Event('pause'))
  })
  const root = createRoot(container)
  function Player() {
    const [focused, setFocused] = useState(false)
    return (
      <I18nProvider i18n={i18n}>
        <Controls
          videoRef={videoRef}
          hlsRef={hlsRef}
          active
          setActive={() => {}}
          focused={focused}
          setFocused={setFocused}
          onScreen
          fullscreenRef={fullscreenRef}
          hlsLoading={false}
          hasSubtitleTrack={false}
          isGif={false}
          updateCuePositions={() => {}}
        />
      </I18nProvider>
    )
  }
  const pointer = (
    type: string,
    target: EventTarget,
    options: {pointerType?: string; button?: number; pointerId?: number} = {},
  ) => {
    act(() => {
      const event = new Event(type, {bubbles: true, cancelable: true})
      Object.assign(event, {
        pointerType: 'mouse',
        button: 0,
        pointerId: 1,
        ...options,
      })
      target.dispatchEvent(event)
    })
  }
  const click = (target: HTMLElement, detail = 1) => {
    act(() => {
      target.dispatchEvent(
        new MouseEvent('click', {bubbles: true, cancelable: true, detail}),
      )
    })
  }
  try {
    act(() => root.render(<Player />))
    const surface = container.querySelector<HTMLButtonElement>(
      '[data-testid="postMediaOpenBtn"]',
    )!
    const badge = () =>
      container.querySelector('[data-testid="videoHoldSpeedFeedback"]')
    const controls = container.querySelector<HTMLElement>(
      '[data-testid="videoPlaybackControls"]',
    )!
    pointer('pointerover', surface)
    video.playbackRate = 1.5

    pointer('pointerdown', surface)
    act(() => jest.advanceTimersByTime(100))
    pointer('pointerup', surface)
    click(surface)
    expect(video.paused).toBe(false)
    expect(video.playbackRate).toBe(1.5)
    expect(badge()).toBeNull()

    pointer('pointerdown', surface)
    act(() => jest.advanceTimersByTime(300))
    expect(video.playbackRate).toBe(2)
    expect(badge()?.textContent).toBe('2×')
    expect(controls.style.opacity).toBe('0')
    expect(controls.getAttribute('aria-hidden')).toBe('true')
    pointer('pointerup', surface)
    click(surface)
    expect(video.playbackRate).toBe(1.5)
    expect(video.paused).toBe(false)
    expect(badge()).toBeNull()
    expect(controls.style.opacity).toBe('1')
    expect(controls.getAttribute('aria-hidden')).toBeNull()
    act(() => {
      surface.dispatchEvent(
        new MouseEvent('dblclick', {bubbles: true, detail: 2}),
      )
    })
    expect(toggleFullscreen).not.toHaveBeenCalled()

    pointer('pointerdown', surface)
    act(() => jest.advanceTimersByTime(300))
    pointer('pointerup', document.body)
    expect(video.playbackRate).toBe(1.5)
    pointer('pointerdown', surface)
    pointer('pointerup', surface)
    click(surface)
    expect(video.paused).toBe(true)

    pointer('pointerdown', surface)
    act(() => jest.advanceTimersByTime(300))
    expect(video.paused).toBe(false)
    pointer('pointercancel', surface)
    expect(video.playbackRate).toBe(1.5)
    expect(video.paused).toBe(true)
    expect(badge()).toBeNull()

    pointer('pointerdown', surface, {pointerType: 'touch'})
    act(() => jest.advanceTimersByTime(400))
    expect(video.playbackRate).toBe(1.5)
    expect(badge()).toBeNull()
    pointer('pointerdown', surface, {button: 2})
    act(() => jest.advanceTimersByTime(400))
    expect(video.playbackRate).toBe(1.5)
    expect(badge()).toBeNull()

    pointer('pointerdown', surface)
    pointer('pointerup', surface)
    click(surface)
    pointer('pointerdown', surface)
    pointer('pointerup', surface)
    click(surface, 2)
    act(() => {
      surface.dispatchEvent(
        new MouseEvent('dblclick', {bubbles: true, detail: 2}),
      )
    })
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(video.paused).toBe(true)

    pointer('pointerdown', surface)
    act(() => jest.advanceTimersByTime(300))
    act(() => root.unmount())
    expect(video.playbackRate).toBe(1.5)
    expect(video.paused).toBe(true)
  } finally {
    act(() => root.unmount())
    container.remove()
    jest.restoreAllMocks()
    jest.useRealTimers()
  }
})
