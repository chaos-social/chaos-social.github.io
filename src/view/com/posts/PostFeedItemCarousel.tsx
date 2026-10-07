import {useCallback, useRef, useState} from 'react'
import {
  type HostInstance,
  ScrollView,
  type ScrollViewImperativeMethods,
  useWindowDimensions,
  View,
} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Plural, useLingui} from '@lingui/react/macro'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {type FeedPostSlice} from '#/state/queries/post-feed'
import {BlockDrawerGesture} from '#/view/shell/BlockDrawerGesture'
import {atoms as a, useTheme, utils, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronBottom,
  ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeft,
  ChevronRight_Stroke2_Corner0_Rounded as ChevronRight,
  ChevronTop_Stroke2_Corner0_Rounded as ChevronTop,
} from '#/components/icons/Chevron'
import {GalleryBleed} from '#/components/images/Gallery'
import {ITEM_GAP} from '#/components/images/Gallery/const'
import {tween} from '#/components/images/Gallery/tween'
import {useKeyboardHandlers} from '#/components/images/Gallery/useKeyboardHandlers'
import {usePointerHandlers} from '#/components/images/Gallery/usePointerHandlers'
import {getOffsetForIndex} from '#/components/images/Gallery/utils'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {PostFeedItem} from './PostFeedItem'

const CARD_WIDTH = 320
const CARD_INTERVAL = CARD_WIDTH + ITEM_GAP
const SETTLE_DURATION = 700
const MAX_CAROUSEL_HEIGHT = 520
const CAROUSEL_VIEWPORT_RATIO = 0.55
const BOTTOM_FADE_HEIGHT = 96

function RepostCarouselViewport({
  children,
  expanded,
}: {
  children: React.ReactNode
  expanded: boolean
}) {
  const t = useTheme()
  const {height} = useWindowDimensions()
  const maxHeight = Math.min(
    MAX_CAROUSEL_HEIGHT,
    height * CAROUSEL_VIEWPORT_RATIO,
  )

  return (
    <View
      style={[
        a.w_full,
        a.overflow_hidden,
        {maxHeight: expanded ? undefined : maxHeight},
      ]}>
      {children}
      {!expanded && (
        <LinearGradient
          key={t.name}
          pointerEvents="none"
          colors={[
            utils.alpha(t.palette.contrast_25, 0),
            t.palette.contrast_25,
          ]}
          locations={[0, 1]}
          style={[
            a.absolute,
            {
              right: 0,
              bottom: 0,
              left: 0,
              height: BOTTOM_FADE_HEIGHT,
            },
          ]}
        />
      )}
    </View>
  )
}

function RepostCard({
  slice,
  itemRef,
}: {
  slice: FeedPostSlice
  itemRef?: (node: HostInstance | null) => void
}) {
  const t = useTheme()
  const item = slice.items[0]
  const cornerShape = useEnableSquareButtons()

  /*
   * GalleryBleed sizes nested image carousels to this card instead of the
   * viewport. It also applies overflow: hidden for border-radius clipping.
   */
  return (
    <GalleryBleed>
      <View
        ref={itemRef}
        {...(IS_WEB && {
          dataSet: {
            keyboardNavigationCard: 'true',
            keyboardNavigationCardSharp:
              cornerShape === 'sharp' ? 'true' : 'false',
          },
        })}
        style={[
          {
            width: CARD_WIDTH,
            alignSelf: 'flex-start',
          },
          getShapeStyle(cornerShape, a.rounded_md, a.rounded_md),
          a.border,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          a.flex_shrink_0,
        ]}>
        <PostFeedItem
          post={item.post}
          record={item.record}
          reason={slice.reason}
          feedContext={slice.feedContext}
          moderation={item.moderation}
          parentAuthor={item.parentAuthor}
          isParentBlocked={item.isParentBlocked}
          isParentNotFound={item.isParentNotFound}
          hideTopBorder={true}
          isCarouselItem={true}
          rootPost={slice.items[0].post}
          showReplyTo={false}
          reqId={undefined}
        />
      </View>
    </GalleryBleed>
  )
}

function RepostCarouselHeader({
  count,
  expanded,
  onToggleExpanded,
  onScrollLeft,
  onScrollRight,
}: {
  count: number
  expanded: boolean
  onToggleExpanded: () => void
  onScrollLeft: () => void
  onScrollRight: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const enableSquareButtons = useEnableSquareButtons()

  return (
    <View
      style={[
        a.py_lg,
        a.px_md,
        a.pb_xs,
        a.flex_row,
        a.align_center,
        a.justify_between,
      ]}>
      <View style={[a.gap_md, a.flex_row, a.align_center]}>
        <Button
          label={
            expanded ? l`Collapse repost carousel` : l`Expand repost carousel`
          }
          accessibilityState={{expanded}}
          size="tiny"
          variant="ghost"
          color="secondary"
          shape={enableSquareButtons ? 'square' : 'round'}
          onPress={onToggleExpanded}>
          <ButtonIcon icon={expanded ? ChevronTop : ChevronBottom} />
        </Button>
        <Text style={[a.text_sm, a.font_bold, t.atoms.text_contrast_medium]}>
          {count} <Plural value={count} one="repost" other="reposts" />
        </Text>
      </View>
      <View style={[a.gap_md, a.flex_row, a.align_end]}>
        <Button
          label={l`Scroll carousel left`}
          size="tiny"
          variant="ghost"
          color="secondary"
          shape={enableSquareButtons ? 'square' : 'round'}
          onPress={onScrollLeft}>
          <ButtonIcon icon={ChevronLeft} />
        </Button>
        <Button
          label={l`Scroll carousel right`}
          size="tiny"
          variant="ghost"
          color="secondary"
          shape={enableSquareButtons ? 'square' : 'round'}
          onPress={onScrollRight}>
          <ButtonIcon icon={ChevronRight} />
        </Button>
      </View>
    </View>
  )
}

function RepostCarouselNative({
  items,
  expanded,
  onToggleExpanded,
}: {
  items: FeedPostSlice[]
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const scrollRef = useRef<(HostInstance & ScrollViewImperativeMethods) | null>(
    null,
  )
  const currentIndexRef = useRef(0)

  const scrollToIndex = useCallback((index: number) => {
    currentIndexRef.current = index
    scrollRef.current?.scrollTo({
      x: index * CARD_INTERVAL,
      y: 0,
      animated: true,
    })
  }, [])

  const scrollLeft = useCallback(() => {
    const current = currentIndexRef.current
    const next = current > 0 ? current - 1 : items.length - 1
    scrollToIndex(next)
  }, [items.length, scrollToIndex])

  const scrollRight = useCallback(() => {
    const current = currentIndexRef.current
    const next = current < items.length - 1 ? current + 1 : 0
    scrollToIndex(next)
  }, [items.length, scrollToIndex])

  return (
    <>
      <RepostCarouselHeader
        count={items.length}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        onScrollLeft={scrollLeft}
        onScrollRight={scrollRight}
      />
      <RepostCarouselViewport expanded={expanded}>
        <BlockDrawerGesture>
          <ScrollView
            ref={scrollRef}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_INTERVAL}
            decelerationRate="fast"
            onMomentumScrollEnd={e => {
              currentIndexRef.current = Math.round(
                e.nativeEvent.contentOffset.x / CARD_INTERVAL,
              )
            }}
            contentContainerStyle={[a.px_md, a.pt_sm, a.pb_lg]}>
            <View style={[a.flex_row, a.align_start, {gap: ITEM_GAP}]}>
              {items.map(slice => (
                <RepostCard key={slice.items[0]._reactKey} slice={slice} />
              ))}
            </View>
          </ScrollView>
        </BlockDrawerGesture>
      </RepostCarouselViewport>
    </>
  )
}

function RepostCarouselWeb({
  items,
  expanded,
  onToggleExpanded,
}: {
  items: FeedPostSlice[]
  expanded: boolean
  onToggleExpanded: () => void
}) {
  const {t: l} = useLingui()
  const scrollRef = useRef<(HostInstance & ScrollViewImperativeMethods) | null>(
    null,
  )
  const itemWidthsRef = useRef<Map<number, number>>(new Map())
  const itemRefsRef = useRef<Map<number, HostInstance>>(new Map())
  const currentIndexRef = useRef(0)
  const stopTweenRef = useRef<(() => void) | null>(null)

  const scrollTo = useCallback((offset: number) => {
    const el =
      scrollRef.current?.getScrollableNode() as unknown as HTMLElement | null
    if (el) {
      el.scrollLeft = offset
    }
  }, [])

  const onSettle = useCallback((index: number) => {
    currentIndexRef.current = index
    itemRefsRef.current.forEach((node, i) => {
      const el = node as unknown as HTMLElement
      el.tabIndex = i === index ? 0 : -1
    })
    const el = itemRefsRef.current.get(index) as unknown as HTMLElement | null
    el?.focus({preventScroll: true})
  }, [])

  const scrollToIndex = useCallback(
    (index: number) => {
      const el =
        scrollRef.current?.getScrollableNode() as unknown as HTMLElement | null
      if (!el) return

      if (stopTweenRef.current) {
        stopTweenRef.current()
        stopTweenRef.current = null
      }

      /*
       * Update the index immediately (matching native) so rapid arrow presses
       * advance past an in-flight settle instead of re-targeting the same slide.
       */
      currentIndexRef.current = index

      const from = el.scrollLeft
      const to = getOffsetForIndex(itemWidthsRef.current, index)
      if (from === to) {
        onSettle(index)
        return
      }

      stopTweenRef.current = tween(
        from,
        to,
        SETTLE_DURATION,
      )(
        v => {
          scrollTo(v)
        },
        () => {
          stopTweenRef.current = null
          onSettle(index)
        },
      )
    },
    [onSettle, scrollTo],
  )

  const scrollLeft = useCallback(() => {
    const current = currentIndexRef.current
    const next = current > 0 ? current - 1 : items.length - 1
    scrollToIndex(next)
  }, [items.length, scrollToIndex])

  const scrollRight = useCallback(() => {
    const current = currentIndexRef.current
    const next = current < items.length - 1 ? current + 1 : 0
    scrollToIndex(next)
  }, [items.length, scrollToIndex])

  /*
   * Use ScrollView (not FlatList) so nested media Galleries can keep their own
   * horizontal FlatList. Nested VirtualizedLists break inner carousels into a
   * vertical stack and stretch sibling cards to the tallest item.
   */
  useKeyboardHandlers({
    flatListRef: scrollRef,
    itemWidthsRef,
    currentIndexRef,
    scrollTo,
    onSettle,
    imageCount: items.length,
  })

  usePointerHandlers({
    flatListRef: scrollRef,
    itemWidthsRef,
    currentIndexRef,
    scrollTo,
    onSettle,
    imageCount: items.length,
  })

  return (
    <>
      <RepostCarouselHeader
        count={items.length}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        onScrollLeft={scrollLeft}
        onScrollRight={scrollRight}
      />
      <RepostCarouselViewport expanded={expanded}>
        <BlockDrawerGesture>
          <ScrollView
            ref={scrollRef}
            horizontal
            role="group"
            aria-roledescription={l`carousel`}
            aria-label={l`Repost carousel, ${items.length} reposts`}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            style={[a.w_full, web({overscrollBehaviorX: 'contain'})]}
            contentContainerStyle={[a.px_md, a.pt_sm, a.pb_lg]}>
            <View style={[a.flex_row, a.align_start, {gap: ITEM_GAP}]}>
              {items.map((slice, index) => {
                itemWidthsRef.current.set(index, CARD_WIDTH)
                return (
                  <RepostCard
                    key={slice.items[0]._reactKey}
                    slice={slice}
                    itemRef={node => {
                      if (node) {
                        itemRefsRef.current.set(index, node)
                      } else {
                        itemRefsRef.current.delete(index)
                      }
                    }}
                  />
                )
              })}
            </View>
          </ScrollView>
        </BlockDrawerGesture>
      </RepostCarouselViewport>
    </>
  )
}

export function PostFeedItemCarousel({items}: {items: FeedPostSlice[]}) {
  const t = useTheme()
  const [expanded, setExpanded] = useState(false)
  const onToggleExpanded = useCallback(() => {
    setExpanded(value => !value)
  }, [])

  return (
    <View
      style={[a.border_t, t.atoms.border_contrast_low, t.atoms.bg_contrast_25]}>
      {IS_WEB ? (
        <RepostCarouselWeb
          items={items}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
        />
      ) : (
        <RepostCarouselNative
          items={items}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
        />
      )}
    </View>
  )
}
