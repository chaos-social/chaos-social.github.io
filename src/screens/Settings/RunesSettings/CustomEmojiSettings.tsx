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
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {BluemojiImage} from '#/features/bluemoji/BluemojiImage'
import {BulkEmojiDialogForm} from '#/features/bluemoji/collection/BulkEmojiDialog'
import {
  useBulkEmojiMutation,
  useDeleteEmojiMutation,
  useSaveEmojiMutation,
} from '#/features/bluemoji/collection/mutations'
import {useOwnCollectionQuery} from '#/features/bluemoji/collection/queries'
import {NewEmojiTile, Tile, TileGrid} from '#/features/bluemoji/Picker'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {RunesScreenLayout} from './components/RunesScreenLayout'

/**
 * The viewer's own Bluemoji collection, plus an editor for it. The record is the
 * one moji.blue itself writes; we only need an image and an alias.
 */
export function CustomEmojiSettingsScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const control = Dialog.useDialogControl()
  const deletePrompt = Prompt.usePromptControl()
  // Read from our own PDS: moji.blue's listing lags the firehose, so a new
  // emoji would be invisible here for a while.
  const {data: items = []} = useOwnCollectionQuery()
  const bulkControl = Dialog.useDialogControl()
  const [editing, setEditing] = useState<BluemojiItem | undefined>()
  const [deleting, setDeleting] = useState<BluemojiItem | undefined>()
  const {mutate: deleteEmoji} = useDeleteEmojiMutation()
  const {mutate: bulkSave, isPending: isBulkPending} = useBulkEmojiMutation()

  const openNew = () => {
    setEditing(undefined)
    control.open()
  }

  const openEdit = (item: BluemojiItem) => {
    setEditing(item)
    control.open()
  }

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
            <Tile
              key={item.uri}
              label={item.record.name}
              item={item}
              onPress={() => openEdit(item)}
            />
          ))}
          <NewEmojiTile onPress={openNew} />
        </TileGrid>
        {items.length > 0 ? (
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>Tap an emoji to change or delete it.</Trans>
          </Text>
        ) : null}
        <View style={[a.w_full, a.align_start]}>
          <Button
            color="secondary"
            size="small"
            label={l`Upload several at once`}
            onPress={bulkControl.open}>
            <ButtonText>
              <Trans>Upload several at once</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>

      <Dialog.Outer
        control={bulkControl}
        nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <BulkEmojiDialogForm
          isPending={isBulkPending}
          onSave={(drafts, onProgress) =>
            bulkSave(
              {drafts, onProgress},
              {onSuccess: () => bulkControl.close()},
            )
          }
        />
      </Dialog.Outer>

      <Dialog.Outer
        control={control}
        nativeOptions={{preventExpansion: true}}
        onClose={() => setEditing(undefined)}>
        <Dialog.Handle />
        <EmojiForm
          // A fresh form per target, so prefill state never leaks between them.
          key={editing?.uri ?? 'new'}
          editing={editing}
          onDone={control.close}
          onDelete={() => {
            // The confirm prompts from the editor's target, not stale state.
            setDeleting(editing)
            control.close(deletePrompt.open)
          }}
        />
      </Dialog.Outer>

      <Prompt.Basic
        control={deletePrompt}
        title={l`Delete this emoji?`}
        description={
          deleting
            ? l`Posts that use ${deleting.record.name} will show the alias instead.`
            : undefined
        }
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        // Cleared here rather than on close: the action runs after the dialog
        // closes, so an onClose handler would wipe the target first.
        onConfirm={() => {
          if (deleting) deleteEmoji(deleting)
          setDeleting(undefined)
        }}
      />
    </RunesScreenLayout>
  )
}

/**
 * Create and edit in one form: an existing item prefills the fields and its
 * image is only re-uploaded when the viewer picks a new one.
 */
function EmojiForm({
  editing,
  onDone,
  onDelete,
}: {
  editing?: BluemojiItem
  onDone: () => void
  onDelete: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {mutate: save, isPending} = useSaveEmojiMutation()
  const [file, setFile] = useState<RNImage | null>(null)
  const [alias, setAlias] = useState(editing?.record.name ?? '')
  const [alt, setAlt] = useState(editing?.record.alt ?? '')
  const [adultOnly, setAdultOnly] = useState(editing?.record.adultOnly ?? false)

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

  // An edit can keep its current image, so a file is only required for a new one.
  const canSubmit = Boolean((file || editing) && alias.trim()) && !isPending

  return (
    <Dialog.ScrollableInner label={editing ? l`Edit emoji` : l`New emoji`}>
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
            ) : editing ? (
              <BluemojiImage
                item={editing}
                size={64}
                label={editing.record.name}
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
          label={editing ? l`Save emoji` : l`Add emoji`}
          onPress={() => {
            save(
              {alias, alt, adultOnly, image: file ?? undefined, editing},
              {onSuccess: onDone},
            )
          }}>
          <ButtonText>
            {isPending ? (
              <Trans>Saving…</Trans>
            ) : editing ? (
              <Trans>Save emoji</Trans>
            ) : (
              <Trans>Add emoji</Trans>
            )}
          </ButtonText>
        </Button>

        {editing ? (
          <Button
            color="negative_subtle"
            size="large"
            label={l`Delete emoji`}
            onPress={onDelete}>
            <ButtonText>
              <Trans>Delete emoji</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>
      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
