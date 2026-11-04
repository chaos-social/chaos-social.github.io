import {type Client} from '@atproto/lex'
import {AtUri} from '@atproto/syntax'

import {
  buildEventRecord,
  type EventDraft,
  type EventRecordRef,
} from '#/lib/api/event'
import {logger} from '#/logger'
import {
  EVENT_COLLECTION,
  RSVP_COLLECTION,
  RSVP_GOING,
} from '#/features/events/types'

/*
 * Events are created and updated outside the post's `applyWrites`: that batch
 * passes `validate: true`, and the community calendar lexicon is not bundled,
 * so an unknown collection could fail the whole post. Plain record writers go
 * to the PDS unproxied (`service: null`), like the RSVP write.
 */
type Nsid = `${string}.${string}.${string}`

/** The event write a fresh create or an update both share. */
function eventRecord(draft: EventDraft, extra?: Record<string, unknown>) {
  return {
    ...buildEventRecord(draft),
    ...extra,
  }
}

/**
 * Writes the event record, reusing a record a previous attempt already wrote
 * (the draft keeps the ref). Reusing means overwriting it in place, so edits
 * made between a failed attempt and the retry still land: the event page reads
 * the record while the post's link card is built from the draft, and the two
 * must agree.
 */
export async function ensureEvent(
  client: Client,
  draft: EventDraft,
): Promise<EventRecordRef> {
  const repo = client.assertDid
  const body = eventRecord(draft) as unknown as Record<string, unknown> & {
    $type: Nsid
  }
  body.$type = EVENT_COLLECTION
  if (draft.record) {
    /* If the record is gone (deleted elsewhere), start over rather than fail. */
    try {
      const res = await client.putRecord(
        body as never,
        new AtUri(draft.record.uri).rkey,
        {repo, service: null},
      )
      return {uri: res.body.uri, cid: res.body.cid}
    } catch {}
  }
  const res = await client.createRecord(body as never, undefined, {
    repo,
    service: null,
  })
  return {uri: res.body.uri, cid: res.body.cid}
}

/**
 * Adds `bskyPostRef`, which atmo-written events carry. Best effort: returns the
 * new ref when the write lands, otherwise the one we started with, so the RSVP
 * still points at a real record.
 */
export async function finalizeEvent(
  client: Client,
  ref: EventRecordRef,
  postRef: {uri: string; cid: string},
  draft: EventDraft,
): Promise<EventRecordRef> {
  try {
    const repo = client.assertDid
    const rkey = new AtUri(ref.uri).rkey
    const body = eventRecord(draft, {
      bskyPostRef: postRef,
    }) as unknown as Record<string, unknown> & {$type: Nsid}
    body.$type = EVENT_COLLECTION
    const res = await client.putRecord(body as never, rkey, {
      repo,
      service: null,
    })
    return {uri: res.body.uri, cid: res.body.cid}
  } catch (err) {
    logger.warn('Could not attach the post to the event', {safeMessage: err})
    return ref
  }
}

/**
 * Marks the author as going on the event they created. Best effort: a failure
 * here must not fail the post.
 */
export async function rsvpSelfGoing(
  client: Client,
  ref: EventRecordRef,
): Promise<void> {
  try {
    const repo = client.assertDid
    await client.createRecord(
      {
        $type: RSVP_COLLECTION,
        subject: ref,
        status: RSVP_GOING,
        createdAt: new Date().toISOString(),
      },
      undefined,
      {repo, service: null},
    )
  } catch (err) {
    logger.warn('Could not RSVP the author to the new event', {
      safeMessage: err,
    })
  }
}

/** Removes an event left behind by a post that never got written. */
export async function deleteEvent(
  client: Client,
  ref: EventRecordRef,
): Promise<void> {
  try {
    await client.deleteRecord(EVENT_COLLECTION, new AtUri(ref.uri).rkey, {
      repo: client.assertDid,
      service: null,
    })
  } catch (err) {
    logger.warn('Could not clean up an unsent event', {safeMessage: err})
  }
}
