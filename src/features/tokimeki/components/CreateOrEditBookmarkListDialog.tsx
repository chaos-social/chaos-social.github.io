import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {cleanError} from '#/lib/strings/errors'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useBookmarkListMutation} from '../bookmarkListMutations'
import {type TokimekiBookmarkList} from '../bookmarkLists'
import {TOKIMEKI_PRIVACY_URL} from '../types'

/**
 * Create a private list, or rename one when `list` is passed.
 */
export function CreateOrEditBookmarkListDialog({
  control,
  list,
}: {
  control: Dialog.DialogControlProps
  list?: TokimekiBookmarkList
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {mutateAsync, isPending, error} = useBookmarkListMutation()
  /*
   * One dialog instance is reused for create and rename, and the row list
   * keeps it mounted, so seed the fields from the target while adjusting state
   * during render rather than letting a stale name leak between modes.
   */
  const [target, setTarget] = useState(list?.id)
  const [name, setName] = useState(list?.name ?? '')
  const [text, setText] = useState(list?.text ?? '')
  if (target !== list?.id) {
    setTarget(list?.id)
    setName(list?.name ?? '')
    setText(list?.text ?? '')
  }

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && !isPending

  const save = async () => {
    if (!canSave) return
    try {
      await mutateAsync(
        list
          ? {
              action: 'updateList',
              id: list.id,
              name: trimmedName,
              text: text.trim() || undefined,
            }
          : {
              action: 'createList',
              name: trimmedName,
              text: text.trim() || undefined,
            },
      )
      control.close()
    } catch {
      // The mutation toasts; keep the dialog open so the input is not lost.
    }
  }

  return (
    <Dialog.Outer control={control} testID="createOrEditBookmarkListDialog">
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={list ? l`Rename private list` : l`New private list`}
        style={web({maxWidth: 400})}>
        <View style={[a.gap_lg]}>
          <Text style={[a.text_lg, a.font_bold, t.atoms.text]}>
            {list ? l`Rename private list` : l`New private list`}
          </Text>
          <View>
            <TextField.LabelText>{l`Name`}</TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                value={name}
                onChangeText={setName}
                label={l`List name`}
                placeholder={l`e.g. Recipes`}
                testID="bookmarkListNameInput"
              />
            </TextField.Root>
          </View>
          <View>
            <TextField.LabelText>{l`Description`}</TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                value={text}
                onChangeText={setText}
                label={l`List description`}
                testID="bookmarkListDescriptionInput"
              />
            </TextField.Root>
          </View>
          {!list && (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                Private lists are managed by TOKIMEKI Bluesky and stored on
                their servers. Their{' '}
                <InlineLinkText
                  to={TOKIMEKI_PRIVACY_URL}
                  label={l`privacy policy`}
                  style={[a.text_sm]}>
                  privacy policy
                </InlineLinkText>{' '}
                applies.
              </Trans>
            </Text>
          )}
          {error ? (
            <Text style={[a.text_sm, {color: t.palette.negative_400}]}>
              {cleanError(error)}
            </Text>
          ) : null}
          <Button
            label={l`Save`}
            color="primary"
            size="large"
            disabled={!canSave}
            onPress={() => void save()}>
            <ButtonText>{l`Save`}</ButtonText>
            {isPending && <Loader size="xs" />}
          </Button>
        </View>
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}
