import { useEffect, useState } from "react";

import { type FeedDescriptor,type FeedPostSlice } from "#/state/queries/post-feed";
import IdbKV from "./idb";
import { useLocalStorage } from "./local-store";

export function useHideSeenPosts() {
    const [hideSeenPosts, setHideSeenPosts] = useLocalStorage('maxine:hideSeenPosts', 'false')

    return [hideSeenPosts === 'true', (value: boolean) => setHideSeenPosts(value ? 'true' : 'false')] as const
}

class IdbWithInMemoryCache<K extends IDBValidKey, V> {
    private readonly idb: IdbKV<K, V>
    private readonly cache: Map<K, V | undefined>
    constructor(dbName: string, { batchInterval = 10 }: { batchInterval?: number } = {}) {
        this.idb = new IdbKV(dbName, { batchInterval })
        this.cache = new Map()
    }

    set(key: K, value: V) {
        this.cache.set(key, value)
        this.idb.set(key, value)
    }

    get(key: K): Promise<V | undefined> {
        if (this.cache.has(key)) {
            return Promise.resolve(this.cache.get(key))
        }
        return this.idb.get(key).then(value => {
            this.cache.set(key, value)
            return value
        })
    }

    getBatch(keys: K[]): Promise<Map<K, V | undefined>> {
        let readAllKeysFromCache = true

        const result = new Map<K, V | undefined>()
        for (const key of keys) {
            if (this.cache.has(key)) {
                result.set(key, this.cache.get(key))
            } else {
                readAllKeysFromCache = false
                break
            }
        }

        if (readAllKeysFromCache) {
            return Promise.resolve(result)
        }

        return this.idb.getBatch(keys).then(batch => {
            for (const [key, value] of batch) {
                this.cache.set(key, value)
            }
            return batch
        })
    }
}

const seenPosts = new IdbWithInMemoryCache<string, {
    post: { uri: string; cid: string }
    lastSeenAt: Date
    lastSeenFeed: FeedDescriptor
}>('seen-posts', {
    batchInterval: 10,
})

export function setSeenPost(post: { uri: string; cid: string }, feed: FeedDescriptor) {
    const key = `${post.uri}:${post.cid}`
    seenPosts.set(key, {
        post: { uri: post.uri, cid: post.cid },
        lastSeenAt: new Date(),
        lastSeenFeed: feed,
    })
}

export function useIsPostSeen({ uri, cid }: { uri: string; cid: string }, hideSeenPostsToggle: boolean): boolean {
    const [isSeen, setIsSeen] = useState(false)

    useEffect(() => {
        const key = `${uri}:${cid}`

        seenPosts.get(key).then(seenPost => {
            setIsSeen(seenPost !== undefined)
        })
    }, [uri, cid, hideSeenPostsToggle])

    return isSeen
}

export function useIsSliceSeen(slice: FeedPostSlice, hideSeenPostsToggle: boolean): boolean {
    const [isSeen, setIsSeen] = useState(false)

    const keys = slice.items.map(item => `${item.post.uri}:${item.post.cid}`)

    useEffect(() => {
        if (keys.length === 0) {
            return
        }

        console.log('slice items: ', slice.items.map(item => ({
            ...item,
            seenCacheState: seenPosts.get(`${item.post.uri}:${item.post.cid}`),
        })))

        seenPosts.getBatch(keys).then(seenPostMap => {
            const isAllSeen = [...seenPostMap.values()].every(seenPost => !!seenPost)
            console.log(`sliceSeen fetched isAllSeen`, isAllSeen)
            setIsSeen(isAllSeen)
        })
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...keys, hideSeenPostsToggle])

    return isSeen
}