import {type ReactNode, useState} from 'react'
import {ScrollView, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {getLocalizedFeedName} from '#/lib/strings/feed-names'
import {userStyle} from '#/lib/userstyles'
import {emitSoftReset} from '#/state/events'
import {type SavedFeedSourceInfo} from '#/state/queries/feed'
import {LEFT_NAV_MINIMAL_WIDTH} from '#/view/shell/desktop/LeftNav'
import {SplitViewProvider} from '#/screens/Messages/components/splitView/context'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {DeckColumnProvider} from './context'

const COLUMN_WIDTH = 360

/**
 * One column per pinned feed, side by side and scrolling independently.
 *
 * Each column is a `SplitViewProvider`, which is what makes the feed list
 * scroll itself (`overflow-y: scroll`) instead of the window, and stops
 * `Layout.Center` from capping its rows at the 600px column width.
 */
export function Deck({
  feeds,
  renderFeed,
}: {
  feeds: SavedFeedSourceInfo[]
  renderFeed: (feedInfo: SavedFeedSourceInfo, enabled: boolean) => ReactNode
}) {
  const [viewport, setViewport] = useState({first: 0, count: 1})

  /*
   * Every column stays mounted so its scroll position and state survive, but
   * only the ones on screen are enabled. A pinned feed is a full feed query
   * that also renders every row it has loaded, and accounts pin dozens - all
   * of them at once is what made the deck unusable.
   */
  const enabledFor = (index: number) =>
    index >= viewport.first && index < viewport.first + viewport.count

  const updateViewport = (offsetX: number, width: number) => {
    const first = Math.floor(offsetX / COLUMN_WIDTH)
    // One extra column either side, so a scroll never lands on a blank column.
    const count = Math.ceil(width / COLUMN_WIDTH) + 1
    if (first !== viewport.first || count !== viewport.count) {
      setViewport({first, count})
    }
  }

  return (
    <ScrollView
      horizontal
      // Each column scrolls itself, so this one only scrolls sideways.
      showsHorizontalScrollIndicator
      onLayout={e => updateViewport(0, e.nativeEvent.layout.width)}
      onScroll={e =>
        updateViewport(
          e.nativeEvent.contentOffset.x,
          e.nativeEvent.layoutMeasurement.width,
        )
      }
      scrollEventThrottle={100}
      style={[
        userStyle('wsky-deck'),
        a.flex_1,
        a.h_full_vh,
        // The left rail is fixed and overlays the screen, so start past it.
        {marginLeft: LEFT_NAV_MINIMAL_WIDTH},
      ]}
      contentContainerStyle={[a.flex_row, a.h_full]}>
      {feeds.map((feedInfo, index) => (
        <DeckColumn
          key={feedInfo.feedDescriptor}
          feedInfo={feedInfo}
          enabled={enabledFor(index)}
          renderFeed={renderFeed}
        />
      ))}
    </ScrollView>
  )
}

function DeckColumn({
  feedInfo,
  enabled,
  renderFeed,
}: {
  feedInfo: SavedFeedSourceInfo
  enabled: boolean
  renderFeed: (feedInfo: SavedFeedSourceInfo, enabled: boolean) => ReactNode
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const name = getLocalizedFeedName(feedInfo, i18n)

  return (
    <SplitViewProvider side="right">
      <View
        style={[
          a.h_full,
          a.border_r,
          t.atoms.border_contrast_low,
          /*
           * shrink: 0 is load-bearing. Without it the columns squeeze to fit
           * the viewport, so there is no overflow for the row to scroll.
           */
          {
            width: COLUMN_WIDTH,
            flexBasis: COLUMN_WIDTH,
            flexGrow: 0,
            flexShrink: 0,
          },
        ]}>
        <Layout.Header.Outer sticky={false}>
          <Layout.Header.Content>
            {/*
             * The load-latest button is fixed to the viewport and so can't
             * follow a column, so tapping the name is how you refresh.
             */}
            <Text
              style={[a.flex_1, a.text_md, a.font_semi_bold]}
              numberOfLines={1}
              emoji
              onPress={() => emitSoftReset(feedInfo.feedDescriptor)}>
              {name}
            </Text>
          </Layout.Header.Content>
        </Layout.Header.Outer>
        <DeckColumnProvider>{renderFeed(feedInfo, enabled)}</DeckColumnProvider>
      </View>
    </SplitViewProvider>
  )
}
