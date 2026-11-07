import {countGraphemes, graphemeSegments} from 'unicode-segmenter/grapheme'

/** TOKIMEKI's composer lets a poll have two to four choices. */
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 4
/** Length cap of TOKIMEKI's own option field. */
export const POLL_OPTION_MAX_CHARS = 100

/** Values on a People's Assembly statement vote; kept for old conversations. */
export const POLL_VOTE_VALUES = ['agree', 'disagree', 'pass'] as const
export type PollVoteValue = (typeof POLL_VOTE_VALUES)[number]

export const POLL_DURATIONS = ['1h', '6h', '12h', '1d', '3d', '7d'] as const
export type PollDuration = (typeof POLL_DURATIONS)[number]
export const DEFAULT_POLL_DURATION: PollDuration = '1d'

const POLL_DURATION_MS: Record<PollDuration, number> = {
  '1h': 60 * 60e3,
  '6h': 6 * 60 * 60e3,
  '12h': 12 * 60 * 60e3,
  '1d': 24 * 60 * 60e3,
  '3d': 3 * 24 * 60 * 60e3,
  '7d': 7 * 24 * 60 * 60e3,
}

/** The poll's closing time, as `tech.tokimeki.poll.poll` stores it. */
export function pollEndsAt(duration: PollDuration, now: Date): string {
  return new Date(now.getTime() + POLL_DURATION_MS[duration]).toISOString()
}

/**
 * The choices and closing time of a poll being composed. The post text is the
 * question; it is not stored on the poll record.
 */
export type PollDraft = {
  options: string[]
  duration: PollDuration
  /** Record key assigned while publishing; never stored on a draft. */
  rkey?: string
}

export type PollOptionIssue = 'empty' | 'too_long' | 'invalid'

// Kept for the People's Assembly card, which shows the topic the post text
// asked so the two do not repeat each other.
export const POLL_TOPIC_MAX_GRAPHEMES = 200
export const POLL_TOPIC_MAX_BYTES = 1000

const TRUNCATION_MARK = '…'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function inspectText(text: string): {
  bytes: number
  wellFormed: boolean
  hasNul: boolean
} {
  let bytes = 0
  let wellFormed = true
  let hasNul = false
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i)
    if (unit === 0) hasNul = true
    if (unit < 0x80) {
      bytes += 1
    } else if (unit < 0x800) {
      bytes += 2
    } else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else {
        wellFormed = false
        bytes += 3
      }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      wellFormed = false
      bytes += 3
    } else {
      bytes += 3
    }
  }
  return {bytes, wellFormed, hasNul}
}

export function normalizePollText(text: string): string {
  return text.trim().normalize('NFC')
}

export function normalizePollOption(text: string): string {
  return normalizePollText(text)
}

export function getOptionIssue(text: string): PollOptionIssue | null {
  const option = normalizePollOption(text)
  if (option.length === 0) return 'empty'
  const {wellFormed, hasNul} = inspectText(option)
  if (!wellFormed || hasNul) return 'invalid'
  if (option.length > POLL_OPTION_MAX_CHARS) return 'too_long'
  return null
}

export function getOptionIssues(
  options: string[],
): (PollOptionIssue | null)[] {
  return options.map(getOptionIssue)
}

export function isPollDraftPublishable(draft: PollDraft): boolean {
  return (
    draft.options.length >= POLL_MIN_OPTIONS &&
    draft.options.length <= POLL_MAX_OPTIONS &&
    getOptionIssues(draft.options).every(issue => issue === null)
  )
}

export function pollOptionsForPublish(draft: PollDraft): string[] {
  return draft.options.map(normalizePollOption)
}

export function isPollDuration(value: unknown): value is PollDuration {
  return (
    typeof value === 'string' &&
    (POLL_DURATIONS as readonly string[]).includes(value)
  )
}

export function pollTopicFromText(text: string): string {
  const topic = normalizePollText(text).replace(/\s+/g, ' ')
  if (
    countGraphemes(topic) <= POLL_TOPIC_MAX_GRAPHEMES &&
    inspectText(topic).bytes <= POLL_TOPIC_MAX_BYTES
  ) {
    return topic
  }
  const markBytes = inspectText(TRUNCATION_MARK).bytes
  let kept = ''
  let graphemes = 0
  let bytes = 0
  for (const {segment} of graphemeSegments(topic)) {
    const segmentBytes = inspectText(segment).bytes
    if (
      graphemes + 1 > POLL_TOPIC_MAX_GRAPHEMES - 1 ||
      bytes + segmentBytes > POLL_TOPIC_MAX_BYTES - markBytes
    ) {
      break
    }
    kept += segment
    graphemes += 1
    bytes += segmentBytes
  }
  return kept.trimEnd() + TRUNCATION_MARK
}

export function decodePollDraft(value: unknown): PollDraft | undefined {
  if (!isObject(value)) return undefined
  const {options, duration, statements} = value
  /*
   * Drafts saved before the TOKIMEKI switch carried `statements`; keep the
   * first few so an in-progress poll is not silently lost.
   */
  const list = Array.isArray(options)
    ? options
    : Array.isArray(statements)
      ? statements.slice(0, POLL_MAX_OPTIONS)
      : undefined
  if (
    !list ||
    list.length < 1 ||
    list.length > POLL_MAX_OPTIONS ||
    !list.every(option => typeof option === 'string')
  ) {
    return undefined
  }
  return {
    options: list,
    duration: isPollDuration(duration) ? duration : DEFAULT_POLL_DURATION,
  }
}
