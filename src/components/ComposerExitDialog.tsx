import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {
  Button,
  type ButtonColor,
  ButtonIcon,
  ButtonText,
} from '#/components/Button'
import {useDialogContext} from '#/components/Dialog'
import {ArrowsDiagonalIn_Stroke2_Corner0_Rounded as MinimizeIcon} from '#/components/icons/ArrowsDiagonal'
import {type Props as IconProps} from '#/components/icons/common'
import {EditBig_Stroke2_Corner0_Rounded as EditIcon} from '#/components/icons/EditBig'
import {FloppyDisk_Stroke2_Corner0_Rounded as SaveIcon} from '#/components/icons/FloppyDisk'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Prompt from '#/components/Prompt'

export function ComposerExitDialog({
  control,
  isEditingDraft,
  canSaveDraft,
  onSave,
  onEditLater,
  onDiscard,
}: {
  control: Prompt.PromptControlProps
  isEditingDraft: boolean
  canSaveDraft: boolean
  onSave: () => void
  onEditLater: () => void
  onDiscard: () => void
}) {
  const {t: l} = useLingui()
  return (
    <Prompt.Outer
      control={control}
      testID="composerExitDialog"
      onBack={() => control.close(onEditLater)}>
      <Prompt.Content>
        <Prompt.TitleText>
          {canSaveDraft ? (
            isEditingDraft ? (
              <Trans>Save changes?</Trans>
            ) : (
              <Trans>Save draft?</Trans>
            )
          ) : (
            <Trans>Discard post?</Trans>
          )}
        </Prompt.TitleText>
        <Prompt.DescriptionText>
          {canSaveDraft ? (
            isEditingDraft ? (
              <Trans>
                You have unsaved changes to this draft, would you like to save
                them?
              </Trans>
            ) : (
              <Trans>
                Would you like to save this as a draft to edit later?
              </Trans>
            )
          ) : (
            <Trans>You can only save drafts up to 1000 characters.</Trans>
          )}
        </Prompt.DescriptionText>
      </Prompt.Content>
      <Prompt.Actions>
        <View style={[a.flex_row, a.gap_sm]}>
          <ExitAction
            label={l`Save draft`}
            icon={SaveIcon}
            color="primary"
            disabled={!canSaveDraft}
            onPress={onSave}
            testID="composerSaveDraftBtn"
          />
          <ExitAction
            label={l`Keep editing`}
            text={l`Continue`}
            icon={EditIcon}
            testID="composerKeepEditingBtn"
          />
        </View>
        <View style={[a.flex_row, a.gap_sm]}>
          <ExitAction
            label={l`Minimize`}
            icon={MinimizeIcon}
            onPress={onEditLater}
            testID="composerEditLaterBtn"
          />
          <ExitAction
            label={l`Discard`}
            icon={TrashIcon}
            color="negative_subtle"
            onPress={onDiscard}
            testID="composerDiscardBtn"
          />
        </View>
      </Prompt.Actions>
    </Prompt.Outer>
  )
}

function ExitAction({
  label,
  text = label,
  icon,
  color = 'secondary',
  disabled = false,
  onPress,
  testID,
}: {
  label: string
  text?: string
  icon: React.ComponentType<IconProps>
  color?: ButtonColor
  disabled?: boolean
  onPress?: () => void
  testID: string
}) {
  const {close} = useDialogContext()

  return (
    <Button
      label={label}
      color={color}
      size="large"
      disabled={disabled}
      style={[a.flex_1, a.flex_col, a.gap_sm, {minHeight: 88}]}
      onPress={() => {
        close(onPress)
      }}
      testID={testID}>
      <ButtonIcon icon={icon} />
      <ButtonText style={a.text_center}>{text}</ButtonText>
    </Button>
  )
}
