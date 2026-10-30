import {type app} from '#/lexicons'

type ThreadItems = app.bsky.unspecced.getPostThreadV2.ThreadItem[]

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
    if (item.value.$type !== 'app.bsky.unspecced.defs#threadItemBlocked') {
      return item
    }
    const replacement = anonByUri.get(item.uri)
    if (
      !replacement ||
      replacement.value.$type !== 'app.bsky.unspecced.defs#threadItemPost'
    ) {
      return item
    }
    swapped.add(item.uri)
    return {...replacement, depth: item.depth}
  })
  return {thread: next, swapped}
}
