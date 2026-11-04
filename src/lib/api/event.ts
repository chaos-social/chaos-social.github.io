import {inspectText} from '#/lib/api/poll'

export const EVENT_NAME_MAX_BYTES = 1000

export type EventMode = 'inperson' | 'virtual' | 'hybrid'

export const EVENT_MODES: EventMode[] = ['inperson', 'virtual', 'hybrid']

/** A saved event record's identity, kept on the draft so a retry reuses it. */
export type EventRecordRef = {uri: string; cid: string}

export type EventDraft = {
  name: string
  description?: string
  /** Start date, `YYYY-MM-DD`, in the device timezone. */
  date: string
  /** Start time, `HH:mm` (24h), in the device timezone. */
  time: string
  /** Optional end, same formats as the start. */
  endsDate?: string
  endsTime?: string
  /** IANA zone captured when the draft was created. */
  timezone: string
  mode: EventMode
  /** Free-text place for in-person/hybrid, or a join URL. */
  place?: string
  record?: EventRecordRef
}

export type EventFieldIssue = 'empty' | 'too_long' | 'invalid'

const MODE_PREFIX = 'community.lexicon.calendar.event#'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

/** The device's IANA zone, e.g. `Europe/Berlin`. */
export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** `YYYY-MM-DD` + `HH:mm` in a zone, as an absolute instant. */
export function combineDateTime(date: string, time: string): Date | undefined {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return undefined
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (hour > 23 || minute > 59) return undefined
  // Local time: JS interprets the components in the device zone, which is the
  // zone the draft captured.
  const value = new Date(year, month - 1, day, hour, minute, 0, 0)
  return isNaN(value.getTime()) ? undefined : value
}

function getNameIssue(text: string): EventFieldIssue | null {
  const name = text.trim()
  if (name.length === 0) return 'empty'
  const {bytes, wellFormed, hasNul} = inspectText(name)
  if (!wellFormed || hasNul) return 'invalid'
  if (bytes > EVENT_NAME_MAX_BYTES) return 'too_long'
  return null
}

/** Returns the problem with the event name, or null when it is usable. */
export function getEventNameIssue(
  draft: Pick<EventDraft, 'name'>,
): EventFieldIssue | null {
  return getNameIssue(draft.name)
}

export function isEventDraftPublishable(draft: EventDraft): boolean {
  return (
    getNameIssue(draft.name) === null &&
    combineDateTime(draft.date, draft.time) !== undefined &&
    (!draft.endsDate && !draft.endsTime
      ? true
      : combineDateTime(draft.endsDate ?? '', draft.endsTime ?? '') !==
        undefined)
  )
}

export function eventModeValue(mode: EventMode): string {
  return `${MODE_PREFIX}${mode}`
}

function isWebUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const {protocol} = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Assembles the `community.lexicon.calendar.event` record, matching the shape
 * atmo.rsvp and Smoke Signal write. A place that is an http(s) URL becomes a
 * link, so online/hybrid events expose it as their join link; everything else
 * is stored as a location name.
 */
export function buildEventRecord(draft: EventDraft): {
  $type: 'community.lexicon.calendar.event'
  name: string
  description?: string
  startsAt: string
  endsAt?: string
  timezone: string
  mode: string
  status: string
  createdAt: string
  createdWith: string
  preferences: {showInDiscovery: true}
  locations?: {name: string}[]
  uris?: {uri: string; name?: string}[]
} {
  const startsAt = combineDateTime(draft.date, draft.time)
  if (!startsAt) throw new Error('Invalid event start')
  const endsAt = combineDateTime(draft.endsDate ?? '', draft.endsTime ?? '')

  const uris: {uri: string; name?: string}[] = []
  const locations: {name: string}[] = []
  const place = draft.place?.trim()
  if (place) {
    if (isWebUrl(place)) {
      uris.push({uri: place, name: 'Join'})
    } else {
      locations.push({name: place})
    }
  }

  const description = draft.description?.trim()
  return {
    $type: 'community.lexicon.calendar.event',
    name: draft.name.trim(),
    ...(description ? {description} : {}),
    startsAt: startsAt.toISOString(),
    ...(endsAt ? {endsAt: endsAt.toISOString()} : {}),
    timezone: draft.timezone,
    mode: eventModeValue(draft.mode),
    status: `${MODE_PREFIX}scheduled`,
    createdAt: new Date().toISOString(),
    createdWith: 'https://witchsky.app',
    preferences: {showInDiscovery: true},
    ...(locations.length ? {locations} : {}),
    ...(uris.length ? {uris} : {}),
  }
}

function decodeRecordRef(value: unknown): EventRecordRef | undefined {
  if (!isObject(value)) return undefined
  const {uri, cid} = value
  if (typeof uri !== 'string' || typeof cid !== 'string') return undefined
  return {uri, cid}
}

export function decodeEventDraft(value: unknown): EventDraft | undefined {
  if (!isObject(value)) return undefined
  const {name, date, time, timezone, mode} = value
  if (
    typeof name !== 'string' ||
    typeof date !== 'string' ||
    typeof time !== 'string' ||
    typeof timezone !== 'string' ||
    (mode !== 'inperson' && mode !== 'virtual' && mode !== 'hybrid')
  ) {
    return undefined
  }
  return {
    name,
    description:
      typeof value.description === 'string' ? value.description : undefined,
    date,
    time,
    endsDate: typeof value.endsDate === 'string' ? value.endsDate : undefined,
    endsTime: typeof value.endsTime === 'string' ? value.endsTime : undefined,
    timezone,
    mode,
    place: typeof value.place === 'string' ? value.place : undefined,
    record: decodeRecordRef(value.record),
  }
}
