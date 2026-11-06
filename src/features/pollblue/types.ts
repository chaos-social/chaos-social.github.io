export const POLLBLUE_HOST = 'poll.blue'
export const POLLBLUE_SPEC = 'blue.poll@0.1.0-alpha'
export const POLL_RECORD_COLLECTION = 'blue.poll.poll.poll'
export const OPTION_RECORD_COLLECTION = 'blue.poll.poll.option'
export const VOTE_RECORD_COLLECTION = 'blue.poll.poll.vote'
export const OPTION_FACET = 'blue.poll.post.facet#option'

/**
 * A `blue.poll.poll.poll` record as stored in the author's repo. Options carry
 * a `uri` only in `public` mode; centralized polls count votes on poll.blue and
 * leave the uri off.
 */
export type PollRecord = {
  uri: string
  cid: string
  question: string
  options: {text: string; uri?: string}[]
  /** `public` counts votes in voter repos; `centralized` counts on poll.blue. */
  mode: string
  endsAt?: string
  visibleId?: string
  /** Per-option tallies for a centralized poll; public polls use Constellation. */
  results?: number[]
}

/** Every option count for a poll, plus the viewer's own pick if there is one. */
export type PollVotes = {
  counts: number[]
  viewerIndex?: number
  total: number
}

/** What a poll post's own text and facets tell us, with no network involved. */
export type PollPostParts = {
  /** Visible id, or `did~rkey` for a public poll. */
  id: string
  options: {number: number; text: string}[]
  /** UTF-8 byte range of the whole options block (first option line to last). */
  optionsStart: number
  optionsEnd: number
  /** UTF-8 byte range of the trailing `Show results` line, if present. */
  resultsStart?: number
  resultsEnd?: number
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isPollRecord(v: unknown): v is PollRecord {
  if (!isObject(v)) return false
  if (
    typeof v.uri !== 'string' ||
    typeof v.cid !== 'string' ||
    typeof v.question !== 'string' ||
    typeof v.mode !== 'string' ||
    !Array.isArray(v.options) ||
    !v.options.every(
      o =>
        isObject(o) &&
        typeof o.text === 'string' &&
        (o.uri === undefined || typeof o.uri === 'string'),
    )
  ) {
    return false
  }
  return true
}
