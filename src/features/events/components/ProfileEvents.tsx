import {useCallback, useEffect, useImperativeHandle, useState} from 'react'
import {type ListRenderItemInfo, useWindowDimensions, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {useBottomBarOffset} from '#/lib/hooks/useBottomBarOffset'
import {logger} from '#/logger'
import {useSession} from '#/state/session'
import {EmptyState} from '#/view/com/util/EmptyState'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {List, type ListRef} from '#/view/com/util/List'
import {findListNativeTag} from '#/view/com/util/listNativeTag'
import {FeedLoadingPlaceholder} from '#/view/com/util/LoadingPlaceholder'
import {atoms as a, ios} from '#/alf'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarIcon} from '#/components/icons/CalendarDays'
import {ListFooter} from '#/components/Lists'
import {IS_IOS} from '#/env'
import {useMyEventsQuery} from '../queries'
import {mergeEventTimeline} from '../timeline'
import {type EventView, RSVP_GOING, RSVP_INTERESTED} from '../types'
import {EventCard} from './EventCard'

interface SectionRef {
  scrollToTop: () => void
}

function keyExtractor(item: EventView) {
  return item.uri
}

export function ProfileEvents({
  ref,
  scrollElRef,
  headerOffset,
  enabled,
  setScrollViewTag,
}: {
  ref?: React.Ref<SectionRef>
  scrollElRef: ListRef
  headerOffset: number
  enabled?: boolean
  setScrollViewTag: (tag: number | null) => void
}) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {height} = useWindowDimensions()
  const bottomBarOffset = useBottomBarOffset(100)
  const [isPTRing, setIsPTRing] = useState(false)

  const upcoming = useMyEventsQuery('upcoming', enabled)
  const past = useMyEventsQuery(
    'past',
    !!enabled && upcoming.isSuccess && !upcoming.hasNextPage,
  )
  const events = mergeEventTimeline(
    upcoming.data?.pages.flatMap(page => page.events) ?? [],
    past.data?.pages.flatMap(page => page.events) ?? [],
    new Date(),
  )
  const next = upcoming.hasNextPage ? upcoming : past
  const hasNextPage = upcoming.hasNextPage || past.hasNextPage
  const isFetchingNextPage =
    upcoming.isFetchingNextPage || past.isFetchingNextPage
  const isLoading = upcoming.isLoading || past.isLoading
  const error = upcoming.error ?? past.error

  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      scrollElRef.current?.scrollToOffset({
        animated: true,
        offset: -headerOffset,
      })
    },
  }))

  useEffect(() => {
    if (IS_IOS && enabled && scrollElRef.current) {
      setScrollViewTag(findListNativeTag(scrollElRef.current))
    }
  }, [enabled, scrollElRef, setScrollViewTag])

  const onRefresh = useCallback(async () => {
    setIsPTRing(true)
    try {
      await Promise.all([upcoming.refetch(), past.refetch()])
    } catch (err) {
      logger.error('Failed to refresh events', {message: err})
    }
    setIsPTRing(false)
  }, [upcoming, past])

  const onEndReached = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage || error) return
    next
      .fetchNextPage()
      .catch(err => logger.error('Failed to load more events', {message: err}))
  }, [isFetchingNextPage, hasNextPage, error, next])

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<EventView>) => {
      const status = item.viewer?.rsvp?.status
      const badge =
        item.creator.did === currentAccount?.did
          ? _(msg`Hosting`)
          : status === RSVP_GOING
            ? _(msg`Going`)
            : status === RSVP_INTERESTED
              ? _(msg`Interested`)
              : undefined
      return (
        <View style={[a.px_lg, a.pt_md]}>
          <EventCard event={item} badge={badge} showPhase />
        </View>
      )
    },
    [_, currentAccount?.did],
  )

  return (
    <List
      ref={scrollElRef}
      data={events}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={isPTRing}
      onRefresh={() => void onRefresh()}
      onEndReached={onEndReached}
      onEndReachedThreshold={2}
      headerOffset={headerOffset}
      progressViewOffset={ios(0)}
      contentContainerStyle={{
        minHeight: height + headerOffset,
        paddingBottom: bottomBarOffset,
      }}
      desktopFixedHeight
      ListEmptyComponent={
        isLoading ? (
          <FeedLoadingPlaceholder />
        ) : error ? (
          <ErrorMessage
            message={_(msg`Couldn't load your events.`)}
            onPressTryAgain={() => {
              void upcoming.refetch()
              void past.refetch()
            }}
          />
        ) : (
          <View style={[a.px_lg, a.align_center, a.justify_center]}>
            <EmptyState
              icon={CalendarIcon}
              iconSize="3xl"
              message={_(
                msg`Events you host or RSVP to show up here. Only you can see this tab.`,
              )}
            />
          </View>
        )
      }
      ListFooterComponent={
        events.length ? (
          <ListFooter
            isFetchingNextPage={isFetchingNextPage}
            error={error ? _(msg`Couldn't load more events.`) : undefined}
            onRetry={next.fetchNextPage}
          />
        ) : undefined
      }
    />
  )
}
