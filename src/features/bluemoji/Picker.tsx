import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {EmojiHeartEyes_Stroke2_Corner0_Rounded as BluemojiIcon} from '#/components/icons/Emoji'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {BluemojiImage} from '#/features/bluemoji/BluemojiImage'
import {useOwnCollectionQuery} from '#/features/bluemoji/collection/queries'
import {
  useBluemojiItemQuery,
  useBluemojiSearchQuery,
} from '#/features/bluemoji/queries'
import {useTrendingEmojiQuery} from '#/features/bluemoji/reactions/queries'
import {ReactionEmoji} from '#/features/bluemoji/reactions/ReactionEmoji'
import {reactionEmojiToItem} from '#/features/bluemoji/reactions/util'
import {
  type BluemojiItem,
  getBluemojiImage,
  getBluemojiModeration,
} from '#/features/bluemoji/util'
import {type blue} from '#/lexicons'

const TILE = 44

/**
 * The emoji grid, shared by the composer picker, the reaction sheet, and the
 * collection screen. Callers own the surrounding chrome; this renders the
 * search field, the tabs, and the tiles.
 */
export function EmojiGrid({
  onSelect,
  repo,
  onNewCollection,
  chosen,
  searchable = true,
}: {
  onSelect: (item: BluemojiItem) => void
  /** Collection to scope "mine" to. Defaults to the signed-in account. */
  repo?: string
  /** Renders a trailing plus tile that starts a new emoji. */
  onNewCollection?: () => void
  /** Item URIs to highlight, e.g. the ones the viewer already reacted with. */
  chosen?: readonly string[]
  searchable?: boolean
}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const [tab, setTab] = useState<'mine' | 'discover'>('mine')
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const discover = tab === 'discover'
  const scope = repo ?? currentAccount?.did

  return (
    <View style={[a.gap_sm]}>
      {searchable ? (
        <>
          <SegmentedControl.Root
            label={l`Emoji source`}
            type="tabs"
            size="small"
            value={tab}
            onChange={setTab}>
            <SegmentedControl.Item value="mine" label={l`My emoji`}>
              <SegmentedControl.ItemText>
                <Trans>Mine</Trans>
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="discover" label={l`Discover emoji`}>
              <SegmentedControl.ItemText>
                <Trans>Discover</Trans>
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          </SegmentedControl.Root>
          <View style={[a.flex_row, a.gap_xs, a.align_center]}>
            <View style={[a.flex_1]}>
              <TextField.Root>
                <TextField.Input
                  testID="bluemojiSearch"
                  label={l`Search custom emoji`}
                  placeholder={
                    discover ? l`Search all emoji` : l`Search your emoji`
                  }
                  defaultValue=""
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </TextField.Root>
            </View>
          </View>
        </>
      ) : null}

      {searching || !discover ? (
        <SearchGrid
          repo={scope}
          query={query}
          onSelect={onSelect}
          onNewCollection={onNewCollection}
          chosen={chosen}
        />
      ) : (
        <TrendingGrid onSelect={onSelect} />
      )}
    </View>
  )
}

function SearchGrid({
  repo,
  query,
  onSelect,
  onNewCollection,
  chosen,
}: {
  repo: string | undefined
  query: string
  onSelect: (item: BluemojiItem) => void
  onNewCollection?: () => void
  chosen?: readonly string[]
}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  /*
   * Listing our own emoji reads our PDS: moji.blue only lists what its
   * firehose has indexed, so a just-added item would not be here yet.
   */
  const own = !query.trim() && Boolean(repo) && repo === currentAccount?.did
  const ownItems = useOwnCollectionQuery({enabled: own})
  const search = useBluemojiSearchQuery({repo, query, enabled: !own})
  const hits = search.data?.pages.flatMap(page => page.items) ?? []

  const isError = own ? ownItems.isError : search.isError
  const isFetching = own ? ownItems.isFetching : search.isFetching
  const refetch = () => void (own ? ownItems.refetch() : search.refetch())

  if (isError) {
    return (
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <Text style={[a.text_sm]}>
          <Trans>Could not load custom emoji.</Trans>
        </Text>
        <Button
          size="small"
          color="secondary"
          label={l`Retry`}
          onPress={refetch}>
          <ButtonText>
            <Trans>Retry</Trans>
          </ButtonText>
        </Button>
      </View>
    )
  }

  const count = own ? (ownItems.data?.length ?? 0) : hits.length
  if (!count) {
    if (isFetching) {
      return <TileGrid>{skeletons(8)}</TileGrid>
    }
    return (
      <View style={[a.gap_sm]}>
        <Text style={[a.text_sm]}>
          {query ? (
            <Trans>No emoji match “{query}”.</Trans>
          ) : (
            <Trans>No custom emoji yet.</Trans>
          )}
        </Text>
        {onNewCollection && !query ? (
          <TileGrid>
            <NewEmojiTile onPress={onNewCollection} />
          </TileGrid>
        ) : null}
      </View>
    )
  }

  return (
    <View style={[a.gap_sm]}>
      <TileGrid>
        {own
          ? ownItems.data!.map(item => (
              <Tile
                key={item.uri}
                label={item.record.name}
                onPress={() => onSelect(item)}
                item={item}
                selected={chosen?.includes(item.uri)}
              />
            ))
          : hits.map(item => (
              <SearchTile
                key={item.uri ?? `${item.did}/${item.name}`}
                item={item}
                onSelect={onSelect}
                selected={chosen?.includes(item.uri ?? '')}
              />
            ))}
        {onNewCollection ? <NewEmojiTile onPress={onNewCollection} /> : null}
      </TileGrid>
      {!own && search.hasNextPage ? (
        <Button
          size="small"
          color="secondary"
          label={l`Load more`}
          disabled={search.isFetchingNextPage}
          onPress={() => void search.fetchNextPage()}>
          <ButtonText>
            <Trans>Load more</Trans>
          </ButtonText>
        </Button>
      ) : null}
    </View>
  )
}

function SearchTile({
  item,
  onSelect,
  selected,
}: {
  item: blue.moji.collection.item.ItemView
  onSelect: (item: BluemojiItem) => void
  selected?: boolean
}) {
  const moderationOpts = useModerationOpts()
  const {data: verified} = useBluemojiItemQuery({
    did: item.did ?? '',
    name: item.name,
    record: item.uri && item.cid ? {uri: item.uri, cid: item.cid} : undefined,
  })
  /*
   * Search results are claims: only what the owning PDS confirms can be used,
   * and only if the viewer's labels let it render.
   */
  const usable =
    verified &&
    getBluemojiImage(verified) &&
    getBluemojiModeration(verified, moderationOpts) !== 'hide'

  if (!usable) {
    return <Skeleton.Block style={{width: TILE, height: TILE}} />
  }
  return (
    <Tile
      label={verified.record.name}
      onPress={() => onSelect(verified)}
      item={verified}
      selected={selected}
    />
  )
}

function TrendingGrid({onSelect}: {onSelect: (item: BluemojiItem) => void}) {
  const trending = useTrendingEmojiQuery()
  if (trending.isPending) return <TileGrid>{skeletons(12)}</TileGrid>
  if (!trending.data?.length) {
    return (
      <Text style={[a.text_sm]}>
        <Trans>Nothing trending right now.</Trans>
      </Text>
    )
  }
  return (
    <TileGrid>
      {trending.data.map(group => {
        const item = reactionEmojiToItem(group.emoji)
        return (
          <Tile
            key={group.emoji.uri}
            label={group.emoji.name}
            onPress={item ? () => onSelect(item) : undefined}
            render={() => <ReactionEmoji emoji={group.emoji} size={30} />}
          />
        )
      })}
    </TileGrid>
  )
}

/**
 * One emoji. The alias is the accessibility label; no caption, to keep the
 * grid as small as Discord's.
 */
export function Tile({
  label,
  onPress,
  item,
  render,
  selected,
}: {
  label: string
  onPress?: () => void
  /** Verified item to draw. Falls back to the PDS for a fresh upload. */
  item?: BluemojiItem
  render?: () => React.ReactElement
  selected?: boolean
}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={!onPress}
      // Tiles sit on a tinted grid, so hover has to darken past that tint.
      hoverStyle={
        selected ? undefined : {backgroundColor: t.palette.contrast_100}
      }
      style={[
        {width: TILE, height: TILE},
        getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_full),
        a.align_center,
        a.justify_center,
        selected
          ? {backgroundColor: t.palette.primary_500}
          : {backgroundColor: t.palette.contrast_25},
        web({cursor: 'pointer'}),
      ]}>
      {render ? (
        render()
      ) : item ? (
        <BluemojiImage item={item} size={TILE - 12} />
      ) : (
        <Skeleton.Block
          style={{width: TILE - 12, height: TILE - 12, opacity: 0.4}}
        />
      )}
    </Button>
  )
}

export function NewEmojiTile({onPress}: {onPress: () => void}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  const {t: l} = useLingui()
  return (
    <Button
      label={l`Add your own emoji`}
      onPress={onPress}
      style={[
        {width: TILE, height: TILE, borderStyle: 'dashed'},
        getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_full),
        a.align_center,
        a.justify_center,
        a.border,
        t.atoms.border_contrast_medium,
      ]}>
      <PlusIcon size="md" fill={t.palette.primary_500} />
    </Button>
  )
}

export function TileGrid({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.flex_wrap,
        a.gap_xs,
        a.p_xs,
        a.rounded_sm,
        // A recessed panel, the way Discord's picker reads as one surface.
        {backgroundColor: t.palette.contrast_50},
      ]}>
      {children}
    </View>
  )
}

function skeletons(count: number) {
  return Array.from({length: count}, (_, i) => (
    <Skeleton.Block key={i} style={{width: TILE, height: TILE}} />
  ))
}

/**
 * Composer toolbar entry point. Wraps the grid in a dialog; inserting closes it
 * and hands the verified item back so the composer can register the owner.
 */
export function BluemojiPickerButton({
  onInsert,
}: {
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogControl()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <>
      <Button
        variant="ghost"
        testID="openBluemojiPicker"
        label={l`Open custom emoji picker`}
        color="primary"
        shape={enableSquareButtons ? 'square' : 'round'}
        style={a.p_sm}
        onPress={control.open}>
        <BluemojiIcon size="lg" />
      </Button>
      <Dialog.Outer control={control}>
        <Dialog.Handle />
        <Dialog.ScrollableInner
          label={l`Custom emoji`}
          style={web({maxWidth: 420})}>
          <View style={[a.pb_lg]}>
            <EmojiGrid onSelect={item => control.close(() => onInsert(item))} />
          </View>
          <Dialog.Close />
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}
