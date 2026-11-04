import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type EventDraft,
  type EventMode,
  getEventNameIssue,
} from '#/lib/api/event'
import {type PostAction} from '#/view/com/composer/state/composer'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {DateTimeField} from '#/components/forms/DateTimeField'
import * as dt from '#/components/forms/DateTimeField/utils'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'

export function EventEditor({
  event,
  dispatch,
}: {
  event: EventDraft
  dispatch: (action: PostAction) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const nameIssue = getEventNameIssue(event)
  const start = dt.fromEventParts(event.date, event.time)
  const end = event.endsDate
    ? dt.fromEventParts(event.endsDate, event.endsTime ?? '')
    : ''

  const update = (patch: Partial<EventDraft>) =>
    dispatch({type: 'embed_update_event', patch})

  return (
    <View
      testID="eventEditor"
      style={[
        a.mt_lg,
        a.p_md,
        a.gap_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_row, a.align_center, a.justify_between]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <CalendarIcon size="sm" fill={t.palette.primary_500} />
          <Text
            style={[
              a.text_xs,
              a.font_bold,
              {color: t.palette.primary_500, textTransform: 'uppercase'},
            ]}>
            <Trans comment="Heading of the event editor card in the post composer">
              Event
            </Trans>
          </Text>
        </View>
        <Button
          testID="removeEventBtn"
          label={l`Remove event`}
          size="tiny"
          variant="ghost"
          color="secondary"
          onPress={() => {
            ax.metric('composer:event:remove', {})
            dispatch({type: 'embed_remove_event'})
          }}>
          <ButtonText>
            <Trans>Remove</Trans>
          </ButtonText>
        </Button>
      </View>

      <View style={[a.gap_xs]}>
        <TextField.LabelText>
          <Trans>Event name</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={nameIssue !== null}>
          <TextField.Input
            testID="eventNameInput"
            label={l`Event name`}
            placeholder={l`Community meetup`}
            value={event.name}
            onChangeText={name => update({name})}
          />
        </TextField.Root>
        {nameIssue && (
          <Text
            testID="eventNameHint"
            style={[
              a.text_xs,
              nameIssue === 'empty'
                ? t.atoms.text_contrast_medium
                : {color: t.palette.negative_500},
            ]}>
            {nameIssue === 'invalid' ? (
              <Trans>This name contains characters that cannot be saved.</Trans>
            ) : nameIssue === 'too_long' ? (
              <Trans>This name is too long.</Trans>
            ) : (
              <Trans>Give your event a name.</Trans>
            )}
          </Text>
        )}
      </View>

      <View style={[a.gap_xs]}>
        <TextField.LabelText>
          <Trans>Starts</Trans>
        </TextField.LabelText>
        <DateTimeField
          testID="eventStartField"
          label={l`Event start`}
          value={start}
          onChangeDateTime={value => {
            const parts = dt.toEventParts(value)
            update({
              date: parts.date,
              time: parts.time,
              // An end before the new start no longer makes sense.
              ...(event.endsDate && event.endsDate < parts.date
                ? {endsDate: undefined, endsTime: undefined}
                : {}),
            })
          }}
          isInvalid={!start}
        />
      </View>

      <View style={[a.gap_xs]}>
        <View style={[a.flex_row, a.align_center, a.justify_between]}>
          <TextField.LabelText>
            <Trans>Ends</Trans>
          </TextField.LabelText>
          {event.endsDate ? (
            <Button
              testID="clearEventEndBtn"
              label={l`Remove end time`}
              size="tiny"
              variant="ghost"
              color="secondary"
              onPress={() =>
                update({endsDate: undefined, endsTime: undefined})
              }>
              <ButtonText>
                <Trans>Clear</Trans>
              </ButtonText>
            </Button>
          ) : null}
        </View>
        <DateTimeField
          testID="eventEndField"
          label={l`Event end`}
          value={end}
          placeholder={l`Optional`}
          minimumDate={start ? dt.fromDateTimeLocal(start) : undefined}
          onChangeDateTime={value => {
            const parts = dt.toEventParts(value)
            update({endsDate: parts.date, endsTime: parts.time})
          }}
        />
      </View>

      <View style={[a.gap_xs]}>
        <TextField.LabelText>
          <Trans>Where</Trans>
        </TextField.LabelText>
        <SegmentedControl.Root
          type="radio"
          size="small"
          label={l`Event type`}
          value={event.mode}
          onChange={(mode: EventMode) => update({mode})}>
          <SegmentedControl.Item label={l`In person`} value="inperson">
            <SegmentedControl.ItemText>
              <Trans>In person</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item label={l`Online`} value="virtual">
            <SegmentedControl.ItemText>
              <Trans>Online</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item label={l`Hybrid`} value="hybrid">
            <SegmentedControl.ItemText>
              <Trans>Hybrid</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </View>

      <TextField.Root>
        <TextField.Input
          testID="eventPlaceInput"
          label={event.mode === 'inperson' ? l`Location` : l`Location or link`}
          placeholder={
            event.mode === 'inperson'
              ? l`Venue or address`
              : l`Add a link or address people can join from`
          }
          value={event.place ?? ''}
          onChangeText={place => update({place})}
        />
      </TextField.Root>

      <TextField.Root>
        <TextField.Input
          testID="eventDescriptionInput"
          label={l`Description`}
          placeholder={l({
            message: 'Describe your event',
            comment:
              'Placeholder for the event description field in the composer',
          })}
          value={event.description ?? ''}
          onChangeText={description => update({description})}
          multiline
        />
      </TextField.Root>
    </View>
  )
}
