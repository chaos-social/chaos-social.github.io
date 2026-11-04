import {type Client} from '@atproto/lex'

import {type EventDraft} from '../event'
import {
  deleteEvent,
  ensureEvent,
  finalizeEvent,
  rsvpSelfGoing,
} from '../event-publish'

const URI = 'at://did:plc:alice/community.lexicon.calendar.event/3kevent'

const draft = (patch: Partial<EventDraft> = {}): EventDraft => ({
  name: 'Meetup',
  date: '2026-10-01',
  time: '18:00',
  timezone: 'Europe/Berlin',
  mode: 'inperson',
  ...patch,
})

function fakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    assertDid: 'did:plc:alice',
    createRecord: jest.fn(() =>
      Promise.resolve({body: {uri: URI, cid: 'cid-1'}}),
    ),
    putRecord: jest.fn(() => Promise.resolve({body: {uri: URI, cid: 'cid-2'}})),
    deleteRecord: jest.fn(() => Promise.resolve({})),
    ...overrides,
  } as unknown as Client
}

describe('ensureEvent', () => {
  it('overwrites a saved record in place instead of creating a new one', async () => {
    const client = fakeClient()
    const saved = {uri: URI, cid: 'saved'}
    const result = await ensureEvent(client, draft({record: saved}))
    expect(result).toEqual({uri: URI, cid: 'cid-2'})
    expect(client.createRecord).not.toHaveBeenCalled()
    expect(client.putRecord).toHaveBeenCalledWith(
      expect.objectContaining({name: 'Meetup'}),
      '3kevent',
      expect.objectContaining({repo: 'did:plc:alice', service: null}),
    )
  })

  it('falls back to a create when the saved record is gone', async () => {
    const client = fakeClient({
      putRecord: jest.fn(() => Promise.reject(new Error('gone'))),
    })
    const result = await ensureEvent(client, draft({record: {uri: URI, cid: 's'}}))
    expect(result).toEqual({uri: URI, cid: 'cid-1'})
    expect(client.createRecord).toHaveBeenCalled()
  })

  it('creates the event record in the account repo', async () => {
    const client = fakeClient()
    const result = await ensureEvent(client, draft())
    expect(result).toEqual({uri: URI, cid: 'cid-1'})
    const [record, , opts] = (
      client.createRecord as jest.Mock<
        unknown,
        [Record<string, unknown>, string | undefined, unknown]
      >
    ).mock.calls[0]
    expect(record.$type).toBe('community.lexicon.calendar.event')
    expect(record.name).toBe('Meetup')
    expect(opts).toMatchObject({repo: 'did:plc:alice', service: null})
  })
})

describe('finalizeEvent', () => {
  it('adds bskyPostRef and returns the new cid', async () => {
    const client = fakeClient()
    const postRef = {
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      cid: 'pcid',
    }
    const result = await finalizeEvent(
      client,
      {uri: URI, cid: 'cid-1'},
      postRef,
      draft(),
    )
    expect(result).toEqual({uri: URI, cid: 'cid-2'})
    const [record, rkey] = (
      client.putRecord as jest.Mock<unknown, [Record<string, unknown>, string]>
    ).mock.calls[0]
    expect(rkey).toBe('3kevent')
    expect(record.bskyPostRef).toEqual(postRef)
  })

  it('falls back to the original ref when the write fails', async () => {
    const client = fakeClient({
      putRecord: jest.fn(() => Promise.reject(new Error('boom'))),
    })
    const started = {uri: URI, cid: 'cid-1'}
    const result = await finalizeEvent(
      client,
      started,
      {uri: 'at://p', cid: 'pcid'},
      draft(),
    )
    expect(result).toEqual(started)
  })
})

describe('rsvpSelfGoing', () => {
  it('writes a going RSVP against the given ref', async () => {
    const client = fakeClient()
    await rsvpSelfGoing(client, {uri: URI, cid: 'final'})
    const [record] = (
      client.createRecord as jest.Mock<unknown, [Record<string, unknown>]>
    ).mock.calls[0]
    expect(record.$type).toBe('community.lexicon.calendar.rsvp')
    expect(record.status).toBe('community.lexicon.calendar.rsvp#going')
    expect(record.subject).toEqual({uri: URI, cid: 'final'})
  })

  it('swallows a failure so the post still succeeds', async () => {
    const client = fakeClient({
      createRecord: jest.fn(() => Promise.reject(new Error('boom'))),
    })
    await expect(
      rsvpSelfGoing(client, {uri: URI, cid: 'final'}),
    ).resolves.toBeUndefined()
  })
})

describe('deleteEvent', () => {
  it('deletes by rkey and swallows failures', async () => {
    const client = fakeClient()
    await deleteEvent(client, {uri: URI, cid: 'c'})
    expect(client.deleteRecord).toHaveBeenCalledWith(
      'community.lexicon.calendar.event',
      '3kevent',
      expect.objectContaining({repo: 'did:plc:alice'}),
    )

    const failing = fakeClient({
      deleteRecord: jest.fn(() => Promise.reject(new Error('boom'))),
    })
    await expect(
      deleteEvent(failing, {uri: URI, cid: 'c'}),
    ).resolves.toBeUndefined()
  })
})
