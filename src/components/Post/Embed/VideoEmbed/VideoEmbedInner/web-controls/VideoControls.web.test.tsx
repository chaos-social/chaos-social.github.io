/** @jest-environment jsdom */

import {act} from 'react'
import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {createRoot} from 'react-dom/client'

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
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => 'round',
}))
jest.mock('#/components/dms/MessageContext', () => ({
  useIsWithinMessage: () => false,
}))
jest.mock('#/components/hooks/useFullscreen', () => ({
  useFullscreen: () => [false, jest.fn()],
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
  const container = document.createElement('div')
  const video = document.createElement('video')
  const input = document.createElement('input')
  const otherPlayer = document.createElement('div')
  document.body.append(container, otherPlayer)
  container.append(video, input)
  Object.defineProperty(video, 'duration', {value: 60})
  Object.defineProperty(video, 'readyState', {value: 4})
  const pause = jest.spyOn(video, 'pause').mockImplementation(() => {})
  const play = jest.spyOn(video, 'play').mockResolvedValue()
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
            hasSubtitleTrack={false}
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
    otherPlayer.tabIndex = 0
    otherPlayer.focus()
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
