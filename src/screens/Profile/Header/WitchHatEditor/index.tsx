import {useRef, useState} from 'react'
import {Image, View} from 'react-native'
import Svg, {Path} from 'react-native-svg'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {type ImageMeta} from '#/state/gallery'
import {usePdsClient} from '#/state/session'
import {HAT_PATH, LOGO_VIEW_BOX} from '#/view/icons/Logo'
import {DragArea} from '#/screens/Profile/Header/WitchHatEditor/DragArea'
import {EditorSlider} from '#/screens/Profile/Header/WitchHatEditor/EditorSlider'
import {exportAvatar} from '#/screens/Profile/Header/WitchHatEditor/exportAvatar'
import {
  DEFAULT_HAT_COLOR,
  INITIAL_HAT_PLACEMENT,
  isOctober,
} from '#/screens/Profile/Header/WitchHatEditor/utils'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export function WitchHatEditor({
  control,
  avatar,
  onSave,
}: {
  control: Dialog.DialogControlProps
  avatar: string
  onSave: (image: ImageMeta) => void
}) {
  const [editingSession, setEditingSession] = useState(0)
  const active = useRef(false)
  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{fullHeight: true}}
      onOpen={() => {
        active.current = true
        setEditingSession(session => session + 1)
      }}
      onClose={() => {
        active.current = false
      }}
      testID="witchHatDialog">
      <EditorInner
        key={editingSession}
        avatar={avatar}
        onCancel={() => control.close()}
        onSave={image => {
          if (active.current) control.close(() => onSave(image))
        }}
      />
    </Dialog.Outer>
  )
}

function EditorInner({
  avatar,
  onCancel,
  onSave,
}: {
  avatar: string
  onCancel: () => void
  onSave: (image: ImageMeta) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const pdsClient = usePdsClient()
  const previewRef = useRef<React.ElementRef<typeof View>>(null)
  const [previewSize, setPreviewSize] = useState(0)
  const [placement, setPlacement] = useState(INITIAL_HAT_PLACEMENT)
  const [useOrange, setUseOrange] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const showOrangeToggle =
    t.palette.primary_500.toLowerCase() !== DEFAULT_HAT_COLOR.toLowerCase()
  const color =
    showOrangeToggle && useOrange ? DEFAULT_HAT_COLOR : t.palette.primary_500
  const hatSize = placement.size * previewSize

  async function save() {
    if (saving || !loaded || !previewSize) return
    if (!isOctober()) {
      setError(l`The witch hat editor is only available in October.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const image = await exportAvatar({
        previewRef,
        avatar,
        placement,
        color,
        pdsClient,
      })
      onSave(image)
    } catch (e) {
      logger.error('Failed to export witch hat avatar', {safeMessage: e})
      setError(l`Could not save your avatar. Please try again.`)
      setSaving(false)
    }
  }

  return (
    <Dialog.ScrollableInner
      label={l`Add a witch hat`}
      testID="witchHatEditor"
      contentContainerStyle={[a.px_xl, a.pt_0, a.gap_lg]}
      header={
        <Dialog.Header
          style={a.border_b_0}
          renderLeft={() => (
            <Button
              label={l`Cancel`}
              size="small"
              color="secondary"
              disabled={saving}
              onPress={onCancel}
              testID="witchHatCancelBtn">
              <ButtonText>
                <Trans>Cancel</Trans>
              </ButtonText>
            </Button>
          )}
          renderRight={() => (
            <Button
              label={l`Save witch hat avatar`}
              size="small"
              color="primary"
              disabled={saving || !loaded || !previewSize}
              onPress={save}
              testID="witchHatSaveBtn">
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
              {saving && <ButtonIcon icon={Loader} />}
            </Button>
          )}>
          <Dialog.HeaderText>
            <Trans>Witch hat</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <Text style={a.text_center}>
        <Trans>Drag the hat and adjust its size &amp; rotation!</Trans>
      </Text>
      <View style={[a.relative, a.w_full, a.self_center, {maxWidth: 320}]}>
        <View
          ref={previewRef}
          collapsable={false}
          onLayout={event => setPreviewSize(event.nativeEvent.layout.width)}
          style={[a.relative, a.overflow_hidden, {aspectRatio: 1}]}>
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: avatar}}
            resizeMode="cover"
            onLoad={() => {
              setLoaded(true)
              setError('')
            }}
            onError={() => {
              setLoaded(false)
              setError(
                l`Could not load your avatar. Choose a photo and try again.`,
              )
            }}
            style={[a.absolute, a.inset_0]}
          />
          <View
            pointerEvents="none"
            style={[
              a.absolute,
              {
                left: placement.x * previewSize - hatSize / 2,
                top: placement.y * previewSize - hatSize / 2,
                width: hatSize,
                height: hatSize,
                transform: [{rotate: `${placement.rotation}deg`}],
              },
            ]}>
            <Svg viewBox={LOGO_VIEW_BOX} width={hatSize} height={hatSize}>
              <Path d={HAT_PATH} fill={color} />
            </Svg>
          </View>
        </View>
        <DragArea
          placement={placement}
          previewSize={previewSize}
          disabled={saving}
          onChange={setPlacement}
        />
      </View>
      {error !== '' && (
        <Text accessibilityRole="alert" style={{color: t.palette.negative_500}}>
          {error}
        </Text>
      )}
      <PlacementControl
        label={l`Hat size`}
        testID="witchHatSizeSlider"
        value={placement.size}
        minimum={0.15}
        maximum={0.9}
        disabled={saving}
        onChange={size => setPlacement(current => ({...current, size}))}
      />
      <PlacementControl
        label={l`Hat rotation`}
        testID="witchHatRotationSlider"
        value={placement.rotation}
        minimum={-180}
        maximum={180}
        step={1}
        increment={5}
        disabled={saving}
        onChange={rotation => setPlacement(current => ({...current, rotation}))}
      />
      {showOrangeToggle && (
        <Toggle.Item
          name="orange-witch-hat"
          label={l`Use default orange`}
          value={useOrange}
          onChange={setUseOrange}
          disabled={saving}
          testID="witchHatOrangeToggle"
          style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
          <Toggle.LabelText>
            <Trans>Use default orange</Trans>
          </Toggle.LabelText>
          <Toggle.Switch />
        </Toggle.Item>
      )}
    </Dialog.ScrollableInner>
  )
}

function PlacementControl({
  label,
  testID,
  value,
  minimum = 0,
  maximum = 1,
  step = 0.01,
  increment = 0.02,
  disabled,
  onChange,
}: {
  label: string
  testID: string
  value: number
  minimum?: number
  maximum?: number
  step?: number
  increment?: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const {t: l} = useLingui()
  return (
    <View>
      <Text>{label}</Text>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <Button
          label={l`Decrease ${label}`}
          size="tiny"
          color="secondary"
          disabled={disabled || value <= minimum}
          onPress={() => onChange(Math.max(minimum, value - increment))}>
          <ButtonText>−</ButtonText>
        </Button>
        <View style={a.flex_1}>
          <EditorSlider
            label={label}
            testID={testID}
            value={value}
            minimum={minimum}
            maximum={maximum}
            step={step}
            disabled={disabled}
            onChange={onChange}
          />
        </View>
        <Button
          label={l`Increase ${label}`}
          size="tiny"
          color="secondary"
          disabled={disabled || value >= maximum}
          onPress={() => onChange(Math.min(maximum, value + increment))}>
          <ButtonText>+</ButtonText>
        </Button>
      </View>
    </View>
  )
}
