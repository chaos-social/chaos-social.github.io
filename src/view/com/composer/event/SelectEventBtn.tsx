import {useCallback} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {useAnalytics} from '#/analytics'

type Props = {
  onPress: () => void
  disabled?: boolean
}

export function SelectEventBtn({onPress, disabled}: Props) {
  const ax = useAnalytics()
  const {t: l} = useLingui()
  const t = useTheme()

  const onPressAddEvent = useCallback(() => {
    ax.metric('composer:event:open', {})
    onPress()
  }, [ax, onPress])

  return (
    <View style={[a.relative]}>
      <Button
        testID="openEventBtn"
        onPress={onPressAddEvent}
        label={l({
          message: 'Add event',
          comment:
            'Accessibility label for the button in the post composer that creates an event attached to the post.',
        })}
        accessibilityHint={l({
          message: 'Creates an event attached to this post',
          comment:
            'Accessibility hint announced after the event button label, describing what activating it will do.',
        })}
        style={a.p_sm}
        variant="ghost"
        shape="round"
        color="primary"
        disabled={disabled}>
        <CalendarIcon size="lg" style={disabled && t.atoms.text_contrast_low} />
      </Button>
    </View>
  )
}
