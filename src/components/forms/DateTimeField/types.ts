export type DateTimeFieldProps = {
  /**
   * A local datetime string in the `YYYY-MM-DDTHH:mm` form (what a web
   * `datetime-local` input uses). An empty string renders the placeholder.
   */
  value: string
  onChangeDateTime: (value: string) => void
  /** Fired when the user commits a value (iOS "Done", web change). */
  onConfirm?: (value: string) => void
  placeholder?: string
  label: string
  isInvalid?: boolean
  testID?: string
  accessibilityHint?: string
  minimumDate?: Date
}
