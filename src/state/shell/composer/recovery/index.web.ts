import {createStore, del, get, update} from 'idb-keyval'
import {nanoid} from 'nanoid/non-secure'

import {logger} from '#/logger'
import {type ComposerOpts} from '#/state/shell/composer'
import {type ComposerState} from '#/view/com/composer/state/composer'
import {decodeRecovery, encodeRecovery, type Recovery} from './codec'

const STORAGE_KEY = 'composerRecovery'
const mediaStore = createStore('bsky-composer-recovery', 'media')
type Snapshot = {id: string; raw: string}
type Media = Record<string, Blob>
let recovery: Recovery | undefined
let snapshot: Snapshot | undefined
const mediaCopies = new Map<string, Promise<void>>()
let fileUrls = new WeakMap<File, string>()
const ownedUrls = new Set<string>()
const mediaUrlKeys = new Set(['uri', 'path', 'playlistUri'])

export function readRecovery(
  did: string,
): Recovery | Promise<Recovery | undefined> | undefined {
  if (recovery) {
    if (!hasContent(recovery.state)) {
      clearRecovery(did)
      return undefined
    }
    return {
      ...recovery,
      state: {...recovery.state, mutableNeedsFocusActive: true},
    }
  }
  const saved = readSnapshot()
  if (!saved) return undefined
  try {
    const restored = decodeRecovery(saved.raw)
    if (!hasContent(restored.state)) {
      clearRecovery(did)
      return undefined
    }
    if (!blobUrls(saved.raw).size) return restored
    return restoreMedia(saved)
  } catch (error) {
    logger.error('Failed to restore composer', {safeMessage: error})
    return undefined
  }
}

export function saveRecovery(
  did: string,
  opts: ComposerOpts,
  state: ComposerState,
): void {
  if (!hasContent(state)) {
    clearRecovery(did)
    return
  }
  recovery = {
    version: 1,
    opts: {activeAccountDid: opts.activeAccountDid, replyTo: opts.replyTo},
    state,
  }
  try {
    const saved = {
      id: snapshot?.id ?? readSnapshot()?.id ?? nanoid(),
      raw: encodeRecovery(opts, state, file => {
        let uri = fileUrls.get(file)
        if (!uri) {
          uri = URL.createObjectURL(file)
          fileUrls.set(file, uri)
          ownedUrls.add(uri)
        }
        return {
          $type: 'witchsky.composer.file',
          uri,
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
        }
      }),
    }
    snapshot = saved
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    for (const url of blobUrls(saved.raw)) {
      if (mediaCopies.has(url)) continue
      const copy = cacheMedia(saved.id, url).catch(error => {
        mediaCopies.delete(url)
        logger.error('Failed to cache composer media', {safeMessage: error})
      })
      mediaCopies.set(url, copy)
    }
  } catch (error) {
    logger.error('Failed to cache composer', {safeMessage: error})
  }
}

function hasContent(state: ComposerState) {
  return state.thread.posts.some(
    post =>
      post.richtext.text.trim().length > 0 ||
      post.embed.media ||
      post.embed.link ||
      post.embed.quote,
  )
}

export function clearRecovery(_did: string): void {
  recovery = undefined
  const saved = snapshot ?? readSnapshot()
  snapshot = undefined
  mediaCopies.clear()
  for (const url of ownedUrls) URL.revokeObjectURL(url)
  ownedUrls.clear()
  fileUrls = new WeakMap()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    if (saved) {
      void del(saved.id, mediaStore).catch(error => {
        logger.error('Failed to clear composer media', {safeMessage: error})
      })
    }
  } catch (error) {
    logger.error('Failed to clear composer recovery', {safeMessage: error})
  }
}

function readSnapshot(): Snapshot | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const saved = JSON.parse(raw) as Snapshot
    if (typeof saved.id === 'string' && typeof saved.raw === 'string') {
      return saved
    }
  } catch (error) {
    logger.error('Failed to read composer recovery', {safeMessage: error})
  }
  return undefined
}

function blobUrls(raw: string) {
  const urls = new Set<string>()
  const saved = JSON.parse(raw, (key, value) => {
    if (
      mediaUrlKeys.has(key) &&
      typeof value === 'string' &&
      value.startsWith('blob:')
    ) {
      urls.add(value)
    }
    return value
  }) as {state: {loadedMediaMap?: [string, string][]}}
  for (const [, url] of saved.state.loadedMediaMap ?? []) {
    if (url.startsWith('blob:')) urls.add(url)
  }
  return urls
}

async function cacheMedia(id: string, url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to read composer media')
  const blob = await response.blob()
  if (snapshot?.id !== id || !blobUrls(snapshot.raw).has(url)) {
    mediaCopies.delete(url)
    return
  }
  await update<Media>(id, previous => ({...previous, [url]: blob}), mediaStore)
}

async function restoreMedia(saved: Snapshot): Promise<Recovery | undefined> {
  const urls = new Map<string, string>()
  const files = new Map<string, Blob>()
  try {
    const media = await get<Media>(saved.id, mediaStore)
    if (readSnapshot()?.raw !== saved.raw) return undefined
    for (const url of blobUrls(saved.raw)) {
      if (media?.[url]) {
        const restoredUrl = URL.createObjectURL(media[url])
        ownedUrls.add(restoredUrl)
        urls.set(url, restoredUrl)
        files.set(restoredUrl, media[url])
      }
    }
  } catch (error) {
    logger.error('Failed to restore composer media', {safeMessage: error})
  }
  if (readSnapshot()?.raw !== saved.raw) return undefined
  const raw = JSON.stringify(JSON.parse(saved.raw), (key, value) =>
    mediaUrlKeys.has(key) && typeof value === 'string'
      ? (urls.get(value) ?? value)
      : value,
  )
  try {
    const restored = decodeRecovery(raw)
    if (restored.state.loadedMediaMap) {
      restored.state.loadedMediaMap = new Map(
        [...restored.state.loadedMediaMap].map(([key, url]) => [
          key,
          urls.get(url) ?? url,
        ]),
      )
    }
    restoreFiles(restored, files)
    return restored
  } catch (error) {
    logger.error('Failed to restore composer', {safeMessage: error})
    return undefined
  }
}

function restoreFiles(value: unknown, files: Map<string, Blob>): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (
    record.$type === 'witchsky.composer.file' &&
    typeof record.uri === 'string' &&
    typeof record.name === 'string' &&
    typeof record.type === 'string' &&
    typeof record.lastModified === 'number'
  ) {
    const blob = files.get(record.uri)
    return blob
      ? new File([blob], record.name, {
          type: record.type,
          lastModified: record.lastModified,
        })
      : undefined
  }
  if (
    Array.isArray(value) ||
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    for (const [key, child] of Object.entries(record)) {
      record[key] = restoreFiles(child, files)
    }
  }
  return value
}
