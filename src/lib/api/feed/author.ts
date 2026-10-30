import {type Client, type XrpcRequestParams} from '@atproto/lex'

import {getErrorName} from '#/lib/xrpc-error'
import {getPublicAppviewClient} from '#/state/session/clients'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type FeedAPI, type FeedAPIResponse} from './types'

type GetAuthorFeedParams = XrpcRequestParams<
  typeof app.bsky.feed.getAuthorFeed.main
>

export class AuthorFeedAPI implements FeedAPI {
  client: Client
  _params: GetAuthorFeedParams
  /**
   * Read lazily so a rune change takes effect without rebuilding the API,
   * which would otherwise discard the paginated cache.
   */
  seeThroughBlocks?: () => boolean

  constructor({
    client,
    feedParams,
    seeThroughBlocks,
  }: {
    client: Client
    feedParams: GetAuthorFeedParams
    seeThroughBlocks?: () => boolean
  }) {
    this.client = client
    this._params = feedParams
    this.seeThroughBlocks = seeThroughBlocks
  }

  get params() {
    const params = {...this._params}
    params.includePins = params.filter === 'posts_and_author_threads'
    return params
  }

  async peekLatest(): Promise<app.bsky.feed.defs.FeedViewPost> {
    const data = await this.client.call(app.bsky.feed.getAuthorFeed, {
      ...this.params,
      limit: 1,
    })
    return data.feed[0]
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined
    limit: number
  }): Promise<FeedAPIResponse> {
    /*
     * A failed request rejects rather than resolving, so the error propagates
     * to the query and drives the feed error UI (blocked actor, rate limit).
     * The agent behaved the same way - its `success` flag was only ever true -
     * so the empty-page branch this replaces was unreachable.
     */
    let data: app.bsky.feed.getAuthorFeed.$OutputBody
    try {
      data = await this.client.call(app.bsky.feed.getAuthorFeed, {
        ...this.params,
        cursor,
        limit,
      })
    } catch (e) {
      /*
       * The AppView refuses an author feed on a block. The same request made
       * anonymously is answered in full, so retry once through the public
       * client when the rune is on.
       */
      const name = getErrorName(e)
      if (
        !this.seeThroughBlocks?.() ||
        (name !== 'BlockedActor' && name !== 'BlockedByActor')
      ) {
        throw e
      }
      data = await getPublicAppviewClient().call(
        app.bsky.feed.getAuthorFeed,
        {...this.params, cursor, limit},
      )
    }
    return {
      cursor: data.cursor,
      feed: this._filter(data.feed),
    }
  }

  _filter(feed: app.bsky.feed.defs.FeedViewPost[]) {
    if (this.params.filter === 'posts_and_author_threads') {
      return feed.filter(post => {
        const isReply = post.reply
        const isRepost = bsky.isType(
          app.bsky.feed.defs.reasonRepost,
          post.reason,
        )
        const isPin = bsky.isType(app.bsky.feed.defs.reasonPin, post.reason)
        if (!isReply) return true
        if (isRepost || isPin) return true
        return isReply && isAuthorReplyChain(this.params.actor, post, feed)
      })
    }

    return feed
  }
}

function isAuthorReplyChain(
  actor: string,
  post: app.bsky.feed.defs.FeedViewPost,
  posts: app.bsky.feed.defs.FeedViewPost[],
): boolean {
  // current post is by a different user (shouldn't happen)
  if (post.post.author.did !== actor) return false

  const replyParent = post.reply?.parent

  if (bsky.isType(app.bsky.feed.defs.postView, replyParent)) {
    // reply parent is by a different user
    if (replyParent.author.did !== actor) return false

    // A top-level post that matches the parent of the current post.
    const parentPost = posts.find(p => p.post.uri === replyParent.uri)

    /*
     * Either we haven't fetched the parent at the top level, or the only
     * record we have is on feedItem.reply.parent, which we've already checked
     * above.
     */
    if (!parentPost) return true

    // Walk up to parent
    return isAuthorReplyChain(actor, parentPost, posts)
  }

  // Just default to showing it
  return true
}
