import {type app} from '#/lexicons'

type ThreadItems = app.bsky.unspecced.getPostThreadV2.ThreadItem[]
type PostView = app.bsky.feed.defs.PostView

const BLOCKED = 'app.bsky.unspecced.defs#threadItemBlocked'
const POST = 'app.bsky.unspecced.defs#threadItemPost'

/**
 * Replace blocked items with the same item from an anonymous thread response.
 *
 * Blocks are computed from `viewer`, so the anonymous response carries a real
 * `threadItemPost` where the signed-in one carries `threadItemBlocked`. Only
 * matches by uri; anything without an anonymous counterpart is left alone so
 * the normal tombstone still renders.
 *
 * Also returns the uris that were swapped, so the renderer can label them.
 */
export function swapInAnonThread(
  thread: ThreadItems,
  anonThread: ThreadItems | undefined,
): {thread: ThreadItems; swapped: Set<string>} {
  const swapped = new Set<string>()
  if (!anonThread?.length) return {thread, swapped}

  const anonByUri = new Map(anonThread.map(item => [item.uri, item]))
  const next = thread.map(item => {
    if (item.value.$type !== BLOCKED) {
      return item
    }
    const replacement = anonByUri.get(item.uri)
    if (!replacement || replacement.value.$type !== POST) {
      return item
    }
    swapped.add(item.uri)
    return {...replacement, depth: item.depth}
  })
  return {thread: next, swapped}
}

/**
 * Last resort for items the anonymous thread also reports as blocked.
 *
 * The AppView hides a post in a thread when its author blocks the person being
 * replied to. That is not a viewer block, so no cookie-free read of the thread
 * brings it back, but the record itself is still served directly. Rebuilds the
 * thread item from those PostViews, keeping the original depth.
 */
export function mergeAnonPosts(
  current: {thread: ThreadItems; swapped: Set<string>},
  anonPosts: PostView[],
): {thread: ThreadItems; swapped: Set<string>} {
  const swapped = new Set(current.swapped)
  if (!anonPosts.length) return {thread: current.thread, swapped}

  const byUri = new Map(anonPosts.map(post => [post.uri, post]))
  const next = current.thread.map(item => {
    if (item.value.$type !== BLOCKED) return item
    const post = byUri.get(item.uri)
    if (!post) return item
    swapped.add(item.uri)
    return {
      ...item,
      value: {
        $type: POST,
        post,
        opThread: false,
        moreParents: false,
        moreReplies: 0,
        hiddenByThreadgate: false,
        mutedByViewer: false,
      },
    }
  })
  return {thread: next as ThreadItems, swapped}
}
