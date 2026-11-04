import {forwardRef, useCallback} from 'react'
import {StyleSheet, type TextInput, type TextInputProps} from 'react-native'
// @ts-expect-error untyped
import {unstable_createElement} from 'react-native-web'

import * as TextField from '#/components/forms/TextField'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'
import {type DateTimeFieldProps} from './types'
import {fromDateTimeLocal, toDateTimeLocal} from './utils'

export * as utils from '#/components/forms/DateTimeField/utils'

const InputBase = forwardRef<HTMLInputElement, TextInputProps>(
  ({style, ...props}, ref) => {
    return unstable_createElement('input', {
      ...props,
      ref,
      type: 'datetime-local',
      step: 60,
      style: [
        StyleSheet.flatten(style),
        {background: 'transparent', border: 0},
      ],
    })
  },
)

InputBase.displayName = 'InputBase'

const Input = TextField.createInput(InputBase as unknown as typeof TextInput)

export function DateTimeField({
  value,
  onChangeDateTime,
  onConfirm,
  label,
  isInvalid,
  testID,
  accessibilityHint,
  minimumDate,
}: DateTimeFieldProps) {
  const handleOnChange = useCallback(
    (e: unknown) => {
      // The DOM change event isn't typed for react-native-web inputs.
      const next = (e as {target: {value: string}}).target.value
      if (fromDateTimeLocal(next)) {
        onChangeDateTime(next)
        onConfirm?.(next)
      }
    },
    [onChangeDateTime, onConfirm],
  )

  return (
    <TextField.Root isInvalid={isInvalid}>
      <TextField.Icon icon={CalendarDays} />
      <Input
        value={value}
        label={label}
        onChange={handleOnChange}
        testID={testID}
        accessibilityHint={accessibilityHint}
        // @ts-expect-error not typed as <input type="datetime-local">
        min={minimumDate ? toDateTimeLocal(minimumDate) : undefined}
      />
    </TextField.Root>
  )
}
