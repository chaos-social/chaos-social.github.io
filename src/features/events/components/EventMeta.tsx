import {View} from 'react-native'
import {msg, plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useTheme} from '#/alf'
import {AvatarStack} from '#/components/AvatarStack'
import {Clock_Stroke2_Corner0_Rounded as ClockIcon} from '#/components/icons/Clock'
import {Globe_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {Pin_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/Pin'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {eventPlace, formatEventTime} from '../format'
import {useRsvpsQuery} from '../queries'
import {type ParsedEvent} from '../record'
import {
  type EventView,
  RSVP_GOING,
  RSVP_INTERESTED,
  type RsvpView,
} from '../types'
import {LiveWatchButton} from './LiveWatchButton'

export function EventMeta({
  event,
  parsed,
}: {
  event: EventView
  parsed: ParsedEvent
}) {
  const t = useTheme()
  const {_, i18n} = useLingui()
  const time = formatEventTime(i18n, parsed)
  const place = eventPlace(_, parsed)

  return (
    <View style={[a.gap_xs]}>
      {time && (
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <ClockIcon size="sm" style={[t.atoms.text_contrast_medium]} />
          <Text
            numberOfLines={2}
            style={[a.text_sm, t.atoms.text_contrast_medium, a.flex_1]}>
            {time.primary}
            {time.local ? ` · ${_(msg`${time.local} your time`)}` : ''}
          </Text>
        </View>
      )}
      {place && (
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          {parsed.location ? (
            <PinIcon size="sm" style={[t.atoms.text_contrast_medium]} />
          ) : (
            <GlobeIcon size="sm" style={[t.atoms.text_contrast_medium]} />
          )}
          <Text
            numberOfLines={1}
            style={[a.text_sm, t.atoms.text_contrast_medium, a.flex_1]}>
            {place}
          </Text>
          <LiveWatchButton parsed={parsed} />
        </View>
      )}
      <RsvpCounts event={event} />
    </View>
  )
}

/**
 * Going and interested in one row, with each status's own avatars stacked
 * separately so the two groups never mix.
 */
function RsvpCounts({event}: {event: EventView}) {
  const t = useTheme()
  const going = useRsvpsQuery(event.uri, RSVP_GOING)
  const interested = useRsvpsQuery(event.uri, RSVP_INTERESTED)
  const goingAvatars = profilesOf(going.data?.rsvps)
  const interestedAvatars = profilesOf(interested.data?.rsvps)

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm, a.pt_2xs]}>
      <CountRow
        label={plural(event.goingCount, {
          one: '# going',
          other: '# going',
        })}
        avatars={goingAvatars}
      />
      {event.interestedCount > 0 && (
        <>
          <Text style={[a.text_sm, t.atoms.text_contrast_low]}>·</Text>
          <CountRow
            label={plural(event.interestedCount, {
              one: '# interested',
              other: '# interested',
            })}
            avatars={interestedAvatars}
          />
        </>
      )}
    </View>
  )
}

function CountRow({
  label,
  avatars,
}: {
  label: string
  avatars: app.bsky.actor.defs.ProfileViewBasic[]
}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {avatars.length > 0 && <AvatarStack profiles={avatars} size={20} />}
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
    </View>
  )
}

function profilesOf(rsvps: RsvpView[] | undefined) {
  return (rsvps ?? []).map(rsvp => rsvp.actor)
}
