import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useSession} from '#/state/session'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {EmojiHeartEyes_Stroke2_Corner0_Rounded as BluemojiIcon} from '#/components/icons/Emoji'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
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

const TILE = 48

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
        <PickerContent
          onInsert={item => control.close(() => onInsert(item))}
        />
      </Dialog.Outer>
    </>
  )
}

function PickerContent({
  onInsert,
}: {
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const [discover, setDiscover] = useState(false)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0

  return (
    <Dialog.ScrollableInner label={l`Custom emoji`} style={web({maxWidth: 460})}>
      <View style={[a.gap_md, a.pb_lg]}>
        <View style={[a.gap_2xs]}>
          <Text style={[a.text_xl, a.font_bold]}>
            <Trans>Custom emoji</Trans>
          </Text>
          <Text style={[a.text_sm]}>
            <Trans>Aliases post as :emoji: and render inline.</Trans>
          </Text>
        </View>

        <View style={[a.flex_row, a.gap_xs]}>
          <Button
            size="small"
            color={discover ? 'secondary' : 'primary'}
            label={l`My emoji`}
            onPress={() => setDiscover(false)}>
            <ButtonText>
              <Trans>My emoji</Trans>
            </ButtonText>
          </Button>
          <Button
            size="small"
            color={discover ? 'primary' : 'secondary'}
            label={l`Discover`}
            onPress={() => setDiscover(true)}>
            <ButtonText>
              <Trans>Discover</Trans>
            </ButtonText>
          </Button>
        </View>

        <TextField.Root>
          <TextField.Input
            testID="bluemojiSearch"
            label={l`Search custom emoji`}
            placeholder={l`Search`}
            defaultValue=""
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>

        {searching || !discover ? (
          <SearchGrid repo={currentAccount?.did} query={query} onInsert={onInsert} />
        ) : (
          <TrendingGrid onInsert={onInsert} />
        )}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function SearchGrid({
  repo,
  query,
  onInsert,
}: {
  repo: string | undefined
  query: string
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const openLink = useOpenLink()
  const search = useBluemojiSearchQuery({repo, query})
  // An empty query still lists the collection, so it needs a repo to scope to.
  const items = search.data?.pages.flatMap(page => page.items) ?? []

  if (search.isError) {
    return (
      <View style={[a.gap_sm, a.align_start]}>
        <Text>
          <Trans>Could not load custom emoji.</Trans>
        </Text>
        <Button
          size="small"
          color="secondary"
          label={l`Retry`}
          onPress={() => void search.refetch()}>
          <ButtonText>
            <Trans>Retry</Trans>
          </ButtonText>
        </Button>
      </View>
    )
  }

  if (!items.length) {
    if (search.isFetching) {
      return <TileGrid>{skeletons(8)}</TileGrid>
    }
    return (
      <View style={[a.gap_md]}>
        <Text style={[a.text_md, a.leading_snug]}>
          {query ? (
            <Trans>No emoji match “{query}”.</Trans>
          ) : (
            <Trans>You don't have any custom emoji yet.</Trans>
          )}
        </Text>
        {!query ? (
          <Button
            size="small"
            color="secondary"
            label={l`Create a collection at moji.blue`}
            onPress={() =>
              openLink('https://moji.blue/collection', true, false)
            }>
            <ButtonText>
              <Trans>Create a collection at moji.blue</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>
    )
  }

  return (
    <View style={[a.gap_md]}>
      <TileGrid>
        {items.map(item => (
          <SearchTile
            key={item.uri ?? `${item.did}/${item.name}`}
            item={item}
            onInsert={onInsert}
          />
        ))}
      </TileGrid>
      {search.hasNextPage ? (
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

function TrendingGrid({onInsert}: {onInsert: (item: BluemojiItem) => void}) {
  const trending = useTrendingEmojiQuery()
  if (trending.isPending) return <TileGrid>{skeletons(12)}</TileGrid>
  if (!trending.data?.length) {
    return (
      <Text style={[a.text_md]}>
        <Trans>Nothing trending right now.</Trans>
      </Text>
    )
  }
  return (
    <TileGrid>
      {trending.data.map(group => (
        <TrendingTile
          key={group.emoji.uri}
          emoji={group.emoji}
          onInsert={onInsert}
        />
      ))}
    </TileGrid>
  )
}

function SearchTile({
  item,
  onInsert,
}: {
  item: blue.moji.collection.item.ItemView
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const {data: verified} = useBluemojiItemQuery({
    did: item.did ?? '',
    name: item.name,
    record: item.uri && item.cid ? {uri: item.uri, cid: item.cid} : undefined,
  })
  /*
   * Search results are claims: only what the owning PDS confirms can be
   * inserted, and only if the viewer's labels let it render.
   */
  const insertable =
    verified &&
    getBluemojiImage(verified) &&
    getBluemojiModeration(verified, moderationOpts) !== 'hide'

  if (!insertable) {
    return (
      <View
        style={{width: TILE, height: TILE}}
        accessibilityLabel={item.name}
        accessibilityHint={undefined}>
        <Skeleton.Block style={{width: TILE, height: TILE}} />
      </View>
    )
  }
  return (
    <Tile
      label={l`Insert ${verified.record.name}`}
      onPress={() => onInsert(verified)}
      imageUri={getBluemojiImage(verified)}
      alias={verified.record.name}
    />
  )
}

function TrendingTile({
  emoji,
  onInsert,
}: {
  emoji: blue.moji.feed.reaction.EmojiRef
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const item = reactionEmojiToItem(emoji)
  return (
    <Tile
      label={l`Insert ${emoji.name}`}
      onPress={() => (item ? onInsert(item) : undefined)}
      render={item ? undefined : () => <ReactionEmoji emoji={emoji} size={32} />}
      imageUri={item ? getBluemojiImage(item) : undefined}
      alias={emoji.name}
    />
  )
}

function Tile({
  label,
  onPress,
  imageUri,
  alias,
  render,
}: {
  label: string
  onPress: () => void
  imageUri?: string
  alias: string
  render?: () => React.ReactElement
}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <View style={[a.gap_2xs, a.align_center]}>
      <Button
        label={label}
        onPress={onPress}
        style={[
          {width: TILE, height: TILE},
          getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
          a.align_center,
          a.justify_center,
          t.atoms.bg_contrast_25,
        ]}>
        {render ? render() : imageUri ? <TileImage uri={imageUri} /> : <View />}
      </Button>
      <Text
        numberOfLines={1}
        style={[
          a.text_2xs,
          a.text_center,
          t.atoms.text_contrast_medium,
          {width: TILE},
        ]}>
        {alias}
      </Text>
    </View>
  )
}

function TileImage({uri}: {uri: string}) {
  return (
    <Image
      source={{uri}}
      contentFit="contain"
      style={{width: 32, height: 32}}
      accessibilityIgnoresInvertColors
    />
  )
}

function TileGrid({children}: {children: React.ReactNode}) {
  return <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>{children}</View>
}

function skeletons(count: number) {
  return Array.from({length: count}, (_, i) => (
    <Skeleton.Block key={i} style={{width: TILE, height: TILE}} />
  ))
}
