import {describe, expect, it} from '@jest/globals'

import {
  buildEventRecord,
  combineDateTime,
  decodeEventDraft,
  type EventDraft,
  getEventNameIssue,
  isEventDraftPublishable,
} from '../event'

const draft = (patch: Partial<EventDraft> = {}): EventDraft => ({
  name: 'Block party',
  date: '2026-10-01',
  time: '18:00',
  timezone: 'Europe/Berlin',
  mode: 'inperson',
  ...patch,
})

describe('combineDateTime', () => {
  it('reads the components as local time', () => {
    const date = combineDateTime('2026-10-01', '18:30')
    expect(date).toBeInstanceOf(Date)
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(9)
    expect(date?.getDate()).toBe(1)
    expect(date?.getHours()).toBe(18)
    expect(date?.getMinutes()).toBe(30)
  })

  it('rejects malformed or out-of-range values', () => {
    expect(combineDateTime('2026-10-01', '')).toBe(undefined)
    expect(combineDateTime('', '18:00')).toBe(undefined)
    expect(combineDateTime('2026-10-01', '24:00')).toBe(undefined)
    expect(combineDateTime('2026-10-01', '18:60')).toBe(undefined)
    expect(combineDateTime('next tuesday', '18:00')).toBe(undefined)
  })
})

describe('getEventNameIssue', () => {
  it('requires a name', () => {
    expect(getEventNameIssue({name: ''})).toBe('empty')
    expect(getEventNameIssue({name: '   '})).toBe('empty')
    expect(getEventNameIssue({name: 'Meetup'})).toBe(null)
  })

  it('rejects text that cannot be saved', () => {
    expect(getEventNameIssue({name: 'a\u0000b'})).toBe('invalid')
  })
})

describe('isEventDraftPublishable', () => {
  it('needs a name and a valid start', () => {
    expect(isEventDraftPublishable(draft())).toBe(true)
    expect(isEventDraftPublishable(draft({name: ''}))).toBe(false)
    expect(isEventDraftPublishable(draft({time: ''}))).toBe(false)
  })

  it('validates the end only when one is given', () => {
    expect(
      isEventDraftPublishable(
        draft({endsDate: '2026-10-01', endsTime: '20:00'}),
      ),
    ).toBe(true)
    expect(
      isEventDraftPublishable(draft({endsDate: '2026-10-01', endsTime: ''})),
    ).toBe(false)
    expect(isEventDraftPublishable(draft({endsDate: '2026-10-01'}))).toBe(false)
  })
})

describe('buildEventRecord', () => {
  it('maps an in-person place to a location and uses the mode value', () => {
    const record = buildEventRecord(draft({place: '  The Park '}))
    expect(record.name).toBe('Block party')
    expect(record.mode).toBe('community.lexicon.calendar.event#inperson')
    expect(record.status).toBe('community.lexicon.calendar.event#scheduled')
    expect(record.timezone).toBe('Europe/Berlin')
    expect(record.locations).toEqual([{name: 'The Park'}])
    expect(record.uris).toBe(undefined)
    expect(record.preferences).toEqual({showInDiscovery: true})
    expect(new Date(record.startsAt).getHours()).toBe(18)
  })

  it('maps an http place to a join link', () => {
    const record = buildEventRecord(
      draft({mode: 'virtual', place: 'https://meet.example.com/x'}),
    )
    expect(record.mode).toBe('community.lexicon.calendar.event#virtual')
    expect(record.uris).toEqual([
      {uri: 'https://meet.example.com/x', name: 'Join'},
    ])
    expect(record.locations).toBe(undefined)
  })

  it('keeps a non-URL place as a location even for online events', () => {
    const record = buildEventRecord(draft({mode: 'hybrid', place: 'The Park'}))
    expect(record.locations).toEqual([{name: 'The Park'}])
    expect(record.uris).toBe(undefined)
  })

  it('includes the end and description only when present', () => {
    const withoutEnd = buildEventRecord(draft())
    expect('endsAt' in withoutEnd).toBe(false)
    expect('description' in withoutEnd).toBe(false)

    const withExtras = buildEventRecord(
      draft({
        description: ' Bring snacks ',
        endsDate: '2026-10-01',
        endsTime: '20:00',
      }),
    )
    expect(withExtras.description).toBe('Bring snacks')
    expect(new Date(withExtras.endsAt!).getHours()).toBe(20)
  })

  it('throws on an invalid start rather than writing a broken record', () => {
    expect(() => buildEventRecord(draft({time: ''}))).toThrow()
  })
})

describe('decodeEventDraft', () => {
  it('round-trips a draft with its record ref', () => {
    const value = {
      ...draft(),
      record: {
        uri: 'at://did:plc:x/community.lexicon.calendar.event/1',
        cid: 'c',
      },
    }
    expect(decodeEventDraft(value)).toMatchObject({
      name: 'Block party',
      mode: 'inperson',
      record: {uri: value.record.uri, cid: 'c'},
    })
  })

  it('drops values that are not a usable draft', () => {
    expect(decodeEventDraft(null)).toBe(undefined)
    expect(decodeEventDraft({name: 'x'})).toBe(undefined)
    expect(decodeEventDraft({...draft(), mode: 'somewhere'})).toBe(undefined)
  })
})
