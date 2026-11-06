export const TOKIMEKI_POLL_COLLECTION = 'tech.tokimeki.poll.poll'
export const TOKIMEKI_VOTE_COLLECTION = 'tech.tokimeki.poll.vote'
export const TOKIMEKI_HOSTS = ['poll.tokimeki.tech', 'poll.tokimeki.blue']

/** Where a poll lives: its author's repo and the record key. */
export type TokimekiPollRef = {did: string; rkey: string}

/** The parts of `tech.tokimeki.poll.getPoll` the card needs, flattened. */
export type TokimekiPoll = {
  uri: string
  cid: string
  options: string[]
  endsAt?: string
  /** Per option, aligned with `options`. */
  counts: number[]
  totalVotes: number
  /** 0-based index of the viewer's pick; absent if they have not voted. */
  myVote?: number
}
