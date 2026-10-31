import {logger} from '#/logger'
import * as storage from '#/state/seen-posts/storage'

/** Oldest entries past this count are dropped on load to bound memory. */
const MAX = 20000

/** Post URI -> timestamp it was last seen in a feed. */
const seen = new Map<string, number>()
let loading: Promise<void> | undefined

/**
 * Loads persisted history into memory. Safe to call repeatedly; entries
 * recorded before the load finished win over older stored ones.
 */
export function load() {
  loading ??= (async () => {
    try {
      for (const [uri, seenAt] of await storage.loadAll()) {
        if ((seen.get(uri) ?? 0) < seenAt) seen.set(uri, seenAt)
      }
      if (seen.size > MAX) {
        const stale = listUrisBySeenDesc().slice(MAX)
        for (const uri of stale) seen.delete(uri)
        await storage.removeMany(stale)
      }
    } catch (e) {
      logger.error('seen-posts: failed to load', {safeMessage: e})
    }
  })()
  return loading
}

export function markSeen(uri: string) {
  const now = Date.now()
  seen.set(uri, now)
  void storage.put(uri, now)
}

export function getSeenAt(uri: string) {
  return seen.get(uri)
}

export function listUrisBySeenDesc() {
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([uri]) => uri)
}
