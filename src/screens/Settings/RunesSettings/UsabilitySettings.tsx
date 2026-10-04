import {Trans, useLingui} from '@lingui/react/macro'

import {
  useGoLinksEnabled,
  usePasteToLinkEnabled,
  useSetGoLinksEnabled,
  useSetPasteToLinkEnabled,
} from '#/state/preferences'
import {
  useConfirmFollow,
  useSetConfirmFollow,
} from '#/state/preferences/confirm-follow'
import {
  useDisableVerifyEmailReminder,
  useSetDisableVerifyEmailReminder,
} from '#/state/preferences/disable-verify-email-reminder'
import {
  useHideScaryFollowButtons,
  useSetHideScaryFollowButtons,
} from '#/state/preferences/hide-scary-follow-buttons'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ArrowShareRightIcon} from '#/components/icons/ArrowShareRight'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {CircleQuestion_Stroke2_Corner2_Rounded as CircleQuestionIcon} from '#/components/icons/CircleQuestion'
import {Envelope_Stroke2_Corner2_Rounded as EnvelopeIcon} from '#/components/icons/Envelope'
import {Newspaper_Stroke2_Corner2_Rounded as NewspaperIcon} from '#/components/icons/Newspaper'
import {PersonGroup_Stroke2_Corner2_Rounded as PersonGroupIcon} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {IS_WEB} from '#/env'
import {RunesScreenLayout} from './components/RunesScreenLayout'

export function RunesUsabilitySettingsScreen() {
  const {t: l} = useLingui()

  const confirmFollow = useConfirmFollow()
  const setConfirmFollow = useSetConfirmFollow()

  const pasteToLinkEnabled = usePasteToLinkEnabled()
  const setPasteToLinkEnabled = useSetPasteToLinkEnabled()

  const goLinksEnabled = useGoLinksEnabled()
  const setGoLinksEnabled = useSetGoLinksEnabled()

  const hideScaryFollowButtons = useHideScaryFollowButtons()
  const setHideScaryFollowButtons = useSetHideScaryFollowButtons()

  const disableVerifyEmailReminder = useDisableVerifyEmailReminder()
  const setDisableVerifyEmailReminder = useSetDisableVerifyEmailReminder()

  return (
    <RunesScreenLayout titleText={l`Usability`}>
      <SettingsList.LinkItem
        to="/settings/runes/usability/feeds"
        label={l`Feeds`}>
        <SettingsList.ItemIcon icon={NewspaperIcon} />
        <SettingsList.ItemText>
          <Trans>Feeds</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      <SettingsList.LinkItem
        to="/settings/runes/usability/profiles"
        label={l`Profiles`}>
        <SettingsList.ItemIcon icon={PersonGroupIcon} />
        <SettingsList.ItemText>
          <Trans>Profiles</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      <Toggle.Item
        name="use_go_links"
        label={l`Redirect through go.bsky.app`}
        value={goLinksEnabled ?? false}
        onChange={value => setGoLinksEnabled(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={ArrowShareRightIcon} />
          <SettingsList.ItemText>
            <Trans>Redirect through go.bsky.app</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      {IS_WEB && (
        <Toggle.Item
          testID="pasteToLinkToggle"
          name="paste_to_link"
          label={l`Paste anywhere to open link`}
          value={pasteToLinkEnabled}
          onChange={setPasteToLinkEnabled}>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={ChainLinkIcon} />
            <SettingsList.ItemText>
              <Trans>Paste anywhere to open link</Trans>
            </SettingsList.ItemText>
            <Toggle.Platform />
          </SettingsList.Item>
        </Toggle.Item>
      )}
      <Toggle.Item
        testID="confirmFollowToggle"
        name="confirm_follow"
        label={l`Confirm before following`}
        value={confirmFollow}
        onChange={setConfirmFollow}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={CircleQuestionIcon} />
          <SettingsList.ItemText>
            <Trans>Confirm before following</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="hide_scary_follow_buttons"
        label={l`Hide follow button on posts and scrolled profile header`}
        value={hideScaryFollowButtons}
        onChange={value => setHideScaryFollowButtons(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={PlusIcon} />
          <SettingsList.ItemText>
            <Trans>
              Hide follow button on posts and scrolled profile header
            </Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="disable_verify_email_reminder"
        label={l`Disable verify email reminder`}
        value={disableVerifyEmailReminder}
        onChange={value => setDisableVerifyEmailReminder(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={EnvelopeIcon} />
          <SettingsList.ItemText>
            <Trans>Disable verify email reminder</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <Admonition type="warning" style={[a.flex_1]}>
          <Trans>
            This only gets rid of the reminder on app launch, useful if your PDS
            does not have email verification setup.&nbsp;This does NOT give
            access to features locked behind email verification.
          </Trans>
        </Admonition>
      </SettingsList.Item>
    </RunesScreenLayout>
  )
}
