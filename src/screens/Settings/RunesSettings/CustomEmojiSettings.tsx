import {useState} from 'react'
import {View} from 'react-native'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {compressIfNeeded} from '#/lib/media/manip'
import {openPicker, type RNImage} from '#/lib/media/picker'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Text} from '#/components/Typography'
import {BluemojiImage} from '#/features/bluemoji/BluemojiImage'
import {useCreateEmojiMutation} from '#/features/bluemoji/collection/mutations'
import {useOwnCollectionQuery} from '#/features/bluemoji/collection/queries'
import {NewEmojiTile, TileGrid} from '#/features/bluemoji/Picker'
import {RunesScreenLayout} from './components/RunesScreenLayout'

/**
 * The viewer's own Bluemoji collection, plus enough of an editor to add one.
 * The record is the one moji.blue itself writes; we only need an image and an
 * alias.
 */
export function CustomEmojiSettingsScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const control = Dialog.useDialogControl()
  // Read from our own PDS: moji.blue's listing lags the firehose, so a new
  // emoji would be invisible here for a while.
  const {data: items = []} = useOwnCollectionQuery()

  return (
    <RunesScreenLayout titleText={l`Custom emoji`}>
      <View style={[a.gap_md, a.p_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Custom emoji live in your account, like posts do. Anyone can use one
            you add by typing its alias, or pick it from the reaction and
            composer menus.
          </Trans>
        </Text>
        <TileGrid>
          {items.map(item => (
            <View key={item.uri} style={[a.rounded_sm, a.overflow_hidden]}>
              <BluemojiImage item={item} size={44} label={item.record.name} />
            </View>
          ))}
          <NewEmojiTile onPress={control.open} />
        </TileGrid>
      </View>

      <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <NewEmojiForm onDone={control.close} />
      </Dialog.Outer>
    </RunesScreenLayout>
  )
}

function NewEmojiForm({onDone}: {onDone: () => void}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {mutate: create, isPending} = useCreateEmojiMutation()
  const [file, setFile] = useState<RNImage | null>(null)
  const [alias, setAlias] = useState('')
  const [alt, setAlt] = useState('')
  const [adultOnly, setAdultOnly] = useState(false)

  const pick = async () => {
    const [asset] = await openPicker()
    if (!asset) return
    // The AppView renders its own renditions, so one 128px source is enough.
    setFile(
      await compressIfNeeded(asset, {
        // blob_v1 caps renditions at 128kb.
        maxDimension: 128,
        maxSize: 128_000,
      }),
    )
  }

  const canSubmit = Boolean(file && alias.trim()) && !isPending

  return (
    <Dialog.ScrollableInner label={l`New emoji`}>
      <View style={[a.gap_md, a.pb_lg]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            An emoji is a square image, about 128 pixels wide, stored in your
            account.
          </Trans>
        </Text>

        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <View
            style={[
              a.rounded_md,
              a.align_center,
              a.justify_center,
              {width: 64, height: 64},
              t.atoms.bg_contrast_25,
            ]}>
            {file ? (
              <Image
                source={{uri: file.path}}
                contentFit="contain"
                style={{width: 64, height: 64}}
                accessibilityLabel={l`Emoji preview`}
                accessibilityHint={undefined}
              />
            ) : null}
          </View>
          <Button
            color="secondary"
            size="small"
            label={l`Choose an image`}
            onPress={() => void pick()}>
            <ButtonText>
              <Trans>Choose an image</Trans>
            </ButtonText>
          </Button>
        </View>

        <TextField.Root>
          <TextField.LabelText>
            <Trans>Alias</Trans>
          </TextField.LabelText>
          <TextField.Input
            label={l`Alias`}
            placeholder={l`my_emoji`}
            value={alias}
            onChangeText={setAlias}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </TextField.Root>

        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            The alias is the name people type to use the emoji, between colons:
            :my_emoji:. Letters, numbers and underscores are safest. Reusing an
            alias replaces the emoji it points at.
          </Trans>
        </Text>

        <TextField.Root>
          <TextField.LabelText>
            <Trans>Description</Trans>
          </TextField.LabelText>
          <TextField.Input
            label={l`Description`}
            placeholder={l`What does this emoji show?`}
            value={alt}
            onChangeText={setAlt}
          />
        </TextField.Root>

        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            The description is read out by screen readers in place of the image,
            and shown in the emoji's details. Describe what it shows in a few
            words.
          </Trans>
        </Text>

        <Toggle.Item
          name="adult_only"
          label={l`Adult content`}
          value={adultOnly}
          onChange={setAdultOnly}>
          <Toggle.LabelText>
            <Trans>Adult content</Trans>
          </Toggle.LabelText>
          <Toggle.Platform />
        </Toggle.Item>

        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Adult emoji are hidden unless someone has adult content turned on.
          </Trans>
        </Text>

        <Button
          color="primary"
          size="large"
          disabled={!canSubmit}
          label={l`Add emoji`}
          onPress={() => {
            if (!file) return
            create({alias, alt, adultOnly, image: file}, {onSuccess: onDone})
          }}>
          <ButtonText>
            {isPending ? <Trans>Adding…</Trans> : <Trans>Add emoji</Trans>}
          </ButtonText>
        </Button>
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
