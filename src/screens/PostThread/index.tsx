import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {type HostInstance, useWindowDimensions, View} from 'react-native'
import Animated, {FadeIn, useAnimatedStyle} from 'react-native-reanimated'
import {moderatePost} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {useInitialNumToRender} from '#/lib/hooks/useInitialNumToRender'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {usePostViewTracking} from '#/lib/hooks/usePostViewTracking'
import {getShapeStyle} from '#/lib/shapes'
import {usePostViewAuthorShadowFilter} from '#/state/cache/profile-shadow'
import {
  type StateContext as FeedFeedbackStateContext,
  useFeedFeedback,
} from '#/state/feed-feedback'
import {useAlsoLikedCollapseByDefault} from '#/state/preferences/also-liked-collapse-by-default'
import {useAlsoLikedFeedEnabled} from '#/state/preferences/also-liked-feed-enabled'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {
  ALSO_LIKED_PAGE_SIZE,
  usePostAlsoLikedQuery,
} from '#/state/queries/post-also-liked'
import {type ThreadView} from '#/state/queries/preferences/useThreadPreferences'
import {
  PostThreadContextProvider,
  usePostThread,
} from '#/state/queries/usePostThread'
import {useSession} from '#/state/session'
import {type OnPostSuccessData} from '#/state/shell/composer'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useUnstablePostSource} from '#/state/unstable-post-source'
import {List, type ListMethods} from '#/view/com/util/List'
import {HeaderDropdown} from '#/screens/PostThread/components/HeaderDropdown'
import {HeaderReaderToggle} from '#/screens/PostThread/components/HeaderReaderToggle'
import {ThreadAlsoLiked} from '#/screens/PostThread/components/ThreadAlsoLiked'
import {ThreadComposePrompt} from '#/screens/PostThread/components/ThreadComposePrompt'
import {ThreadError} from '#/screens/PostThread/components/ThreadError'
import {
  ThreadItemAnchor,
  ThreadItemAnchorSkeleton,
} from '#/screens/PostThread/components/ThreadItemAnchor'
import {ThreadItemAnchorNoUnauthenticated} from '#/screens/PostThread/components/ThreadItemAnchorNoUnauthenticated'
import {
  ThreadItemPost,
  ThreadItemPostSkeleton,
} from '#/screens/PostThread/components/ThreadItemPost'
import {ThreadItemPostNoUnauthenticated} from '#/screens/PostThread/components/ThreadItemPostNoUnauthenticated'
import {ThreadItemPostTombstone} from '#/screens/PostThread/components/ThreadItemPostTombstone'
import {ThreadItemReaderSegment} from '#/screens/PostThread/components/ThreadItemReaderSegment'
import {ThreadItemReadMore} from '#/screens/PostThread/components/ThreadItemReadMore'
import {ThreadItemReadMoreUp} from '#/screens/PostThread/components/ThreadItemReadMoreUp'
import {ThreadItemReplyComposerSkeleton} from '#/screens/PostThread/components/ThreadItemReplyComposer'
import {ThreadItemShowOtherReplies} from '#/screens/PostThread/components/ThreadItemShowOtherReplies'
import {
  ThreadItemTreePost,
  ThreadItemTreePostSkeleton,
} from '#/screens/PostThread/components/ThreadItemTreePost'
import {
  buildReaderThread,
  getReaderRoot,
  hasReaderThread,
  type ReaderItem,
} from '#/screens/PostThread/reader'
import {
  atoms as a,
  native,
  platform,
  tokens,
  useBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {Button} from '#/components/Button'
import {ChevronTop_Stroke2_Corner0_Rounded as ChevronTopIcon} from '#/components/icons/Chevron'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_IOS, IS_NATIVE} from '#/env'

const PARENT_CHUNK_SIZE = IS_NATIVE ? 5 : 20
const CHILDREN_CHUNK_SIZE = 50
const analyticsOnlyOnItemSeen: FeedFeedbackStateContext['onItemSeen'] = () => {}
const analyticsOnlySendInteraction: FeedFeedbackStateContext['sendInteraction'] =
  () => {}

export function PostThread({
  uri,
  initialView,
}: {
  uri: string
  initialView?: 'reader'
}) {
  const ax = useAnalytics()
  const {gtMobile} = useBreakpoints()
  const {hasSession} = useSession()
  const initialNumToRender = useInitialNumToRender()
  const {height: windowHeight} = useWindowDimensions()
  const moderationOpts = useModerationOpts()
  const anchorPostSource = useUnstablePostSource(uri)
  const feedFeedback = useFeedFeedback(
    anchorPostSource?.feedSourceInfo,
    hasSession,
  )

  /*
   * Reader view always reads the full thread from the start, so while it's
   * active the query is re-anchored at the thread root. When entering the
   * screen directly in reader view, the anchor data isn't available yet, so
   * the root starts as the anchor itself and the correction effect below
   * re-anchors once data arrives.
   */
  const [readerRoot, setReaderRoot] = useState<string | null>(null)

  /*
   * One query to rule them all
   */
  const thread = usePostThread({anchor: readerRoot ?? uri, initialView})
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- restored memoization
  const {anchor, hasParents} = useMemo(() => {
    let hasParents = false
    for (const item of thread.data.items) {
      if (item.type === 'threadPost' && item.depth === 0) {
        return {anchor: item, hasParents}
      }
      hasParents = true
    }
    return {hasParents}
  }, [thread.data.items])

  // Track post:view event when anchor post is viewed
  const seenPostUriRef = useRef<string | null>(null)
  useEffect(() => {
    if (
      anchor?.type === 'threadPost' &&
      anchor.value.post.uri !== seenPostUriRef.current
    ) {
      const post = anchor.value.post
      seenPostUriRef.current = post.uri

      ax.metric('post:view', {
        uri: post.uri,
        authorDid: post.author.did,
        isReply: !!post.record.reply,
        logContext: 'Post',
        feedDescriptor: feedFeedback.feedDescriptor,
      })
    }
  }, [ax, anchor, feedFeedback.feedDescriptor])

  // Track post:view events for parent posts and replies (non-anchor posts)
  const trackThreadItemView = usePostViewTracking('PostThreadItem')

  const {openComposer} = useOpenComposer()
  const optimisticOnPostReply = useNonReactiveCallback(
    (payload: OnPostSuccessData) => {
      if (payload) {
        const {replyToUri, posts} = payload
        if (replyToUri && posts.length) {
          thread.actions.insertReplies(replyToUri, posts)
        }
      }
    },
  )
  const onReplyToAnchor = useNonReactiveCallback(() => {
    if (anchor?.type !== 'threadPost') {
      return
    }
    const post = anchor.value.post
    openComposer({
      replyTo: {
        uri: anchor.uri,
        cid: post.cid,
        text: post.record.text,
        author: post.author,
        embed: post.embed,
        moderation: anchor.moderation,
        langs: post.record.langs,
      },
      onPostSuccess: optimisticOnPostReply,
      logContext: 'PostReply',
    })

    if (anchorPostSource) {
      feedFeedback.sendInteraction({
        item: post.uri,
        event: 'app.bsky.feed.defs#interactionReply',
        feedContext: anchorPostSource.post.feedContext,
        reqId: anchorPostSource.post.reqId,
      })
    }
  })

  const isRoot = !!anchor && anchor.value.post.record.reply === undefined
  const canReply = !anchor?.value.post?.viewer?.replyDisabled
  const alsoLikedFeedEnabled = useAlsoLikedFeedEnabled()
  const alsoLikedCollapseByDefault = useAlsoLikedCollapseByDefault()
  const alsoLikedAnchorUri =
    anchor?.type === 'threadPost' && isRoot ? anchor.value.post.uri : undefined
  const [deferParents, setDeferParents] = useState(true)
  const [alsoLikedCollapsed, setAlsoLikedCollapsed] = useState(
    alsoLikedCollapseByDefault,
  )
  const [maxAlsoLikedCount, setMaxAlsoLikedCount] =
    useState(ALSO_LIKED_PAGE_SIZE)
  useEffect(() => {
    setAlsoLikedCollapsed(alsoLikedCollapseByDefault)
  }, [alsoLikedAnchorUri, alsoLikedCollapseByDefault])
  useEffect(() => {
    setMaxAlsoLikedCount(ALSO_LIKED_PAGE_SIZE)
  }, [alsoLikedAnchorUri])
  const alsoLikedVisible =
    Boolean(alsoLikedAnchorUri) &&
    alsoLikedFeedEnabled &&
    !thread.state.isPlaceholderData &&
    !deferParents
  const alsoLikedEnabled = alsoLikedVisible && !alsoLikedCollapsed
  const alsoLiked = usePostAlsoLikedQuery(alsoLikedAnchorUri, {
    enabled: alsoLikedEnabled,
  })
  const alsoLikedPosts = useMemo(() => {
    const seen = new Set<string>()
    return (alsoLiked.data?.pages ?? [])
      .flatMap(page => page.posts)
      .filter(post => {
        if (seen.has(post.uri)) return false
        seen.add(post.uri)
        return true
      })
  }, [alsoLiked.data])
  const blockedOrMutedAlsoLikedAuthors =
    usePostViewAuthorShadowFilter(alsoLikedPosts)
  const filteredAlsoLikedPosts = useMemo(() => {
    return alsoLikedPosts.filter(post => {
      if (blockedOrMutedAlsoLikedAuthors.includes(post.author.did)) {
        return false
      }
      if (!moderationOpts) {
        return true
      }
      return !moderatePost(post, moderationOpts).ui('contentList').filter
    })
  }, [alsoLikedPosts, blockedOrMutedAlsoLikedAuthors, moderationOpts])
  const visibleAlsoLikedPosts = useMemo(() => {
    return filteredAlsoLikedPosts.slice(0, maxAlsoLikedCount)
  }, [filteredAlsoLikedPosts, maxAlsoLikedCount])
  const [maxParentCount, setMaxParentCount] = useState(PARENT_CHUNK_SIZE)
  const [maxChildrenCount, setMaxChildrenCount] = useState(CHILDREN_CHUNK_SIZE)
  const totalParentCount = useRef(0) // recomputed below
  const totalChildrenCount = useRef(thread.data.items.length) // recomputed below
  const listRef = useRef<ListMethods>(null)
  const anchorRef = useRef<HostInstance | null>(null)
  const headerRef = useRef<HostInstance | null>(null)
  const alsoLikedHeaderRef = useRef<HostInstance | null>(null)
  const currentScrollOffsetRef = useRef(0)
  const scrollStateRequestIdRef = useRef(0)
  const scrollStateAnimationFrameRef = useRef<number | null>(null)
  const [isAlsoLikedFocused, setIsAlsoLikedFocused] = useState(false)

  useEffect(() => {
    if (!alsoLikedVisible || alsoLikedCollapsed) {
      setIsAlsoLikedFocused(false)
    }
  }, [alsoLikedCollapsed, alsoLikedVisible])

  /*
   * On a cold load, parents are not prepended until the anchor post has
   * rendered as the first item in the list. This gives us a consistent
   * reference point for which to pin the anchor post to the top of the screen.
   *
   * We simulate a cold load any time the user changes the view or sort params
   * so that this handling is consistent.
   *
   * On native, `maintainVisibleContentPosition={{minIndexForVisible: 0}}` gives
   * us this for free, since the anchor post is the first item in the list.
   *
   * On web, `onContentSizeChange` is used to get ahead of next paint and handle
   * this scrolling.
   */
  /**
   * Used to flag whether we should scroll to the anchor post. On a cold load,
   * this is always true. And when a user changes thread parameters, we also
   * manually set this to true.
   */
  const shouldHandleScroll = useRef(true)
  /**
   * Called any time the content size of the list changes. Could be a fresh
   * render, items being added to the list, or any resize that changes the
   * scrollable size of the content.
   *
   * We want this to fire every time we change params (which will reset
   * `deferParents` via `onLayout` on the anchor post, due to the key change),
   * or click into a new post (which will result in a fresh `deferParents`
   * hook).
   *
   * The result being: any intentional change in view by the user will result
   * in the anchor being pinned as the first item.
   */
  const onContentSizeChangeWebOnly = web(
    useNonReactiveCallback(() => {
      const list = listRef.current
      const anchorElement = anchorRef.current as unknown as Element | null
      const header = headerRef.current as unknown as Element | null

      if (list && anchorElement && header && shouldHandleScroll.current) {
        const anchorOffsetTop = anchorElement.getBoundingClientRect().top
        const headerHeight = header.getBoundingClientRect().height

        // Like upstream, correct the anchor in the ResizeObserver callback,
        // before paint. Deferring this to requestAnimationFrame exposes a frame
        // of the newly prepended parents before the anchor is restored.
        // The measurement is viewport-relative, so add the current scroll offset.
        const delta = anchorOffsetTop - headerHeight
        const offset = currentScrollOffsetRef.current + delta
        if (Math.abs(delta) > 1) list.scrollToOffset({offset, animated: false})

        // Once parents are present, later image resizes must not re-anchor.
        if (offset > 0 || isRoot) shouldHandleScroll.current = false
      }
    }),
  )

  /**
   * Ditto the above, but for native.
   */
  const onContentSizeChangeNativeOnly = native(() => {
    const list = listRef.current
    const anchorElement = anchorRef.current

    if (list && anchorElement && shouldHandleScroll.current) {
      /*
       * `prepareForParamsUpdate` is called any time the user changes thread params like
       * `view` or `sort`, which sets `deferParents(true)` and resets the
       * scroll to the top of the list. However, there is a split second
       * where the top of the list is wherever the parents _just were_. So if
       * there were parents, the anchor is not at the top of the list just
       * prior to this handler being called.
       *
       * Once this handler is called, the anchor post is the first item in
       * the list (because of `deferParents` being `true`), and so we can
       * synchronously scroll the list back to the top of the list (which is
       * 0 on native, no need to handle `headerHeight`).
       */
      list.scrollToOffset({
        animated: false,
        offset: 0,
      })

      /*
       * After this first pass, `deferParents` will be `false`, and those
       * will render in. However, the anchor post will retain its position
       * because of `maintainVisibleContentPosition` handling on native. So we
       * don't need to let this handler run again, like we do on web.
       */
      shouldHandleScroll.current = false
    }
  })

  /**
   * Called any time the user changes thread params, such as `view` or `sort`.
   * Prepares the UI for repositioning of the scroll so that the anchor post is
   * always at the top after a params change.
   *
   * No need to handle max parents here, deferParents will handle that and we
   * want it to re-render with the same items above the anchor.
   */
  const prepareForParamsUpdate = useCallback(() => {
    /**
     * Truncate list so that anchor post is the first item in the list. Manual
     * scroll handling on web is predicated on this, and on native, this allows
     * `maintainVisibleContentPosition` to do its thing.
     */
    setDeferParents(true)
    // reset this to a lower value for faster re-render
    setMaxChildrenCount(CHILDREN_CHUNK_SIZE)
    // set flag
    shouldHandleScroll.current = true
  }, [setDeferParents, setMaxChildrenCount])

  const setSortWrapped = useCallback(
    (sort: string) => {
      setExpandedSeamUri(null)
      prepareForParamsUpdate()
      thread.actions.setSort(sort)
    },
    [thread, prepareForParamsUpdate],
  )

  /*
   * Reader view state. At most one seam is open at a time, tracked by its post
   * URI (null when none). Resets any time thread params change.
   */
  const [expandedSeamUri, setExpandedSeamUri] = useState<string | null>(null)
  const toggleSeam = useCallback(
    (seamUri: string) => {
      const willExpand = expandedSeamUri !== seamUri
      ax.metric('thread:click:readerSeamToggle', {expanded: willExpand})
      setExpandedSeamUri(willExpand ? seamUri : null)
    },
    [ax, expandedSeamUri],
  )
  /**
   * The view to restore when the header reader toggle is switched off. Null
   * until a non-reader view is seen this visit (e.g. when deep-linked
   * directly into reader view), in which case the user's saved preference is
   * used instead.
   */
  const lastNonReaderView = useRef<ThreadView | null>(null)

  const setViewWrapped = useCallback(
    (view: ThreadView) => {
      if (view === 'reader') {
        if (thread.state.view !== 'reader') {
          lastNonReaderView.current = thread.state.view
        }
        /*
         * Reader always reads from the start of the thread. If the anchor
         * data hasn't loaded yet, the effect below corrects the root once it
         * arrives.
         */
        setReaderRoot(getReaderRoot(thread.data.items) ?? uri)
      } else {
        setReaderRoot(null)
      }
      setExpandedSeamUri(null)
      prepareForParamsUpdate()
      thread.actions.setView(view)
    },
    [thread, anchor, uri, prepareForParamsUpdate],
  )

  /*
   * If reader view was entered before the thread data was available, the
   * root couldn't be derived at toggle time. Correct it once data arrives.
   */
  const readerRootCorrection =
    thread.state.view === 'reader' && anchor?.type === 'threadPost'
      ? getReaderRoot(thread.data.items)
      : null
  useEffect(() => {
    if (readerRootCorrection && readerRootCorrection !== readerRoot) {
      /*
       * One-shot correction after async data arrival (cold deep-link into a
       * mid-thread post). Re-anchoring requires the same scroll and
       * pagination reset as any other params change.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      prepareForParamsUpdate()
      setReaderRoot(readerRootCorrection)
    }
  }, [readerRootCorrection, readerRoot, prepareForParamsUpdate])

  const onPressReaderToggle = useCallback(() => {
    const enabled = thread.state.view !== 'reader'
    ax.metric('thread:click:readerToggle', {enabled, via: 'header'})
    setViewWrapped(
      enabled
        ? 'reader'
        : (lastNonReaderView.current ?? thread.state.savedView),
    )
  }, [ax, thread.state.view, thread.state.savedView, setViewWrapped])

  const hasOpThreadChain = hasReaderThread(thread.data.items)

  /*
   * Keep this sticky while a sort change temporarily replaces the response
   * with anchor-only placeholder data. On iOS, maintaining a visible child
   * while the reader transform or a sort reorders that child's surrounding
   * native views can crash the list. Parent prepending still uses the normal
   * behavior for threads whose item identities remain stable.
   */
  const opThreadChainUri = useRef<string | null>(null)
  if (opThreadChainUri.current !== uri) {
    opThreadChainUri.current = hasOpThreadChain ? uri : null
  } else if (hasOpThreadChain) {
    opThreadChainUri.current = uri
  }
  const disableIosVisiblePositionMaintenance =
    IS_IOS &&
    (thread.state.view === 'reader' || opThreadChainUri.current === uri)

  const onStartReached = () => {
    if (thread.state.isFetching) return
    // can be true after `prepareForParamsUpdate` is called
    if (deferParents) return
    // prevent any state mutations if we know we're done
    if (maxParentCount >= totalParentCount.current) return
    setMaxParentCount(n => n + PARENT_CHUNK_SIZE)
  }

  const onEndReached = () => {
    if (thread.state.isFetching) return
    // can be true after `prepareForParamsUpdate` is called
    if (deferParents) return
    if (maxChildrenCount < totalChildrenCount.current) {
      setMaxChildrenCount(prev => prev + CHILDREN_CHUNK_SIZE)
      return
    }
    if (alsoLikedAnchorUri && alsoLikedEnabled) {
      if (visibleAlsoLikedPosts.length < filteredAlsoLikedPosts.length) {
        setMaxAlsoLikedCount(current =>
          Math.min(
            current + ALSO_LIKED_PAGE_SIZE,
            filteredAlsoLikedPosts.length,
          ),
        )
        return
      }

      if (
        !alsoLiked.isLoading &&
        !alsoLiked.isFetchingNextPage &&
        alsoLiked.hasNextPage
      ) {
        void alsoLiked.fetchNextPage()
      }
    }
  }

  /*
   * In reader view, the OP self-thread chain is collapsed into continuous
   * segments separated by expandable seams before pagination slicing.
   */
  const reader = useMemo(() => {
    return thread.state.view === 'reader'
      ? buildReaderThread(thread.data.items, {expandedSeamUri})
      : null
  }, [thread.state.view, thread.data.items, expandedSeamUri])
  const sourceItems = reader?.items ?? thread.data.items

  /*
   * Show a floating collapse button when the open seam has replies, so the
   * user can close them without scrolling back up.
   */
  const showHideRepliesButton =
    !!expandedSeamUri && (reader?.expandedSeam?.hiddenReplyCount ?? 0) > 0

  const slices = useMemo(() => {
    const results: ReaderItem[] = []

    if (!sourceItems.length) return results

    /*
     * Pagination hack, tracks the # of items below the anchor post.
     */
    let childrenCount = 0

    for (let i = 0; i < sourceItems.length; i++) {
      const item = sourceItems[i]
      /*
       * Need to check `depth`, since not found or blocked posts are not
       * `threadPost`s, but still have `depth`.
       */
      const hasDepth = 'depth' in item

      /*
       * Handle anchor post.
       */
      if (hasDepth && item.depth === 0) {
        results.push(item)

        // Recalculate total parents current index.
        totalParentCount.current = i
        // Recalculate total children using (length - 1) - current index.
        totalChildrenCount.current = sourceItems.length - 1 - i

        /*
         * Walk up the parents, limiting by `maxParentCount`
         */
        if (!deferParents) {
          const start = i - 1
          if (start >= 0) {
            const limit = Math.max(0, start - maxParentCount)
            for (let pi = start; pi >= limit; pi--) {
              results.unshift(sourceItems[pi])
            }
          }
        }
      } else {
        // ignore any parent items
        if (item.type === 'readMoreUp' || (hasDepth && item.depth < 0)) continue
        // can exit early if we've reached the max children count
        if (childrenCount > maxChildrenCount) break

        results.push(item)
        childrenCount++
      }
    }

    return results
  }, [sourceItems, deferParents, maxParentCount, maxChildrenCount])

  /**
   * Defer rendering reply skeletons so that the anchor post (from cache)
   * can paint without being blocked by skeleton layout work. On mount,
   * skeletons are filtered out. After the first render, they're added
   * back via a low-priority transition.
   */
  const [showReplySkeletons, setShowReplySkeletons] = useState(false)
  useEffect(() => {
    if (thread.state.isPlaceholderData && !showReplySkeletons) {
      startTransition(() => {
        setShowReplySkeletons(true)
      })
    }
  }, [thread.state.isPlaceholderData, showReplySkeletons])

  const deferredSlices = useMemo(() => {
    if (showReplySkeletons) return slices
    return slices.filter(
      item => !(item.type === 'skeleton' && item.item === 'reply'),
    )
  }, [slices, showReplySkeletons])

  const isTombstoneView = useMemo(() => {
    if (deferredSlices.length > 1) return false
    return deferredSlices.every(
      s => s.type === 'threadPostBlocked' || s.type === 'threadPostNotFound',
    )
  }, [deferredSlices])

  const renderItem = useCallback(
    ({item, index}: {item: ReaderItem; index: number}) => {
      if (item.type === 'threadPost') {
        if (item.depth < 0) {
          return (
            <ThreadItemPost
              item={item}
              threadgateRecord={thread.data.threadgate?.record ?? undefined}
              overrides={{
                topBorder: index === 0,
              }}
              onPostSuccess={optimisticOnPostReply}
            />
          )
        } else if (item.depth === 0) {
          return (
            /*
             * Keep this view wrapped so that the anchor post is always index 0
             * in the list and `maintainVisibleContentPosition` can do its
             * thing.
             */
            <View collapsable={false}>
              <View
                /*
                 * IMPORTANT: this is a load-bearing key on all platforms. We
                 * want to force `onLayout` to fire any time the thread params
                 * change so that `deferParents` is always reset to `false` once
                 * the anchor post is rendered.
                 *
                 * If we ever add additional thread params to this screen, they
                 * will need to be added here.
                 */
                key={item.uri + thread.state.view + thread.state.sort}
                ref={anchorRef}
                onLayout={() => setDeferParents(false)}
              />
              <ThreadItemAnchor
                item={item}
                readerSeam={
                  reader?.anchorSeam
                    ? {
                        ...reader.anchorSeam,
                        onToggle: () => toggleSeam(item.uri),
                        sort: thread.state.sort,
                      }
                    : undefined
                }
                threadgateRecord={thread.data.threadgate?.record ?? undefined}
                onPostSuccess={optimisticOnPostReply}
                postSource={anchorPostSource}
              />
            </View>
          )
        } else {
          if (thread.state.view === 'tree') {
            return (
              <ThreadItemTreePost
                item={item}
                threadgateRecord={thread.data.threadgate?.record ?? undefined}
                overrides={{
                  moderation: thread.state.otherItemsVisible && item.depth > 0,
                }}
                onPostSuccess={optimisticOnPostReply}
              />
            )
          } else {
            return (
              <ThreadItemPost
                item={item}
                threadgateRecord={thread.data.threadgate?.record ?? undefined}
                overrides={{
                  moderation: thread.state.otherItemsVisible && item.depth > 0,
                }}
                onPostSuccess={optimisticOnPostReply}
              />
            )
          }
        }
      } else if (item.type === 'readerSegment') {
        return (
          <ThreadItemReaderSegment
            item={item}
            sort={thread.state.sort}
            onToggleSeam={toggleSeam}
            threadgateRecord={thread.data.threadgate?.record ?? undefined}
            onPostSuccess={optimisticOnPostReply}
          />
        )
      } else if (item.type === 'threadPostNoUnauthenticated') {
        if (item.depth < 0) {
          return <ThreadItemPostNoUnauthenticated item={item} />
        } else if (item.depth === 0) {
          return <ThreadItemAnchorNoUnauthenticated />
        }
      } else if (item.type === 'readMore') {
        return (
          <ThreadItemReadMore
            item={item}
            view={thread.state.view === 'tree' ? 'tree' : 'linear'}
          />
        )
      } else if (item.type === 'readMoreUp') {
        return <ThreadItemReadMoreUp item={item} />
      } else if (item.type === 'threadPostBlocked') {
        return <ThreadItemPostTombstone type="blocked" />
      } else if (item.type === 'threadPostNotFound') {
        return <ThreadItemPostTombstone type="not-found" />
      } else if (item.type === 'replyComposer') {
        return (
          <View>
            {gtMobile && (
              <ThreadComposePrompt onPressCompose={onReplyToAnchor} />
            )}
          </View>
        )
      } else if (item.type === 'showOtherReplies') {
        return <ThreadItemShowOtherReplies onPress={item.onPress} />
      } else if (item.type === 'skeleton') {
        if (item.item === 'anchor') {
          return <ThreadItemAnchorSkeleton />
        } else if (item.item === 'reply') {
          if (thread.state.view === 'linear') {
            return <ThreadItemPostSkeleton index={index} />
          } else {
            return <ThreadItemTreePostSkeleton index={index} />
          }
        } else if (item.item === 'replyComposer') {
          return <ThreadItemReplyComposerSkeleton />
        }
      }
      return null
    },
    [
      thread,
      reader,
      toggleSeam,
      optimisticOnPostReply,
      onReplyToAnchor,
      gtMobile,
      anchorPostSource,
    ],
  )

  const defaultListFooterHeight = hasParents ? windowHeight - 200 : undefined
  const retryAlsoLiked = useCallback(() => {
    if (alsoLikedPosts.length > 0) {
      void alsoLiked.fetchNextPage()
    } else {
      void alsoLiked.refetch()
    }
  }, [alsoLiked, alsoLikedPosts.length])
  const toggleAlsoLikedCollapsed = useCallback(() => {
    setAlsoLikedCollapsed(current => !current)
  }, [])
  const runAlsoLikedScrollStateUpdate = useNonReactiveCallback(
    (requestId: number) => {
      scrollStateAnimationFrameRef.current = null

      if (
        !alsoLikedVisible ||
        alsoLikedCollapsed ||
        !alsoLikedHeaderRef.current ||
        !headerRef.current
      ) {
        setIsAlsoLikedFocused(false)
        return
      }

      measureViewRect(headerRef.current, headerRect => {
        if (requestId !== scrollStateRequestIdRef.current) return
        if (!headerRect) {
          setIsAlsoLikedFocused(false)
          return
        }

        measureViewRect(alsoLikedHeaderRef.current, alsoLikedRect => {
          if (requestId !== scrollStateRequestIdRef.current) return
          if (!alsoLikedRect) {
            setIsAlsoLikedFocused(false)
            return
          }

          const headerBottom = headerRect.y + headerRect.height
          const focused = alsoLikedRect.y <= headerBottom

          setIsAlsoLikedFocused(current =>
            current === focused ? current : focused,
          )
        })
      })
    },
  )
  const scheduleAlsoLikedScrollStateUpdate = useNonReactiveCallback(() => {
    if (scrollStateAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollStateAnimationFrameRef.current)
    }

    const requestId = scrollStateRequestIdRef.current
    scrollStateAnimationFrameRef.current = requestAnimationFrame(() => {
      runAlsoLikedScrollStateUpdate(requestId)
    })
  })
  const handleScrollOffsetChange = useNonReactiveCallback((offsetY: number) => {
    currentScrollOffsetRef.current = offsetY
    if (offsetY <= 1) {
      scrollStateRequestIdRef.current += 1
      setIsAlsoLikedFocused(false)
      return
    }
    if (!alsoLikedVisible || alsoLikedCollapsed) {
      return
    }
    scrollStateRequestIdRef.current += 1
    scheduleAlsoLikedScrollStateUpdate()
  })

  useEffect(() => {
    return () => {
      if (scrollStateAnimationFrameRef.current !== null) {
        cancelAnimationFrame(scrollStateAnimationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    scrollStateRequestIdRef.current += 1
    scheduleAlsoLikedScrollStateUpdate()
  }, [
    alsoLikedCollapsed,
    alsoLikedPosts.length,
    alsoLikedVisible,
    scheduleAlsoLikedScrollStateUpdate,
  ])

  return (
    <PostThreadContextProvider context={thread.context}>
      <Layout.Header.Outer headerRef={headerRef}>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {isAlsoLikedFocused ? (
              <Trans>Posts also liked</Trans>
            ) : (
              <Trans context="description">Post</Trans>
            )}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {(hasOpThreadChain || thread.state.view === 'reader') && (
          <Layout.Header.Slot>
            <HeaderReaderToggle
              active={thread.state.view === 'reader'}
              onPress={onPressReaderToggle}
            />
          </Layout.Header.Slot>
        )}
        <Layout.Header.Slot>
          <HeaderDropdown
            sort={thread.state.sort}
            setSort={setSortWrapped}
            view={thread.state.view}
            setView={setViewWrapped}
            showReader={hasOpThreadChain || thread.state.view === 'reader'}
          />
        </Layout.Header.Slot>
      </Layout.Header.Outer>

      {thread.state.error ? (
        <ThreadError
          error={thread.state.error}
          onRetry={thread.actions.refetch}
        />
      ) : (
        <List
          ref={listRef}
          data={deferredSlices}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onContentSizeChange={platform({
            web: onContentSizeChangeWebOnly,
            default: onContentSizeChangeNativeOnly,
          })}
          onStartReached={onStartReached}
          onEndReached={onEndReached}
          onEndReachedThreshold={2}
          onStartReachedThreshold={1}
          onScrollOffsetChange={handleScrollOffsetChange}
          onItemSeen={(item: ReaderItem) => {
            // Track post:view for parent posts and replies (non-anchor posts)
            if (item.type === 'threadPost' && item.depth !== 0) {
              trackThreadItemView(item.value.post)
            } else if (item.type === 'readerSegment') {
              trackThreadItemView(item.item.value.post)
            }
          }}
          /**
           * NATIVE ONLY
           * {@link https://reactnative.dev/docs/scrollview#maintainvisiblecontentposition}
           */
          maintainVisibleContentPosition={
            disableIosVisiblePositionMaintenance
              ? undefined
              : {minIndexForVisible: 0}
          }
          desktopFixedHeight
          sideBorders={false}
          ListFooterComponent={
            <ThreadAlsoLiked
              posts={visibleAlsoLikedPosts}
              visible={alsoLikedVisible}
              collapsed={alsoLikedCollapsed}
              isLoading={alsoLiked.isLoading}
              showLoadingState={
                !alsoLikedCollapsed &&
                !alsoLiked.error &&
                visibleAlsoLikedPosts.length === 0 &&
                (!alsoLiked.isFetched ||
                  alsoLiked.isLoading ||
                  (alsoLiked.hasNextPage && alsoLiked.isFetchingNextPage))
              }
              isFetchingNextPage={alsoLiked.isFetchingNextPage}
              error={alsoLiked.error}
              onRetry={retryAlsoLiked}
              headerRef={alsoLikedHeaderRef}
              onToggleCollapsed={toggleAlsoLikedCollapsed}
              spacerHeight={platform({
                web: defaultListFooterHeight,
                default: deferParents
                  ? windowHeight * 2
                  : defaultListFooterHeight,
              })}
              isTombstoneView={isTombstoneView}
            />
          }
          initialNumToRender={initialNumToRender}
          /**
           * Default: 21
           *
           * Smaller for placeholder data so we don't waste time rendering skeletons
           */
          windowSize={thread.state.isPlaceholderData ? 1 : 7}
          /**
           * Default: 10
           */
          maxToRenderPerBatch={5}
          /**
           * Default: 50
           */
          updateCellsBatchingPeriod={100}
        />
      )}

      {!gtMobile &&
        canReply &&
        hasSession &&
        thread.state.view !== 'reader' && (
          <MobileComposePrompt onPressReply={onReplyToAnchor} />
        )}

      {showHideRepliesButton && (
        <ReaderHideRepliesButton onPress={() => toggleSeam(expandedSeamUri)} />
      )}
    </PostThreadContextProvider>
  )
}

/**
 * Floating pill shown while a reader seam is expanded to show replies, so
 * they can be collapsed from anywhere without scrolling back to the seam.
 */
function ReaderHideRepliesButton({onPress}: {onPress: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {footerHeight} = useShellLayout()
  const enableSquareButtons = useEnableSquareButtons()

  const animatedStyle = useAnimatedStyle(() => {
    return {
      bottom: footerHeight.get() + tokens.space.lg,
    }
  })

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      pointerEvents="box-none"
      style={[a.fixed, a.left_0, a.right_0, a.align_center, animatedStyle]}>
      <Button label={l`Hide replies`} onPress={onPress} hitSlop={HITSLOP_10}>
        {({hovered, pressed}) => (
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_xs,
              a.px_lg,
              a.py_sm,
              getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
              a.border,
              t.atoms.shadow_sm,
              t.atoms.border_contrast_low,
              hovered || pressed ? t.atoms.bg_contrast_25 : t.atoms.bg,
            ]}>
            <ChevronTopIcon
              size="sm"
              style={[t.atoms.text_contrast_medium]}
              aria-hidden
            />
            <Text style={[a.text_sm, a.font_semi_bold]}>
              <Trans>Hide replies</Trans>
            </Text>
          </View>
        )}
      </Button>
    </Animated.View>
  )
}

function MobileComposePrompt({onPressReply}: {onPressReply: () => unknown}) {
  const {footerHeight} = useShellLayout()

  const animatedStyle = useAnimatedStyle(() => {
    return {
      bottom: footerHeight.get(),
    }
  })

  return (
    <Animated.View style={[a.fixed, a.left_0, a.right_0, animatedStyle]}>
      <ThreadComposePrompt onPressCompose={onPressReply} />
    </Animated.View>
  )
}

const keyExtractor = (item: ReaderItem) => {
  return item.key
}

type ViewRect = {
  x: number
  y: number
  width: number
  height: number
}

function measureViewRect(
  view: HostInstance | null,
  cb: (rect: ViewRect | null) => void,
) {
  const target = view
  if (!target) {
    cb(null)
    return
  }

  if (typeof target.measureInWindow === 'function') {
    target.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        cb({x, y, width, height})
      },
    )
    return
  }

  if (typeof target.getBoundingClientRect === 'function') {
    const rect = target.getBoundingClientRect()
    cb({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    })
    return
  }

  if (typeof target.measure === 'function') {
    target.measure(
      (
        _x: number,
        _y: number,
        width: number,
        height: number,
        pageX: number,
        pageY: number,
      ) => {
        cb({x: pageX, y: pageY, width, height})
      },
    )
    return
  }

  cb(null)
}
