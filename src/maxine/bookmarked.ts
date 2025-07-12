import { useEffect, useState } from "react"

import { IdbWithInMemoryCache } from "./idb"

const bookmarked = new IdbWithInMemoryCache<string, boolean>('bookmarked')

export function useIsBookmarked(post: { uri: string; cid: string }) {
    const [isBookmarked, setIsBookmarked] = useState(false)

    const key = `${post.uri}:${post.cid}`
    useEffect(() => {
        bookmarked.get(key).then(bookmark => {
            setIsBookmarked(!!bookmark)
        })
    }, [key])

    return [isBookmarked, (value: boolean) => {
        bookmarked.set(key, value)
        setIsBookmarked(value)
    }] as const
}