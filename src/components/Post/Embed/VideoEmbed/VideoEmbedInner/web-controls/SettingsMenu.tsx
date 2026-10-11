import {useCallback, useId, useRef, useState} from 'react'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import type Hls from 'hls.js'

import {codeToLanguageName} from '#/locale/helpers'
import {useSetSubtitlesEnabled, useSubtitlesEnabled} from '#/state/preferences'
import {atoms as a, useTheme, web} from '#/alf'
import {Button} from '#/components/Button'
import {CC_Stroke2_Corner0_Rounded as CaptionsIcon} from '#/components/icons/CC'
import {Download_Stroke2_Corner0_Rounded as DownloadIcon} from '#/components/icons/Download'
import {Play_Filled_Corner0_Rounded as SpeedIcon} from '#/components/icons/Play'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon} from '#/components/icons/SettingsGear2'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as QualityIcon} from '#/components/icons/SettingsSlider'
import * as Menu from '#/components/Menu'
import {type ItemIconProps} from '#/components/Menu/types'
import {Text} from '#/components/Typography'
import {useVideoPlaybackSpeed} from '../../useVideoPlaybackSpeed'

export function SettingsMenu({
  hlsRef,
  open,
  onOpenChange,
  onDownload,
  selectedSubtitle,
  onSubtitleChange,
}: {
  hlsRef: React.RefObject<Hls | null | undefined>
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: () => void
  selectedSubtitle: number
  onSubtitleChange: (index: number) => void
}) {
  const {_, i18n} = useLingui()
  const t = useTheme()
  const id = useId()
  const openAtPointerDown = useRef<boolean | null>(null)
  const subtitlesEnabled = useSubtitlesEnabled()
  const setSubtitlesEnabled = useSetSubtitlesEnabled()
  const [speed, selectSpeed] = useVideoPlaybackSpeed()
  const [quality, setQuality] = useState(-1)
  const [tracks, setTracks] = useState<Hls['subtitleTracks']>([])
  const [levels, setLevels] = useState<Hls['levels']>([])

  const control: Menu.MenuControlProps = {
    id,
    ref: {current: null},
    isOpen: open,
    open: () => {
      const hls = hlsRef.current
      setTracks([...(hls?.subtitleTracks ?? [])])
      setLevels([...(hls?.levels ?? [])])
      setQuality(hls?.autoLevelEnabled ? -1 : (hls?.loadLevel ?? -1))
      onOpenChange(true)
    },
    close: () => onOpenChange(false),
  }

  function options(
    label: string,
    value: string,
    icon: ItemIconProps['icon'],
    children: React.ReactNode,
  ) {
    return (
      <Menu.Submenu
        label={label}
        trigger={
          <>
            <Menu.ItemIcon icon={icon} />
            <Menu.ItemText>{label}</Menu.ItemText>
            <Text style={t.atoms.text_contrast_medium}>{value}</Text>
          </>
        }>
        {children}
      </Menu.Submenu>
    )
  }

  const qualityLabel = (index: number) => {
    const level = levels[index]
    return level?.height
      ? `${level.height}p`
      : `${Math.round((level?.bitrate ?? 0) / 1000)} kbps`
  }
  // As in the reference fork, prefer localized language names to manifest labels.
  const trackLabel = (index: number) => {
    const track = tracks[index]
    return track?.lang
      ? codeToLanguageName(track.lang, i18n.locale)
      : track?.name || _(msg`Track ${index + 1}`)
  }
  const selectSubtitle = (index: number) => {
    if (index >= 0) onSubtitleChange(index)
    setSubtitlesEnabled(index >= 0)
  }
  const selectQuality = useCallback(
    (index: number) => {
      if (hlsRef.current) hlsRef.current.currentLevel = index
      setQuality(index)
    },
    [hlsRef],
  )

  return (
    <Menu.Root control={control} modal={false}>
      <div
        onKeyDownCapture={() => {
          openAtPointerDown.current = null
        }}
        onPointerDownCapture={() => {
          openAtPointerDown.current = open
        }}
        onPointerCancel={() => {
          openAtPointerDown.current = null
        }}>
        <Menu.Trigger label={_(msg`Video settings`)}>
          {({props}) => (
            <Button
              {...props}
              onPress={() => {
                const wasOpen = openAtPointerDown.current
                openAtPointerDown.current = null
                if (wasOpen) control.close()
                else props.onPress?.()
              }}
              testID="videoSettingsBtn"
              label={_(msg`Video settings`)}
              variant="ghost"
              color="secondary"
              shape="round"
              style={[
                a.p_xs,
                {backgroundColor: 'transparent'},
                web({transition: 'background-color 0.1s'}),
              ]}
              hoverStyle={{backgroundColor: 'rgba(255, 255, 255, 0.2)'}}>
              <SettingsIcon width={20} fill={t.palette.white} aria-hidden />
            </Button>
          )}
        </Menu.Trigger>
      </div>
      <Menu.Outer
        {...web({side: 'top' as const, align: 'end' as const})}
        label={_(msg`Video settings`)}>
        {tracks.length > 0 &&
          options(
            _(msg`Captions`),
            subtitlesEnabled ? trackLabel(selectedSubtitle) : _(msg`Off`),
            CaptionsIcon,
            <>
              <Option
                value={-1}
                label={_(msg`Off`)}
                selected={!subtitlesEnabled}
                onSelect={selectSubtitle}
              />
              {tracks.map((_, index) => (
                <Option
                  key={index}
                  value={index}
                  label={trackLabel(index)}
                  selected={subtitlesEnabled && selectedSubtitle === index}
                  onSelect={selectSubtitle}
                />
              ))}
            </>,
          )}
        {options(
          _(msg`Playback speed`),
          `${speed}×`,
          SpeedIcon,
          <>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
              <Option
                key={rate}
                value={rate}
                label={rate === 1 ? _(msg`Normal`) : `${rate}×`}
                selected={speed === rate}
                onSelect={selectSpeed}
              />
            ))}
          </>,
        )}
        {levels.length > 1 &&
          options(
            _(msg`Quality`),
            quality === -1 ? _(msg`Auto`) : qualityLabel(quality),
            QualityIcon,
            <>
              <Option
                value={-1}
                label={_(msg`Auto`)}
                selected={quality === -1}
                onSelect={selectQuality}
              />
              {levels
                .map((_, index) => index)
                .reverse()
                .map(index => (
                  <Option
                    key={index}
                    value={index}
                    label={qualityLabel(index)}
                    selected={quality === index}
                    onSelect={selectQuality}
                  />
                ))}
            </>,
          )}
        {onDownload && (
          <>
            <Menu.Divider />
            <Menu.Item
              testID="videoDownloadBtn"
              label={_(msg`Download video`)}
              onPress={onDownload}>
              <Menu.ItemIcon icon={DownloadIcon} />
              <Menu.ItemText>{_(msg`Download video`)}</Menu.ItemText>
            </Menu.Item>
          </>
        )}
      </Menu.Outer>
    </Menu.Root>
  )
}

function Option({
  value,
  label,
  selected,
  onSelect,
}: {
  value: number
  label: string
  selected: boolean
  onSelect: (value: number) => void
}) {
  return (
    <Menu.Item
      label={label}
      accessibilityRole="radio"
      accessibilityState={{checked: selected}}
      onPress={() => onSelect(value)}>
      <Menu.ItemRadio selected={selected} />
      <Menu.ItemText>{label}</Menu.ItemText>
    </Menu.Item>
  )
}
