import {render, screen} from '@testing-library/react-native'

import {DISCOVER_FEED_URI} from '#/lib/constants'
import {PostFeed} from './PostFeed'

let mockDisableComposerPrompt = false
let mockHideUnreplyablePosts = false
let mockHideQuotesOfBlockedAccounts = false
let mockRepostCarousel = false
let mockAnchored = false
let mockSeenUris: string[] = []
const mockFetchNextPage = jest.fn()

jest.mock('@lingui/react', () => ({useLingui: () => ({_: () => ''})}))
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({}),
}))
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({
    features: {getValue: (_: unknown, fallback: unknown) => fallback},
  }),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({palette: {primary_500: 'purple'}}),
  useLayoutBreakpoints: () => ({rightNavVisible: true}),
}))
jest.mock('#/state/session', () => ({useSession: () => ({hasSession: true})}))
jest.mock('#/state/cache/profile-shadow', () => ({
  usePostAuthorShadowFilter: () => [],
}))
jest.mock('#/state/events', () => ({listenPostCreated: () => () => {}}))
jest.mock('#/state/feed-feedback', () => ({
  useFeedFeedbackContext: () => ({onItemSeen: jest.fn()}),
}))
jest.mock('#/state/preferences/disable-composer-prompt', () => ({
  useDisableComposerPrompt: () => mockDisableComposerPrompt,
}))
jest.mock('#/state/preferences/hide-unreplyable-posts', () => ({
  useHideUnreplyablePosts: () => mockHideUnreplyablePosts,
}))
jest.mock('#/state/preferences/hide-quotes-of-blocked-accounts', () => ({
  useHideQuotesOfBlockedAccounts: () => mockHideQuotesOfBlockedAccounts,
}))
jest.mock('#/state/preferences/seen-posts', () => ({
  useSeenPostsEnabled: () => mockSeenUris.length > 0,
}))
jest.mock('#/state/seen-posts', () => ({
  markSeen: () => {},
  getSeenAt: (uri: string) =>
    mockSeenUris.includes(uri) ? 0 : undefined,
}))
jest.mock('#/state/preferences/repost-carousel-enabled', () => ({
  useRepostCarouselEnabled: () => mockRepostCarousel,
}))
jest.mock('#/state/preferences/trending', () => ({
  useTrendingSettings: () => ({}),
}))
jest.mock('#/state/shell/progress-guide', () => ({
  useProgressGuide: () => false,
}))
jest.mock('#/state/shell/selected-feed', () => ({
  useSelectedFeed: () => 'following',
}))
jest.mock('#/lib/hooks/useBottomBarOffset', () => ({
  useBottomBarOffset: () => 0,
}))
jest.mock('#/lib/hooks/useInitialNumToRender', () => ({
  useInitialNumToRender: () => 10,
}))
jest.mock('#/lib/userstyles', () => ({userStyle: () => ({})}))
jest.mock(
  '#/components/ageAssurance/AgeAssuranceDismissibleFeedBanner',
  () => ({useInternalState: () => ({visible: false})}),
)
jest.mock('#/components/feeds/PostFeedVideoGridRow', () => ({
  useVideoGridColumns: () => 2,
}))
jest.mock('#/view/com/util/List', () => {
  const {Text} = jest.requireActual('react-native')
  return {
    List: ({data}: {data: {key: string; type: string}[]}) =>
      data.map(row => <Text key={row.key}>{row.type}</Text>),
  }
})
jest.mock('#/lib/ScrollContext', () => ({
  ScrollProvider: ({children}: {children: React.ReactNode}) => children,
}))
jest.mock('#/features/followingV2/eligibility', () => ({
  isFollowingV2Eligible: () => mockAnchored,
}))
jest.mock('#/features/liveNow', () => ({useLiveNowConfig: () => ({})}))
jest.mock('./useListRest', () => ({useListRest: () => ({scrollHandlers: {}})}))
jest.mock('./useAnchorCorrectionScrollHandlers', () => ({
  useAnchorCorrectionScrollHandlers: () => ({}),
}))
jest.mock('./useSettleScrollHandlers', () => ({
  useSettleScrollHandlers: () => ({}),
}))
jest.mock('./useSettleAtTop', () => ({useSettleAtTop: () => ({})}))
jest.mock('./useNewPostsCheck', () => ({useNewPostsCheck: () => {}}))
jest.mock('./usePrependPill', () => ({
  usePrependPill: () => ({visible: false}),
}))
jest.mock('./PrependPill', () => ({PrependPill: () => null}))
jest.mock('./queries/savedFeedSamples', () => ({
  useSavedFeedSamples: () => undefined,
}))
jest.mock('./queries/postFeed', () => ({
  usePostFeedParams: (_: unknown, params: unknown) => params,
  usePostFeedQuery: () => ({
    data: {
      pages: [{slices: mockSeenUris.length ? [] : mockSlices, fetchedAt: 1}],
    },
    isFetched: true,
    hasNextPage: mockSeenUris.length > 0,
    fetchNextPage: mockFetchNextPage,
  }),
  usePostFeedFetcher: () => ({}),
  usePostFeedRefresh: () => ({}),
  usePostFeedPrepend: () => ({}),
  usePostFeedGapFill: () => ({}),
  findGaps: () => new Map(),
}))

// Render the real row builder without mounting the post UI for every row.
jest.mock('#/view/com/feeds/ComposerPrompt', () => ({}))
jest.mock('#/view/com/posts/DiscoverFallbackHeader', () => ({}))
jest.mock('#/view/com/posts/FeedShutdownMsg', () => ({}))
jest.mock('#/view/com/posts/PostFeedErrorMessage', () => ({}))
jest.mock('#/view/com/posts/PostFeedItem', () => ({}))
jest.mock('#/view/com/posts/ShowLessFollowup', () => ({}))
jest.mock('#/view/com/posts/ViewFullThread', () => ({}))
jest.mock('#/view/com/util/error/ErrorMessage', () => ({}))
jest.mock('#/view/com/util/LoadMoreRetryBtn', () => ({}))
jest.mock('#/components/FeedInterstitials', () => ({}))
jest.mock('#/components/interstitials/FeedTrendingTopics', () => ({}))
jest.mock('#/components/interstitials/TrendingVideos', () => ({}))
jest.mock('#/components/PostFeedItemCarousel', () => ({}))
jest.mock('#/components/PostFeedSkeleton', () => ({}))
jest.mock('#/components/RichText', () => ({}))
jest.mock(
  '#/features/liveEvents/components/DiscoverFeedLiveEventFeedsAndTrendingBanner',
  () => ({}),
)
jest.mock('./GapRow', () => ({}))

const mockSlices = Array.from({length: 12}, (_, i) => ({
  _reactKey: `slice-${i}`,
  feedPostUri: `at://did:plc:author/app.bsky.feed.post/${i}`,
  items: [
    {
      _reactKey: `post-${i}`,
      post: {
        author: {did: 'did:plc:author'},
        viewer: {replyDisabled: i === 0},
        embed:
          i === 1
            ? {
                $type: 'app.bsky.embed.record#view',
                record: {
                  $type: 'app.bsky.embed.record#viewBlocked',
                  author: {
                    did: 'did:plc:blocked',
                    viewer: {blocking: 'at://block'},
                  },
                },
              }
            : undefined,
      },
    },
  ],
  reason: i < 5 ? {$type: 'app.bsky.feed.defs#reasonRepost'} : undefined,
}))

beforeEach(() => {
  mockDisableComposerPrompt = false
  mockHideUnreplyablePosts = false
  mockHideQuotesOfBlockedAccounts = false
  mockRepostCarousel = false
  mockAnchored = false
  mockSeenUris = []
  mockFetchNextPage.mockClear()
})

it('loads the next page when filtering leaves nothing to scroll', () => {
  mockSeenUris = ['at://did:plc:author/app.bsky.feed.post/0']
  render(
    <PostFeed
      feed="following"
      enabled={false}
      renderEmptyState={() => <></>}
    />,
  )
  expect(mockFetchNextPage).toHaveBeenCalled()
})

it.each(['following', `feedgen|${DISCOVER_FEED_URI}`] as const)(
  'updates composer prompt rows when the preference changes in %s',
  feed => {
    const props = {feed, enabled: false, renderEmptyState: () => <></>}
    const {rerender} = render(<PostFeed {...props} />)
    expect(screen.getByText('composerPrompt')).toBeTruthy()
    mockDisableComposerPrompt = true
    rerender(<PostFeed {...props} extraData={{changed: true}} />)
    expect(screen.queryByText('composerPrompt')).toBeNull()
    mockDisableComposerPrompt = false
    rerender(<PostFeed {...props} extraData={{changed: false}} />)
    expect(screen.getByText('composerPrompt')).toBeTruthy()
  },
)

it('keeps a composer row out of an anchored Following feed', () => {
  mockAnchored = true
  render(
    <PostFeed
      feed="following"
      enabled={false}
      renderEmptyState={() => <></>}
    />,
  )
  expect(screen.queryByText('composerPrompt')).toBeNull()
})

it('honors feed filters and repost carousels in v2', () => {
  mockHideUnreplyablePosts = true
  mockRepostCarousel = true
  render(
    <PostFeed
      feed="following"
      enabled={false}
      renderEmptyState={() => <></>}
    />,
  )
  expect(screen.getByText('reposts')).toBeTruthy()
  expect(screen.getAllByText('sliceItem')).toHaveLength(7)
})

it('updates quoted-block filtering when its preference changes', () => {
  mockHideQuotesOfBlockedAccounts = true
  const props = {
    feed: 'following' as const,
    enabled: false,
    renderEmptyState: () => <></>,
  }
  const {rerender} = render(<PostFeed {...props} />)
  expect(screen.getAllByText('sliceItem')).toHaveLength(11)
  mockHideQuotesOfBlockedAccounts = false
  rerender(<PostFeed {...props} extraData={{changed: true}} />)
  expect(screen.getAllByText('sliceItem')).toHaveLength(12)
})
