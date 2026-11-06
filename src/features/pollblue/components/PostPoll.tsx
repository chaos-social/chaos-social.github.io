import {type app} from '#/lexicons'
import {PollBlueCard} from './PollBlueCard'

/**
 * One-line mount for post surfaces: renders the poll.blue card when the post
 * is a poll, and nothing otherwise. Kept tiny so each surface can drop it in
 * next to its `<RichText>` without knowing about poll.blue.
 */
export function PostPoll({post}: {post: app.bsky.feed.defs.PostView}) {
  const record = post.record
  if (!record || typeof record !== 'object') return null
  return <PollBlueCard uri={post.uri} record={record} />
}
