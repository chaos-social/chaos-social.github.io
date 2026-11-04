import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {useRequireAuth} from '#/state/session'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import * as Toast from '#/components/Toast'
import {useRsvpMutation} from '../queries'
import {
  type EventView,
  RSVP_GOING,
  RSVP_INTERESTED,
  RSVP_NOTGOING,
  type RsvpStatus,
} from '../types'

export function RsvpButtons({
  event,
  size = 'small',
  fill,
  style,
}: {
  event: EventView
  size?: 'small' | 'large'
  /** Stretch to the parent's width and split it evenly, for centered layouts. */
  fill?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const {t: l} = useLingui()
  const requireAuth = useRequireAuth()
  const {mutate, isPending} = useRsvpMutation(event)
  const current = event.viewer?.rsvp?.status

  const onPress = (status: RsvpStatus) =>
    requireAuth(() =>
      mutate(
        {status, current: event.viewer?.rsvp},
        {
          onError: error => {
            logger.error('Failed to update RSVP', {safeMessage: error})
            Toast.show(l`Couldn't update your RSVP`, {type: 'error'})
          },
        },
      ),
    )

  const choices: {status: RsvpStatus; label: string; removeLabel: string}[] = [
    {status: RSVP_GOING, label: l`Going`, removeLabel: l`Going, tap to remove`},
    {
      status: RSVP_INTERESTED,
      label: l`Interested`,
      removeLabel: l`Interested, tap to remove`,
    },
    {
      status: RSVP_NOTGOING,
      label: l`Not going`,
      removeLabel: l`Not going, tap to remove`,
    },
  ]
  return (
    <View style={[a.flex_row, a.gap_sm, fill && a.w_full, style]}>
      {choices.map(choice => {
        const selected = current === choice.status
        return (
          <Button
            key={choice.status}
            label={selected ? choice.removeLabel : choice.label}
            size={size}
            color={selected ? 'primary' : 'secondary'}
            disabled={isPending}
            style={[a.flex_1, a.px_xs]}
            onPress={() => onPress(choice.status)}>
            {selected && <ButtonIcon icon={CheckIcon} />}
            <ButtonText>
              <Trans>{choice.label}</Trans>
            </ButtonText>
          </Button>
        )
      })}
    </View>
  )
}
