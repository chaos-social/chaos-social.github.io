import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {getShapeRadius} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {LeaveConvoPrompt} from '#/components/dms/LeaveConvoPrompt'
import {ArrowBoxLeft_Stroke2_Corner0_Rounded as LeaveIcon} from '#/components/icons/ArrowBoxLeft'
import {PersonX_Stroke2_Corner0_Rounded as PersonXIcon} from '#/components/icons/Person'
import {Text} from '#/components/Typography'

export function MessagesListDeletedAccountFooter({convoId}: {convoId: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const enableSquareButtons = useEnableSquareButtons()
  const leaveConvoControl = useDialogControl()

  return (
    <View style={[a.p_md]}>
      <View
        style={[
          a.align_center,
          a.justify_center,
          a.p_lg,
          t.atoms.bg_contrast_50,
          {borderRadius: getShapeRadius(enableSquareButtons, 20, 40)},
        ]}>
        <PersonXIcon fill={t.atoms.text.color} size="lg" style={[a.mb_xs]} />
        <Text
          style={[
            a.mb_xs,
            a.text_center,
            a.text_md,
            a.font_semi_bold,
            t.atoms.text,
          ]}>
          <Trans>This account is no longer available</Trans>
        </Text>
        <Text
          style={[
            a.text_center,
            a.text_sm,
            a.leading_snug,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>
            This person has deactivated, been suspended, or deleted their
            account. You can read chat history but can’t send new messages.
          </Trans>
        </Text>
        <Button
          label={l`Leave chat`}
          color="secondary_inverted"
          size="large"
          style={[a.mt_lg, a.w_full]}
          onPress={leaveConvoControl.open}>
          <ButtonIcon icon={LeaveIcon} />
          <ButtonText>
            <Trans>Leave chat</Trans>
          </ButtonText>
        </Button>
        <LeaveConvoPrompt
          control={leaveConvoControl}
          currentScreen="conversation"
          convoId={convoId}
        />
      </View>
    </View>
  )
}
