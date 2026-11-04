import {useState} from 'react'
import {Keyboard, Pressable, View} from 'react-native'
import {DateTimePicker} from '@expo/ui/community/datetime-picker'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'
import {Text} from '#/components/Typography'
import {type DateTimeFieldProps} from './types'
import {toDateTimeLocal} from './utils'

export * as utils from '#/components/forms/DateTimeField/utils'

/**
 * Date and time input, value in the local `YYYY-MM-DDTHH:mm` form. iOS and
 * Android open a datetime spinner; web uses the platform picker.
 */
export function DateTimeField({
  value,
  onChangeDateTime,
  onConfirm,
  placeholder,
  label,
  isInvalid,
  testID,
  accessibilityHint,
  minimumDate,
}: DateTimeFieldProps) {
  const {_, i18n} = useLingui()
  const t = useTheme()
  const shapePreference = useEnableSquareButtons()
  const control = Dialog.useDialogControl()
  const fallback = minimumDate ?? new Date()
  const [draft, setDraft] = useState(() =>
    value ? new Date(value) : new Date(fallback),
  )
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()
  const {
    state: hovered,
    onIn: onHoverIn,
    onOut: onHoverOut,
  } = useInteractionState()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {chromeHover, chromeFocus, chromeError, chromeErrorHover} =
    TextField.useSharedInputStyles()

  const open = () => {
    Keyboard.dismiss()
    setDraft(value ? new Date(value) : new Date(fallback))
    control.open()
  }

  return (
    <>
      <View
        style={[a.relative, a.w_full]}
        {...web({onMouseOver: onHoverIn, onMouseOut: onHoverOut})}>
        <Pressable
          aria-label={label}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityRole="button"
          onPress={open}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onFocus={onFocus}
          onBlur={onBlur}
          style={[
            {
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 10,
              paddingBottom: 10,
              borderColor: 'transparent',
              borderWidth: 1,
            },
            a.flex_row,
            a.flex_1,
            a.w_full,
            a.align_center,
            {borderRadius: 10},
            t.atoms.bg_contrast_50,
            hovered ? chromeHover : {},
            focused || pressed ? chromeFocus : {},
            isInvalid ? chromeError : {},
            isInvalid && (hovered || focused) ? chromeErrorHover : {},
            shapePreference === 'sharp' && SHARP_CORNERS,
          ]}>
          <TextField.Icon icon={CalendarDays} />
          <Text
            style={[
              a.text_md,
              a.pl_xs,
              value ? t.atoms.text : t.atoms.text_contrast_low,
              {lineHeight: a.text_md.fontSize * 1.1875},
            ]}>
            {value
              ? i18n.date(value, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : placeholder}
          </Text>
        </Pressable>
      </View>
      <Dialog.Outer
        control={control}
        testID={testID}
        nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <Dialog.ScrollableInner label={label}>
          <View style={a.gap_lg}>
            <View style={[a.relative, a.w_full, a.align_center]}>
              <DateTimePicker
                style={a.w_full}
                value={draft}
                onValueChange={(_event, date) => {
                  if (date) setDraft(date)
                }}
                mode="datetime"
                display="spinner"
                themeVariant={t.scheme}
                locale={i18n.locale.replace(/-/g, '_')}
                testID={`${testID}-datetimepicker`}
                minimumDate={minimumDate}
              />
            </View>
            <Button
              label={_(msg`Done`)}
              onPress={() => {
                const next = toDateTimeLocal(draft)
                onChangeDateTime(next)
                onConfirm?.(next)
                control.close()
              }}
              size="large"
              color="primary"
              variant="solid">
              <ButtonText>
                <Trans>Done</Trans>
              </ButtonText>
            </Button>
          </View>
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}
