import {type I18n} from '@lingui/core'
import {msg, plural} from '@lingui/core/macro'

import {type ParsedEvent} from './record'
import {type EventView} from './types'

const format = (i18n: I18n, date: Date, options: Intl.DateTimeFormatOptions) =>
  i18n.date(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...options,
  })

/** The calendar day a moment falls on, in a given (or the device's) zone. */
const dayKey = (i18n: I18n, date: Date, timeZone?: string) =>
  i18n.date(date, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...(timeZone ? {timeZone} : {}),
  })

/**
 * The start time in the event's own timezone, plus the viewer's local time
 * when that differs, so an in-person event reads the way the host wrote it.
 *
 * The local part drops the date when both zones fall on the same day, since
 * `primary` already shows it and repeating it overflowed the feed card. When
 * the zones fall on different days the date is kept, so "7:00 PM" is not read
 * as the same day as the event.
 */
export function formatEventTime(
  i18n: I18n,
  event: ParsedEvent,
): {primary: string; local?: string} | undefined {
  if (!event.startsAt) return
  const local = format(i18n, event.startsAt, {})
  if (!event.timezone) return {primary: local}
  const inEventZone = format(i18n, event.startsAt, {timeZone: event.timezone})
  if (inEventZone === local) return {primary: local}
  const sameDay =
    dayKey(i18n, event.startsAt) ===
    dayKey(i18n, event.startsAt, event.timezone)
  return {
    primary: inEventZone,
    local: sameDay
      ? format(i18n, event.startsAt, {
          weekday: undefined,
          month: undefined,
          day: undefined,
        })
      : local,
  }
}

export type EventPhase = 'upcoming' | 'current' | 'past'

// Most events don't publish an end time; treat them as running this long.
const ASSUMED_DURATION_MS = 4 * 60 * 60 * 1000

export function eventPhase(
  event: ParsedEvent,
  now: Date,
): EventPhase | undefined {
  if (!event.startsAt) return
  if (now < event.startsAt) return 'upcoming'
  const end =
    event.endsAt ?? new Date(event.startsAt.getTime() + ASSUMED_DURATION_MS)
  return now < end ? 'current' : 'past'
}

export type EventDateParts = {
  month: string
  day: string
  longDate: string
  timeRange: string
}

/** Date pieces for large date displays, in the event's own timezone. */
export function eventDateParts(
  i18n: I18n,
  event: ParsedEvent,
): EventDateParts | undefined {
  if (!event.startsAt) return
  const timeZone = event.timezone
  const part = (options: Intl.DateTimeFormatOptions, date: Date) =>
    i18n.date(date, {...options, timeZone})
  const time = {hour: 'numeric', minute: '2-digit'} as const
  const start = part(time, event.startsAt)
  const zone = part({timeZoneName: 'short'}, event.startsAt).split(' ').pop()
  const dayKey = (date: Date) =>
    part({year: 'numeric', month: 'numeric', day: 'numeric'}, date)
  const end = !event.endsAt
    ? undefined
    : dayKey(event.endsAt) === dayKey(event.startsAt)
      ? part(time, event.endsAt)
      : part(
          {weekday: 'short', month: 'short', day: 'numeric', ...time},
          event.endsAt,
        )
  return {
    month: part({month: 'short'}, event.startsAt).toUpperCase(),
    day: part({day: 'numeric'}, event.startsAt),
    longDate: part(
      {weekday: 'long', month: 'long', day: 'numeric'},
      event.startsAt,
    ),
    timeRange: `${end ? `${start} – ${end}` : start} ${zone ?? ''}`.trim(),
  }
}

export function eventPlace(_: I18n['_'], parsed: ParsedEvent) {
  return (
    parsed.location ??
    (parsed.mode === 'virtual' || parsed.streamplaceUrl
      ? _(msg`Online`)
      : undefined)
  )
}

// Cards wrap their details in one link, so screen readers only hear its label.
export function eventLinkLabel(
  i18n: I18n,
  event: EventView,
  parsed: ParsedEvent,
  phase?: EventPhase,
) {
  const _ = i18n._.bind(i18n)
  const status = parsed.cancelled
    ? _(msg`Cancelled`)
    : phase === 'current'
      ? _(msg`Happening now`)
      : phase === 'past'
        ? _(msg`Past`)
        : undefined
  return [
    _(msg`View event ${parsed.name}`),
    status,
    formatEventTime(i18n, parsed)?.primary,
    eventPlace(_, parsed),
    plural(event.goingCount, {one: '# going', other: '# going'}),
    event.interestedCount > 0
      ? plural(event.interestedCount, {
          one: '# interested',
          other: '# interested',
        })
      : undefined,
  ]
    .filter(Boolean)
    .join(', ')
}
