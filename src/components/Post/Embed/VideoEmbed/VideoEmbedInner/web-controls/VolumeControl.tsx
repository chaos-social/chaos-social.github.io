import {useCallback, useRef} from 'react'
import {View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a} from '#/alf'
import {Mute_Stroke2_Corner0_Rounded as MuteIcon} from '#/components/icons/Mute'
import {SpeakerVolumeFull_Stroke2_Corner0_Rounded as UnmuteIcon} from '#/components/icons/SpeakerVolumeFull'
import {useVideoVolumeState} from '#/components/Post/Embed/VideoEmbed/VideoVolumeContext'
import {IS_WEB_SAFARI, IS_WEB_TOUCH_DEVICE} from '#/env'
import {ControlButton} from './ControlButton'

export function VolumeControl({
  muted,
  changeMuted,
  hovered,
  onHover,
  onEndHover,
  drawFocus,
  onKeyboardVolumeChange,
}: {
  muted: boolean
  changeMuted: (muted: boolean | ((prev: boolean) => boolean)) => void
  hovered: boolean
  onHover: () => void
  onEndHover: () => void
  onKeyboardVolumeChange: (volume: number, muted: boolean) => void
  drawFocus: () => void
}) {
  const keyboardInputRef = useRef(false)
  const shapePreference = useEnableSquareButtons()

  const {t: l} = useLingui()
  const [volume, setVolume] = useVideoVolumeState()

  const onVolumeChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      drawFocus()
      const vol = sliderVolumeToVideoVolume(Number(evt.target.value))
      setVolume(vol)
      changeMuted(vol === 0)
      if (keyboardInputRef.current) onKeyboardVolumeChange(vol, vol === 0)
    },
    [setVolume, drawFocus, changeMuted, onKeyboardVolumeChange],
  )

  const sliderVolume = muted ? 0 : videoVolumeToSliderVolume(volume)

  const isZeroVolume = volume === 0
  const onPressMute = useCallback(() => {
    drawFocus()
    if (isZeroVolume) {
      setVolume(1)
      changeMuted(false)
    } else {
      changeMuted(prevMuted => !prevMuted)
    }
  }, [drawFocus, setVolume, isZeroVolume, changeMuted])

  return (
    <View
      onPointerEnter={onHover}
      onPointerLeave={onEndHover}
      style={[a.relative]}>
      {hovered && !IS_WEB_TOUCH_DEVICE && (
        <Animated.View
          entering={FadeIn.duration(100)}
          exiting={FadeOut.duration(100)}
          style={[a.absolute, a.w_full, {height: 100, bottom: '100%'}]}>
          <View
            style={[
              a.flex_1,
              a.mb_xs,
              a.px_2xs,
              a.py_xs,
              {backgroundColor: 'rgba(0, 0, 0, 0.6)'},
              a.rounded_xs,
              a.align_center,
              shapePreference === 'sharp' && SHARP_CORNERS,
            ]}>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderVolume}
              aria-label={l`Volume`}
              data-no-carousel-drag=""
              style={
                // Ridiculous safari hack for old version of safari. Fixed in sonoma beta -h
                IS_WEB_SAFARI
                  ? {height: 92, minHeight: '100%'}
                  : {height: '100%'}
              }
              onKeyDown={() => {
                keyboardInputRef.current = true
              }}
              onPointerDown={() => {
                keyboardInputRef.current = false
              }}
              onBlur={() => {
                keyboardInputRef.current = false
              }}
              onChange={onVolumeChange}
              // @ts-expect-error for old versions of firefox, and then re-using it for targeting the CSS -sfn
              orient="vertical"
            />
          </View>
        </Animated.View>
      )}
      <ControlButton
        active={muted || volume === 0}
        activeLabel={l({message: `Unmute`, context: 'video'})}
        inactiveLabel={l({message: `Mute`, context: 'video'})}
        activeIcon={MuteIcon}
        inactiveIcon={UnmuteIcon}
        onPress={onPressMute}
      />
    </View>
  )
}

function sliderVolumeToVideoVolume(value: number) {
  return Math.pow(value / 100, 4)
}

export function videoVolumeToSliderVolume(value: number) {
  return Math.round(Math.pow(value, 1 / 4) * 100)
}
