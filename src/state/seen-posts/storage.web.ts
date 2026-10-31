import {createStore, delMany, entries, set} from 'idb-keyval'

const store = createStore('witchsky_seen_posts', 'seen')

export function loadAll() {
  return entries<string, number>(store)
}

export function put(uri: string, seenAt: number) {
  return set(uri, seenAt, store)
}

export function removeMany(uris: string[]) {
  return delMany(uris, store)
}
