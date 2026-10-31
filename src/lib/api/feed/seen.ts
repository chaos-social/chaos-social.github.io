import {type Client} from '@atproto/lex'
import {type AtUriString} from '@atproto/syntax'

import {listUrisBySeenDesc} from '#/state/seen-posts'
import {app} from '#/lexicons'
import {type FeedAPI, type FeedAPIResponse} from './types'

/** getPosts accepts at most 25 URIs per call. */
const PAGE_SIZE = 25

/** Posts the user has seen in feeds, most recently seen first. */
export class SeenPostsFeedAPI implements FeedAPI {
  client: Client
  peek: app.bsky.feed.defs.FeedViewPost | null = null

  constructor({client}: {client: Client}) {
    this.client = client
  }

  peekLatest(): Promise<app.bsky.feed.defs.FeedViewPost> {
    if (this.peek) return Promise.resolve(this.peek)
    return Promise.reject(new Error('Has not fetched yet'))
  }

  async fetch({
    cursor,
  }: {
    cursor: string | undefined
  }): Promise<FeedAPIResponse> {
    const offset = Number(cursor) || 0
    const all = listUrisBySeenDesc()
    const uris = all.slice(offset, offset + PAGE_SIZE) as AtUriString[]
    if (!uris.length) return {feed: []}
    const data = await this.client.call(app.bsky.feed.getPosts, {uris})
    const order = new Map(uris.map((uri, i) => [uri, i]))
    const posts = data.posts.sort(
      (a, b) => (order.get(a.uri) ?? 0) - (order.get(b.uri) ?? 0),
    )
    if (offset === 0 && posts[0]) this.peek = {post: posts[0]}
    return {
      cursor:
        offset + PAGE_SIZE < all.length
          ? String(offset + PAGE_SIZE)
          : undefined,
      feed: posts.map(post => ({post})),
    }
  }
}
