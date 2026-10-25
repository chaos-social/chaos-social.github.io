import {isBridgedPdsUrl, isBskyPdsUrl} from '#/state/queries/pds-label.util'
import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {IS_NATIVE} from '#/env'
import {create as createArchiveDB} from '#/storage/archive/db'

export type PdsRequestPriority = 'near' | 'visible'

export type PdsLabelData = {
  pdsUrl: string
  isBsky: boolean
  isBridged: boolean
}

type CacheEntry = {
  savedAt: number
  data: PdsLabelData
}

type CacheBucket = Record<string, CacheEntry>

type PendingTask = {
  did: `did:${string}:${string}`
  priority: PdsRequestPriority
  order: number
  promise: Promise<PdsLabelData | undefined>
  resolve: (data: PdsLabelData | undefined) => void
  reject: (err: unknown) => void
}

export type PdsLabelSnapshot = {
  data: PdsLabelData | undefined
  isLoading: boolean
}

type LabelState = {
  snapshot: PdsLabelSnapshot
  resolvedAt: number
  lastAccessed: number
  promise: Promise<void> | undefined
}

const CACHE_TTL = 60 * 60 * 1000
const CACHE_BUCKET_COUNT = 64
const CACHE_BUCKET_LIMIT = 64
const PERSIST_BATCH_SIZE = 12
const PERSIST_DEBOUNCE = 2000
const MAX_ACTIVE = 3
const MAX_ACTIVE_NEAR = 2
const MAX_LABEL_STATES = CACHE_BUCKET_COUNT * CACHE_BUCKET_LIMIT

const EMPTY_SNAPSHOT: PdsLabelSnapshot = {
  data: undefined,
  isLoading: false,
}

const cacheStore = createArchiveDB({id: 'witchsky-pds-label-cache-v1'})
const loadedBuckets = new Map<number, Promise<CacheBucket>>()
const pendingWrites = new Map<string, CacheEntry>()
const pendingTasks = new Map<string, PendingTask>()
const labelStates = new Map<string, LabelState>()
const labelListeners = new Map<string, Set<() => void>>()

let taskOrder = 0
let activeCount = 0
let activeNearCount = 0
let nearDrainHandle: ReturnType<typeof requestIdleCallback> | undefined
let persistTimer: ReturnType<typeof setTimeout> | undefined
let persistInteractionHandle: ReturnType<typeof requestIdleCallback> | undefined

function notifyLabelListeners(did: string) {
  labelListeners.get(did)?.forEach(listener => listener())
}

function pruneLabelStates() {
  if (labelStates.size <= MAX_LABEL_STATES) return

  const removable = Array.from(labelStates.entries())
    .filter(([did, state]) => !state.promise && !labelListeners.has(did))
    .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
  for (const [did] of removable) {
    labelStates.delete(did)
    if (labelStates.size <= MAX_LABEL_STATES) return
  }
}

function bucketIndex(did: string) {
  let hash = 2166136261
  for (let i = 0; i < did.length; i++) {
    hash ^= did.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % CACHE_BUCKET_COUNT
}

function bucketKey(index: number) {
  return `bucket-${index}`
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<CacheEntry>
  return (
    typeof entry.savedAt === 'number' &&
    !!entry.data &&
    typeof entry.data.pdsUrl === 'string' &&
    typeof entry.data.isBsky === 'boolean' &&
    typeof entry.data.isBridged === 'boolean'
  )
}

function loadBucket(index: number): Promise<CacheBucket> {
  let promise = loadedBuckets.get(index)
  if (promise) return promise

  promise = Promise.resolve(cacheStore.get(bucketKey(index)))
    .then(raw => {
      if (!raw) return {}
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return {}

        const now = Date.now()
        const bucket: CacheBucket = {}
        for (const [did, entry] of Object.entries(parsed)) {
          if (isCacheEntry(entry) && now - entry.savedAt < CACHE_TTL) {
            bucket[did] = entry
          }
        }
        return bucket
      } catch {
        return {}
      }
    })
    .catch(() => ({}))
  loadedBuckets.set(index, promise)
  return promise
}

async function readCached(did: string) {
  const bucket = await loadBucket(bucketIndex(did))
  const entry = bucket[did]
  if (!entry || Date.now() - entry.savedAt >= CACHE_TTL) return undefined
  return entry.data
}

function queuePersist(did: string, data: PdsLabelData) {
  const entry = {savedAt: Date.now(), data}
  pendingWrites.set(did, entry)
  void loadBucket(bucketIndex(did)).then(bucket => {
    bucket[did] = entry
  })
  if (persistTimer || persistInteractionHandle) return

  persistTimer = setTimeout(() => {
    persistTimer = undefined
    if (IS_NATIVE) {
      persistInteractionHandle = requestIdleCallback(() => {
        persistInteractionHandle = undefined
        void flushPersistBatch().catch(() => {})
      })
    } else {
      void flushPersistBatch().catch(() => {})
    }
  }, PERSIST_DEBOUNCE)
}

async function flushPersistBatch() {
  const batch = Array.from(pendingWrites.entries()).slice(0, PERSIST_BATCH_SIZE)
  for (const [did] of batch) pendingWrites.delete(did)

  const byBucket = new Map<number, Array<[string, CacheEntry]>>()
  for (const [did, entry] of batch) {
    const index = bucketIndex(did)
    const entries = byBucket.get(index) ?? []
    entries.push([did, entry])
    byBucket.set(index, entries)
  }

  await Promise.all(
    Array.from(byBucket.entries()).map(async ([index, entries]) => {
      const bucket = await loadBucket(index)
      for (const [did, entry] of entries) bucket[did] = entry

      const boundedEntries = Object.entries(bucket)
        .sort(([, a], [, b]) => b.savedAt - a.savedAt)
        .slice(0, CACHE_BUCKET_LIMIT)
      const boundedBucket = Object.fromEntries(boundedEntries)
      loadedBuckets.set(index, Promise.resolve(boundedBucket))
      await cacheStore.set(bucketKey(index), JSON.stringify(boundedBucket))
    }),
  )

  if (pendingWrites.size > 0) {
    persistTimer = setTimeout(() => {
      persistTimer = undefined
      if (IS_NATIVE) {
        persistInteractionHandle = requestIdleCallback(() => {
          persistInteractionHandle = undefined
          void flushPersistBatch().catch(() => {})
        })
      } else {
        void flushPersistBatch().catch(() => {})
      }
    }, PERSIST_DEBOUNCE)
  }
}

function nextTask(allowNear: boolean) {
  let next: PendingTask | undefined
  for (const task of pendingTasks.values()) {
    if (task.priority === 'near' && !allowNear) continue
    if (task.priority === 'near' && activeNearCount >= MAX_ACTIVE_NEAR) continue
    if (
      !next ||
      (task.priority === 'visible' && next.priority === 'near') ||
      (task.priority === next.priority && task.order < next.order)
    ) {
      next = task
    }
  }
  return next
}

function drainQueue(allowNear: boolean) {
  while (activeCount < MAX_ACTIVE) {
    const task = nextTask(allowNear)
    if (!task) return

    pendingTasks.delete(task.did)
    activeCount++
    if (task.priority === 'near') activeNearCount++

    void resolvePdsServiceUrl(task.did)
      .then(pdsUrl => {
        if (!pdsUrl) return undefined
        const data = {
          pdsUrl,
          isBsky: isBskyPdsUrl(pdsUrl),
          isBridged: isBridgedPdsUrl(pdsUrl),
        }
        queuePersist(task.did, data)
        return data
      })
      .then(task.resolve, task.reject)
      .finally(() => {
        activeCount--
        if (task.priority === 'near') activeNearCount--
        if (IS_NATIVE) {
          drainQueue(false)
          if (
            Array.from(pendingTasks.values()).some(t => t.priority === 'near')
          ) {
            requestDrain('near')
          }
        } else {
          drainQueue(true)
        }
      })
  }
}

function requestDrain(priority: PdsRequestPriority) {
  if (priority === 'visible' || !IS_NATIVE) {
    drainQueue(!IS_NATIVE)
  } else if (!nearDrainHandle) {
    nearDrainHandle = requestIdleCallback(() => {
      nearDrainHandle = undefined
      drainQueue(true)
    })
  }
}

function enqueueResolution(
  did: `did:${string}:${string}`,
  priority: PdsRequestPriority,
) {
  const existing = pendingTasks.get(did)
  if (existing) {
    if (priority === 'visible' && existing.priority === 'near') {
      existing.priority = 'visible'
      requestDrain('visible')
    }
    return existing.promise
  }

  let resolveTask!: (data: PdsLabelData | undefined) => void
  let rejectTask!: (err: unknown) => void
  const promise = new Promise<PdsLabelData | undefined>((resolve, reject) => {
    resolveTask = resolve
    rejectTask = reject
  })
  pendingTasks.set(did, {
    did,
    priority,
    order: taskOrder++,
    promise,
    resolve: resolveTask,
    reject: rejectTask,
  })
  requestDrain(priority)
  return promise
}

export function promotePdsLabelResolution(did: string) {
  const task = pendingTasks.get(did)
  if (task?.priority === 'near') {
    task.priority = 'visible'
    requestDrain('visible')
  }
}

export function subscribePdsLabel(did: string, listener: () => void) {
  let listeners = labelListeners.get(did)
  if (!listeners) {
    listeners = new Set()
    labelListeners.set(did, listeners)
  }
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) labelListeners.delete(did)
  }
}

export function getPdsLabelSnapshot(did: string) {
  const state = labelStates.get(did)
  if (!state) return EMPTY_SNAPSHOT
  return state.snapshot
}

export function requestPdsLabel(
  did: `did:${string}:${string}`,
  priority: PdsRequestPriority,
) {
  let state = labelStates.get(did)
  const now = Date.now()
  if (state?.promise) {
    if (priority === 'visible') promotePdsLabelResolution(did)
    return
  }
  if (state?.resolvedAt && now - state.resolvedAt < CACHE_TTL) return

  if (!state) {
    state = {
      snapshot: EMPTY_SNAPSHOT,
      resolvedAt: 0,
      lastAccessed: now,
      promise: undefined,
    }
    labelStates.set(did, state)
    pruneLabelStates()
  }

  state.lastAccessed = now
  state.snapshot = {...state.snapshot, isLoading: true}
  notifyLabelListeners(did)

  state.promise = resolvePdsLabel(did, priority)
    .then(data => {
      state.snapshot = {data, isLoading: false}
      state.resolvedAt = Date.now()
    })
    .catch(() => {
      state.snapshot = {...state.snapshot, isLoading: false}
    })
    .finally(() => {
      state.promise = undefined
      state.lastAccessed = Date.now()
      notifyLabelListeners(did)
    })
}

export async function resolvePdsLabel(
  did: `did:${string}:${string}`,
  priority: PdsRequestPriority,
) {
  const cached = await readCached(did)
  if (cached) return cached
  return enqueueResolution(did, priority)
}
