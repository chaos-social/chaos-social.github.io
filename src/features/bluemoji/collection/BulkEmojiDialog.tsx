import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {compressIfNeeded} from '#/lib/media/manip'
import {openMultiplePicker, type RNImage} from '#/lib/media/picker'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {aliasFromFileName, aliasToRkey} from '#/features/bluemoji/alias'
import {type EmojiDraft} from '#/features/bluemoji/collection/mutations'

/** A picked file plus the alias it will be saved under. */
type Row = {image: RNImage & {fileName?: string}; alias: string}

/**
 * Add a whole folder of emoji in one go. Each alias defaults to the file name;
 * the field is here because a file name is rarely a good alias, and because it
 * is the only thing that can fail per item.
 */
export function BulkEmojiDialogForm({
  onSave,
  isPending,
}: {
  onSave: (drafts: EmojiDraft[], onProgress: (done: number) => void) => void
  isPending: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [rows, setRows] = useState<Row[]>([])
  const [done, setDone] = useState(0)

  const pick = async () => {
    const images = await openMultiplePicker()
    if (!images.length) return
    setRows(
      images.map((image, index) => ({
        image,
        // Two files with the same alias would write the same record, so the
        // fallback is indexed rather than derived from a clock.
        alias: image.fileName
          ? aliasFromFileName(image.fileName)
          : `emoji_${index + 1}`,
      })),
    )
  }

  // Later duplicates would overwrite earlier ones on write, since the alias is
  // the record key.
  const duplicates = rows
    .map(row => row.alias.trim().toLowerCase())
    .filter((alias, index, all) => alias && all.indexOf(alias) !== index)
  const invalid = rows.filter(row => !isValidAlias(row.alias))
  const canSubmit =
    rows.length > 0 && !invalid.length && !duplicates.length && !isPending

  const save = async () => {
    // Resize up front, sequentially, so a huge folder does not spike memory.
    const drafts: EmojiDraft[] = []
    for (const row of rows) {
      drafts.push({
        alias: row.alias,
        image: await compressIfNeeded(row.image, {
          maxDimension: 128,
          maxSize: 128_000,
        }),
      })
    }
    setDone(0)
    onSave(drafts, setDone)
  }

  return (
    <Dialog.ScrollableInner label={l`Bulk upload`}>
      <View style={[a.gap_md, a.pb_lg]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Pick several images at once and save them as emoji. Each alias
            starts as the file name; rename any that you want to be easier to
            type.
          </Trans>
        </Text>

        <View style={[a.w_full, a.align_start]}>
          <Button
            color="secondary"
            size="small"
            label={l`Choose images`}
            onPress={() => void pick()}>
            <ButtonText>
              <Trans>Choose images</Trans>
            </ButtonText>
          </Button>
        </View>

        {rows.map((row, index) => (
          <View key={`${row.image.path}-${index}`} style={[a.gap_2xs]}>
            <TextField.Root isInvalid={!isValidAlias(row.alias)}>
              <TextField.LabelText>
                {row.image.fileName ?? l`Image`}
              </TextField.LabelText>
              <TextField.Input
                label={l`Alias`}
                value={row.alias}
                onChangeText={alias =>
                  setRows(previous =>
                    previous.map((current, i) =>
                      i === index ? {...current, alias} : current,
                    ),
                  )
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
            {!isValidAlias(row.alias) ? (
              <AliasProblemText>
                <Trans>Use letters, numbers, and . _ - with no spaces.</Trans>
              </AliasProblemText>
            ) : duplicates.includes(row.alias.trim().toLowerCase()) ? (
              <AliasProblemText>
                <Trans>Another image already uses this alias.</Trans>
              </AliasProblemText>
            ) : null}
          </View>
        ))}

        {(invalid.length || duplicates.length) && rows.length ? (
          <Admonition type="warning">
            <Trans>Some aliases need changing before you can save.</Trans>
          </Admonition>
        ) : null}

        {isPending ? (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Adding {done} of {rows.length}…
            </Trans>
          </Text>
        ) : null}

        <Button
          color="primary"
          size="large"
          disabled={!canSubmit}
          label={l`Add emoji`}
          onPress={() => void save()}>
          <ButtonText>
            {isPending ? (
              <Trans>Adding…</Trans>
            ) : (
              <Trans>Add {rows.length || ''} emoji</Trans>
            )}
          </ButtonText>
        </Button>
      </View>
      {IS_WEB ? <Dialog.Close /> : null}
    </Dialog.ScrollableInner>
  )
}

function AliasProblemText({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text style={[a.text_xs, {color: t.palette.negative_500}]}>{children}</Text>
  )
}

/** True when the alias survives the same validation the record write applies. */
function isValidAlias(alias: string) {
  try {
    aliasToRkey(alias)
    return true
  } catch {
    return false
  }
}
