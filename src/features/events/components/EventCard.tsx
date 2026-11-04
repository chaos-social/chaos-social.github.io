import {View} from 'react-native'
import {AtUri} from '@atproto/api'
import {Trans, useLingui} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {eventLinkLabel, eventPhase} from '../format'
import {useEventQuery} from '../queries'
import {parseEventRecord} from '../record'
import {type EventView} from '../types'
import {makeEventLink} from '../url'
import {EventMeta} from './EventMeta'
import {Poster} from './Poster'
import {RsvpButtons} from './RsvpButtons'

export function EventCard({
  event: initial,
  badge,
  showPhase,
  showRsvp = true,
}: {
  event: EventView
  badge?: string
  showPhase?: boolean
  showRsvp?: boolean
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const shapePreference = useEnableSquareButtons()
  const {data} = useEventQuery(initial.uri, initial)
  const event = data ?? initial
  const parsed = parseEventRecord(event.record)
  if (!parsed) return null
  const phase = eventPhase(parsed, new Date())
  const href = makeEventLink(event.creator, new AtUri(event.uri).rkey)
  const sharp = shapePreference === 'sharp' && SHARP_CORNERS

  return (
    <View
      style={[
        a.rounded_md,
        a.border,
        a.overflow_hidden,
        t.atoms.border_contrast_low,
        sharp,
      ]}>
      <Link to={href} label={eventLinkLabel(i18n, event, parsed, phase)}>
        <View style={[a.flex_row, a.gap_md, a.p_md]}>
          <Poster event={event} parsed={parsed} size={64} style={sharp} />
          <View style={[a.flex_1, a.gap_xs]}>
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              {showPhase && phase && !parsed.cancelled && (
                <Text
                  style={[
                    a.text_xs,
                    a.font_bold,
                    phase === 'current'
                      ? t.atoms.text_contrast_high
                      : t.atoms.text_contrast_medium,
                  ]}>
                  {phase === 'upcoming' ? (
                    <Trans>Upcoming</Trans>
                  ) : (
                    <Trans>Happening now</Trans>
                  )}
                </Text>
              )}
              {(badge || parsed.cancelled) && (
                <Text
                  style={[
                    a.text_xs,
                    a.font_bold,
                    parsed.cancelled
                      ? {color: t.palette.negative_500}
                      : t.atoms.text_contrast_medium,
                  ]}>
                  {parsed.cancelled ? <Trans>Cancelled</Trans> : badge}
                </Text>
              )}
            </View>
            <Text
              emoji
              numberOfLines={2}
              style={[a.text_md, a.font_bold, a.leading_snug]}>
              {parsed.name}
            </Text>
            <EventMeta event={event} parsed={parsed} />
          </View>
        </View>
      </Link>
      {showRsvp && !parsed.cancelled && phase !== 'past' && (
        <View style={[a.px_md, a.pb_md]}>
          <RsvpButtons event={event} />
        </View>
      )}
    </View>
  )
}
