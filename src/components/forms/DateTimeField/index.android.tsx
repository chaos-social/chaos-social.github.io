import {useState} from 'react'
import {Keyboard} from 'react-native'
import {
  DatePickerDialog,
  Host,
  TimePickerDialog,
} from '@expo/ui/jetpack-compose'
import {useLingui} from '@lingui/react'

import {useTheme} from '#/alf'
import {DateFieldButton} from '#/components/forms/DateField/index.shared'
import {type DateTimeFieldProps} from './types'
import {toDateTimeLocal} from './utils'

export * as utils from '#/components/forms/DateTimeField/utils'

/*
 * Material 3 has no datetime picker, so ask for the day and then the time in
 * two dialogs. Dismissing either one cancels the edit, like a cancelled
 * DateField.
 */
export function DateTimeField({
  value,
  onChangeDateTime,
  onConfirm,
  placeholder,
  label,
  isInvalid,
  accessibilityHint,
  minimumDate,
}: DateTimeFieldProps) {
  const {i18n} = useLingui()
  const t = useTheme()
  const fallback = minimumDate ?? new Date()
  const [step, setStep] = useState<'date' | 'time' | undefined>(undefined)
  const [draft, setDraft] = useState(() =>
    value ? new Date(value) : new Date(fallback),
  )

  const open = () => {
    Keyboard.dismiss()
    setDraft(value ? new Date(value) : new Date(fallback))
    setStep('date')
  }
  const close = () => setStep(undefined)

  /*
   * The Material date dialog selects UTC calendar days; keep the draft's local
   * day visible by handing it UTC midnight, and read the selection back the
   * same way while keeping the draft's time of day.
   */
  const onDateSelected = (date: Date) => {
    const next = new Date(draft)
    next.setFullYear(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    )
    setDraft(next)
    setStep('time')
  }
  const onTimeSelected = (date: Date) => {
    const next = new Date(draft)
    next.setHours(date.getHours(), date.getMinutes(), 0, 0)
    const formatted = toDateTimeLocal(next)
    setStep(undefined)
    onChangeDateTime(formatted)
    onConfirm?.(formatted)
  }

  return (
    <>
      <DateFieldButton
        label={label}
        value={value}
        format={v => i18n.date(v, {dateStyle: 'medium', timeStyle: 'short'})}
        placeholder={placeholder}
        onPress={open}
        isInvalid={isInvalid}
        accessibilityHint={accessibilityHint}
      />
      {step && (
        <Host colorScheme={t.scheme}>
          {step === 'date' ? (
            <DatePickerDialog
              initialDate={utcMidnight(draft).toISOString()}
              selectableDates={
                minimumDate ? {start: minimumDate} : undefined
              }
              showVariantToggle={false}
              onDateSelected={onDateSelected}
              onDismissRequest={close}
            />
          ) : (
            <TimePickerDialog
              initialDate={draft.toISOString()}
              onDateSelected={onTimeSelected}
              onDismissRequest={close}
            />
          )}
        </Host>
      )}
    </>
  )
}

/** Local calendar day as UTC midnight, the day Material's date dialog selects. */
function utcMidnight(date: Date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  )
}
