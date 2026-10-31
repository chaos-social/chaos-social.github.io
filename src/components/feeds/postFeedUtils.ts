import {quotesBlockedAccount} from '#/lib/quotesBlockedAccount'
import {
  type FeedPostSlice,
  type FeedPostSliceItem,
} from '#/state/queries/post-feed'
import {embedViewRecordToPostView, getEmbeddedPost} from '#/state/queries/util'
import {getSeenAt} from '#/state/seen-posts'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

function collectPdsProfileDids(
  post: app.bsky.feed.defs.PostView,
  dids = new Set<string>(),
  depth = 0,
) {
  dids.add(post.author.did)

  /* Bound recursion while covering nested quotes in normal posts. */
  if (depth < 4) {
    const embeddedPost = getEmbeddedPost(post.embed)
    if (embeddedPost) {
      collectPdsProfileDids(
        embedViewRecordToPostView(embeddedPost),
        dids,
        depth + 1,
      )
    }
  }

  return dids
}

/** Authors in a rendered row, including nested quotes, for PDS fetch priority. */
export function collectPdsProfileDidsForFeedRow(item: {
  type: string
  slice?: FeedPostSlice
  indexInSlice?: number
  items?: FeedPostSlice[] | FeedPostSliceItem[]
}) {
  const dids = new Set<string>()
  if (item.type === 'sliceItem' && item.slice) {
    collectPdsProfileDids(item.slice.items[item.indexInSlice ?? 0].post, dids)
  } else if (item.type === 'reposts') {
    for (const slice of (item.items ?? []) as FeedPostSlice[]) {
      for (const sliceItem of slice.items) {
        collectPdsProfileDids(sliceItem.post, dids)
      }
    }
  } else if (item.type === 'videoGridRow') {
    for (const sliceItem of (item.items ?? []) as FeedPostSliceItem[]) {
      collectPdsProfileDids(sliceItem.post, dids)
    }
  }
  return dids
}

export type FeedPostSliceOrGroup =
  | (FeedPostSlice & {
      isRepostSlice?: false
    })
  | {
      isRepostSlice: true
      slices: FeedPostSlice[]
    }

/**
 * Group dense runs of reposts without changing the order of ordinary posts.
 * Based on https://github.com/cheeaun/phanpy/blob/d608ee0a7594e3c83cdb087e81002f176d0d7008/src/utils/timeline-utils.js#L9
 */
export function groupReposts(values: FeedPostSlice[]) {
  let newValues: FeedPostSliceOrGroup[] = []
  const reposts: FeedPostSlice[] = []

  let serialReposts = 0

  for (const row of values) {
    if (bsky.isType(app.bsky.feed.defs.reasonRepost, row.reason)) {
      reposts.push(row)
      serialReposts++
      continue
    }

    newValues.push(row)
    if (serialReposts < 3) {
      serialReposts = 0
    }
  }

  // TODO: handle counts for multi-item slices
  if (
    values.length > 10 &&
    (reposts.length > values.length / 4 || serialReposts >= 3)
  ) {
    if (reposts.length > (values.length * 3) / 4) {
      newValues = [...newValues, {isRepostSlice: true, slices: reposts}]
    } else {
      const half = Math.floor(newValues.length / 2)
      newValues = [
        ...newValues.slice(0, half),
        {isRepostSlice: true, slices: reposts},
        ...newValues.slice(half),
      ]
    }

    return newValues
  }

  return values as FeedPostSliceOrGroup[]
}

/** Filter before grouping, so a carousel cannot bypass feed preferences. */
export function filterFeedSlices(
  slices: FeedPostSlice[],
  {
    hideUnreplyablePosts,
    hideQuotesOfBlockedAccounts,
    blockedOrMutedAuthors,
    seenBefore,
  }: {
    hideUnreplyablePosts: boolean
    hideQuotesOfBlockedAccounts: boolean
    blockedOrMutedAuthors: string[]
    /**
     * Drop posts last seen before this time, usually the page's `fetchedAt`,
     * so posts seen while scrolling stay put until the next refresh.
     */
    seenBefore?: number
  },
) {
  return slices.filter(
    slice =>
      !(
        seenBefore !== undefined &&
        (getSeenAt(slice.feedPostUri) ?? Infinity) < seenBefore
      ) &&
      !slice.items.some(
        item =>
          (hideUnreplyablePosts && item.post.viewer?.replyDisabled === true) ||
          (hideQuotesOfBlockedAccounts &&
            quotesBlockedAccount(item.post.embed)) ||
          blockedOrMutedAuthors.includes(item.post.author.did),
      ),
  )
}
