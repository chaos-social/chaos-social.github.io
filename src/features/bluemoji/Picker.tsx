import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {EmojiStarEyes_Stroke2_Corner0_Rounded as EmojiStarEyesIcon} from '#/components/icons/Emoji'
import {Text} from '#/components/Typography'
import {InlineBluemoji} from '#/features/bluemoji/InlineBluemoji'
import {
  useBluemojiItemQuery,
  useBluemojiSearchQuery,
} from '#/features/bluemoji/queries'
import {type BluemojiItem, getBluemojiImage} from '#/features/bluemoji/util'
import {type blue} from '#/lexicons'

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
        label={l`Open Bluemoji picker`}
        color="primary"
        shape={enableSquareButtons ? 'square' : 'round'}
        style={a.p_sm}
        onPress={control.open}>
        <EmojiStarEyesIcon size="lg" />
      </Button>
      <Dialog.Outer control={control}>
        <Dialog.Handle />
        <PickerInner control={control} onInsert={onInsert} />
      </Dialog.Outer>
    </>
  )
}

function PickerInner({
  control,
  onInsert,
}: {
  control: Dialog.DialogControlProps
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const [query, setQuery] = useState('')
  const [discover, setDiscover] = useState(false)
  const search = useBluemojiSearchQuery({
    repo: discover ? undefined : currentAccount?.did,
    query,
  })
  const items = search.data?.pages.flatMap(page => page.items) ?? []
  return (
    <Dialog.ScrollableInner label={l`Bluemoji picker`}>
      <View style={a.gap_md}>
        <Text style={[a.text_xl, a.font_bold]}>
          <Trans>Bluemoji</Trans>
        </Text>
        <View style={[a.flex_row, a.gap_sm]}>
          <Button
            label={l`My collection`}
            color={discover ? 'secondary' : 'primary'}
            size="small"
            onPress={() => setDiscover(false)}>
            <ButtonText>
              <Trans>My collection</Trans>
            </ButtonText>
          </Button>
          <Button
            label={l`Discover emoji`}
            color={discover ? 'primary' : 'secondary'}
            size="small"
            onPress={() => setDiscover(true)}>
            <ButtonText>
              <Trans>Discover</Trans>
            </ButtonText>
          </Button>
        </View>
        <TextField.Root>
          <TextField.Input
            testID="bluemojiSearch"
            label={l`Search Bluemoji`}
            placeholder={l`Search Bluemoji`}
            defaultValue=""
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>
        {search.isFetching && !items.length ? (
          <Text>
            <Trans>Loading emoji…</Trans>
          </Text>
        ) : null}
        {search.isError ? (
          <>
            <Text>
              <Trans>Could not load Bluemoji.</Trans>
            </Text>
            <Button
              label={l`Retry`}
              color="secondary"
              size="small"
              onPress={() => {
                void search.refetch()
              }}>
              <ButtonText>
                <Trans>Retry</Trans>
              </ButtonText>
            </Button>
          </>
        ) : null}
        {!search.isFetching && !search.isError && !items.length ? (
          <Text>
            <Trans>
              No emoji found. Add emoji to your collection at moji.blue, or
              search Discover.
            </Trans>
          </Text>
        ) : null}
        {items.map(item => (
          <PickerItem
            key={item.uri ?? `${item.did}/${item.name}`}
            item={item}
            onInsert={verified => control.close(() => onInsert(verified))}
          />
        ))}
        {search.hasNextPage ? (
          <Button
            label={l`Load more`}
            color="secondary"
            size="small"
            disabled={search.isFetchingNextPage}
            onPress={() => {
              void search.fetchNextPage()
            }}>
            <ButtonText>
              <Trans>Load more</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function PickerItem({
  item,
  onInsert,
}: {
  item: blue.moji.collection.item.ItemView
  onInsert: (item: BluemojiItem) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const claim = {
    did: item.did ?? '',
    name: item.name,
    record: item.uri && item.cid ? {uri: item.uri, cid: item.cid} : undefined,
  }
  const {data: verified} = useBluemojiItemQuery(claim)
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.py_sm,
        a.border_b,
        t.atoms.border_contrast_low,
      ]}>
      <View style={[a.flex_1, a.gap_xs]}>
        <Text emoji style={a.text_md}>
          <InlineBluemoji
            interactive={false}
            claim={claim}
            fallbackText={item.name}
            size={32}
          />{' '}
          {item.name}
        </Text>
        {verified?.record.alt ? (
          <Text emoji style={t.atoms.text_contrast_medium}>
            {verified.record.alt}
          </Text>
        ) : null}
      </View>
      <Button
        testID="insertBluemoji"
        label={l`Insert ${item.name}`}
        color="secondary"
        size="small"
        disabled={!verified || !getBluemojiImage(verified)}
        onPress={() => {
          if (verified) onInsert(verified)
        }}>
        <ButtonText>
          <Trans>Insert</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
