import {MMKV} from 'react-native-mmkv'

const store = new MMKV({id: 'witchsky_seen_posts'})

// Promise-returning to match the IndexedDB implementation in storage.web.ts.
export function loadAll(): Promise<[string, number][]> {
  return Promise.resolve(
    store.getAllKeys().map(uri => [uri, store.getNumber(uri) ?? 0]),
  )
}

export function put(uri: string, seenAt: number) {
  store.set(uri, seenAt)
  return Promise.resolve()
}

export function removeMany(uris: string[]) {
  for (const uri of uris) store.delete(uri)
  return Promise.resolve()
}
