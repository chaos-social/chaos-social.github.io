import { useEffect, useState } from "react";

import { type FeedDescriptor,type FeedPostSlice } from "#/state/queries/post-feed";
import { IdbWithInMemoryCache } from "./idb";
import { useLocalStorage } from "./local-store";

export function useHideSeenPosts() {
    const [hideSeenPosts, setHideSeenPosts] = useLocalStorage('maxine:hideSeenPosts', 'false')

    return [hideSeenPosts === 'true', (value: boolean) => setHideSeenPosts(value ? 'true' : 'false')] as const
}

const seenPosts = new IdbWithInMemoryCache<string, {
    post: { uri: string; cid: string }
    lastSeenAt: Date
    lastSeenFeed: FeedDescriptor
}>('seen-posts')

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

        // console.log('slice items: ', slice.items.map(item => ({
        //     ...item,
        //     seenCacheState: seenPosts.get(`${item.post.uri}:${item.post.cid}`),
        // })))

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