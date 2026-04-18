import {Text as RNText} from 'react-native'

type UITextViewProps = React.ComponentProps<typeof RNText> & {
  dataSet?: Record<string, string | number | undefined>
  uiTextView?: boolean
}

export function UITextView({
  children,
  dataSet,
  uiTextView: _uiTextView,
  ...rest
}: UITextViewProps) {
  const textProps = dataSet ? ({...rest, dataSet} as UITextViewProps) : rest

  return <RNText {...textProps}>{children}</RNText>
}
