import {useMemo, useState} from 'react'
import {type ListRenderItemInfo, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Layout from '#/components/Layout'
import {ListFooter, ListMaybePlaceholder} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {useEventQuery, useEventRsvpsQuery} from '#/features/events/queries'
import {type ParsedEvent, parseEventRecord} from '#/features/events/record'
import {
  type EventView,
  RSVP_GOING,
  RSVP_INTERESTED,
  type RsvpStatus,
  type RsvpView,
} from '#/features/events/types'
import {eventAtUri} from '#/features/events/url'
import {EventHeader, GuestRow} from './EventHeader'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Event'>

export function EventScreen({route}: Props) {
  const {t: l} = useLingui()
  const {name, rkey} = route.params
  const {data: did, error: resolveError} = useResolveDidQuery(name)
  const uri = did ? eventAtUri(did, rkey) : undefined
  const {data: event, isLoading, error, refetch} = useEventQuery(uri)
  const parsed = event ? parseEventRecord(event.record) : undefined

  return (
    <Layout.Screen testID="eventScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>
            <Trans>Event</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {event && parsed ? (
        <EventBody event={event} parsed={parsed} />
      ) : (
        <ListMaybePlaceholder
          isLoading={isLoading || (!did && !resolveError)}
          isError={
            !!error || !!resolveError || event === null || (!!event && !parsed)
          }
          errorTitle={l`Event not found`}
          errorMessage={
            resolveError
              ? cleanError(resolveError)
              : error
                ? l`Couldn't load this event. Try again in a moment.`
                : l`This event may have been deleted or isn't available.`
          }
          onRetry={error ? refetch : undefined}
          topBorder={false}
          sideBorders={false}
        />
      )}
    </Layout.Screen>
  )
}

/*
 * The appview has no "all" status filter: leaving `status` off returns exactly
 * going + interested (not-going respondents are excluded on purpose), which is
 * what the "Either" tab wants. `undefined` here means "leave the param off".
 */
type GuestTab = 'going' | 'interested' | 'either'
const GUEST_TABS: {
  value: GuestTab
  status: RsvpStatus | undefined
}[] = [
  {value: 'going', status: RSVP_GOING},
  {value: 'interested', status: RSVP_INTERESTED},
  {value: 'either', status: undefined},
]

function EventBody({event, parsed}: {event: EventView; parsed: ParsedEvent}) {
  const {t: l} = useLingui()
  const [tab, setTab] = useState<GuestTab>('going')
  const active = GUEST_TABS.find(t => t.value === tab) ?? GUEST_TABS[0]

  const {
    data,
    refetch,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEventRsvpsQuery(event.uri, active.status)
  const rsvps = useMemo(
    () => data?.pages.flatMap(page => page.rsvps) ?? [],
    [data],
  )
  const mutedOrBlockedCount = data?.pages[0]?.mutedOrBlockedCount ?? 0

  // The header avatars come from the unfiltered query, so they do not shift
  // when the guest list tab changes.
  const {data: everyone} = useEventRsvpsQuery(event.uri, undefined)
  const everyoneRsvps = everyone?.pages.flatMap(page => page.rsvps) ?? []
  const going = everyoneRsvps
    .filter(rsvp => rsvp.status === RSVP_GOING)
    .slice(0, 5)
    .map(rsvp => rsvp.actor)
  const interested = everyoneRsvps
    .filter(rsvp => rsvp.status === RSVP_INTERESTED)
    .slice(0, 5)
    .map(rsvp => rsvp.actor)

  const renderItem = ({item, index}: ListRenderItemInfo<RsvpView>) => (
    <GuestRow rsvp={item} noBorder={index === 0} />
  )

  return (
    <List
      data={rsvps}
      keyExtractor={(item: RsvpView) => item.uri}
      renderItem={renderItem}
      ListHeaderComponent={
        <View>
          <EventHeader
            event={event}
            parsed={parsed}
            going={going}
            interested={interested}
          />
          <View style={[a.px_lg, a.pt_lg]}>
            <SegmentedControl.Root
              type="tabs"
              size="small"
              label={l`Guest list filter`}
              value={tab}
              onChange={setTab}>
              <SegmentedControl.Item label={l`Going`} value="going">
                <SegmentedControl.ItemText>
                  <Trans>Going</Trans>
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
              <SegmentedControl.Item label={l`Interested`} value="interested">
                <SegmentedControl.ItemText>
                  <Trans>Interested</Trans>
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
              <SegmentedControl.Item label={l`Either`} value="either">
                <SegmentedControl.ItemText>
                  <Trans>All</Trans>
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </View>
          {!isLoading && !error && rsvps.length === 0 && (
            <Text style={[a.px_lg, a.py_md, a.text_sm]}>
              {tab === 'interested' ? (
                <Trans>No one has marked themselves interested yet.</Trans>
              ) : (
                <Trans>No one has RSVP'd yet.</Trans>
              )}
            </Text>
          )}
        </View>
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
      }}
      onEndReachedThreshold={2}
      ListFooterComponent={
        <View>
          <ListFooter
            isFetchingNextPage={isFetchingNextPage}
            error={error ? l`Couldn't load the guest list.` : undefined}
            onRetry={rsvps.length ? fetchNextPage : refetch}
          />
          {mutedOrBlockedCount > 0 && (
            <MutedOrBlockedSection
              eventUri={event.uri}
              count={mutedOrBlockedCount}
            />
          )}
        </View>
      }
      sideBorders={false}
    />
  )
}

function MutedOrBlockedSection({
  eventUri,
  count,
}: {
  eventUri: string
  count: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [open, setOpen] = useState(false)
  const {data} = useEventRsvpsQuery(eventUri, undefined, 'mutedOrBlocked', open)
  const rsvps = data?.pages.flatMap(page => page.rsvps) ?? []

  return (
    <View style={[a.px_lg, a.py_md, a.border_t, t.atoms.border_contrast_low]}>
      <Button
        label={
          open
            ? l`Hide muted or blocked accounts`
            : l`Show muted or blocked accounts`
        }
        size="small"
        color="secondary"
        variant="ghost"
        style={[a.self_start]}
        onPress={() => setOpen(v => !v)}>
        <ButtonText>
          {plural(count, {
            one: '# muted or blocked account',
            other: '# muted or blocked accounts',
          })}
        </ButtonText>
      </Button>
      {open &&
        rsvps.map((item, index) => (
          <GuestRow key={item.uri} rsvp={item} noBorder={index === 0} />
        ))}
    </View>
  )
}
