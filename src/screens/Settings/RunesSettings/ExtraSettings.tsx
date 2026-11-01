import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {usePalette} from '#/lib/hooks/usePalette'
import {
  useAutoLikeOnRepost,
  useSetAutoLikeOnRepost,
} from '#/state/preferences/auto-like-on-repost.tsx'
import {
  useDirectFetchRecords,
  useSetDirectFetchRecords,
} from '#/state/preferences/direct-fetch-records'
import {
  useDisableViaRepostNotification,
  useSetDisableViaRepostNotification,
} from '#/state/preferences/disable-via-repost-notification'
import {
  useDiscoverContextEnabled,
  useSetDiscoverContextEnabled,
} from '#/state/preferences/discover-context-enabled'
import {
  useOmitViaField,
  useSetOmitViaField,
} from '#/state/preferences/omit-via-field'
import {
  useRenderBridgedHtml,
  useSetRenderBridgedHtml,
} from '#/state/preferences/render-bridged-html'
import {
  useSeeThroughBlocks,
  useSetSeeThroughBlocks,
} from '#/state/preferences/see-through-blocks'
import {
  useSetShowBiteButton,
  useShowBiteButton,
} from '#/state/preferences/show-bite-button'
import {useSetTidSuffix, useTidSuffix} from '#/state/preferences/tid-suffix'
import {
  useAutoTranslatePosts,
  useMymemoryEmail,
  useSetAutoTranslatePosts,
} from '#/state/preferences/translation-service-preference'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {BellRinging_Stroke2_Corner0_Rounded as BellRingingIcon} from '#/components/icons/BellRinging'
import {BubbleQuestion_Stroke2_Corner0_Rounded as TranslateIcon} from '#/components/icons/Bubble'
import {CodeBrackets_Stroke2_Corner2_Rounded as CodeBracketsIcon} from '#/components/icons/CodeBrackets'
import {Bite as BiteIcon} from '#/components/icons/Cookie'
import {Envelope_Stroke2_Corner2_Rounded as EnvelopeIcon} from '#/components/icons/Envelope'
import {Explosion_Stroke2_Corner0_Rounded as ExplosionIcon} from '#/components/icons/Explosion'
import {Eye_Stroke2_Corner0_Rounded as VisibilityIcon} from '#/components/icons/Eye'
import {Fediverse as FediverseIcon} from '#/components/icons/Fediverse'
import {Hashtag_Stroke2_Corner0_Rounded as HashtagIcon} from '#/components/icons/Hashtag'
import {LikeRepost_Stroke2_Corner2_Rounded as LikeRepostIcon} from '#/components/icons/Heart2'
import {Lab_Stroke2_Corner0_Rounded as BeakerIcon} from '#/components/icons/Lab'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {useDevMode} from '#/storage/hooks/dev-mode'
import {RunesScreenLayout} from './components/RunesScreenLayout'
import {MymemoryEmailDialog} from './MymemoryEmailDialog'

export function RunesExtraSettingsScreen() {
  const {t: l} = useLingui()

  const directFetchRecords = useDirectFetchRecords()
  const setDirectFetchRecords = useSetDirectFetchRecords()

  const autoLikeOnRepost = useAutoLikeOnRepost()
  const setAutoLikeOnRepost = useSetAutoLikeOnRepost()

  const disableViaRepostNotification = useDisableViaRepostNotification()
  const setDisableViaRepostNotification = useSetDisableViaRepostNotification()

  const discoverContextEnabled = useDiscoverContextEnabled()
  const setDiscoverContextEnabled = useSetDiscoverContextEnabled()

  const omitViaField = useOmitViaField()
  const setOmitViaField = useSetOmitViaField()

  const seeThroughBlocks = useSeeThroughBlocks()
  const setSeeThroughBlocks = useSetSeeThroughBlocks()
  const renderBridgedHtml = useRenderBridgedHtml()
  const setRenderBridgedHtml = useSetRenderBridgedHtml()
  const showBiteButton = useShowBiteButton()
  const setShowBiteButton = useSetShowBiteButton()
  const tidSuffix = useTidSuffix()
  const setTidSuffixControl = Dialog.useDialogControl()
  const autoTranslate = useAutoTranslatePosts()
  const setAutoTranslate = useSetAutoTranslatePosts()
  const mymemoryEmail = useMymemoryEmail()
  const mymemoryEmailControl = Dialog.useDialogControl()
  const [devMode, setDevMode] = useDevMode()

  return (
    <RunesScreenLayout titleText={l`Extra`}>
      <Toggle.Item
        name="direct_fetch_records"
        label={l`Fetch records directly from PDS to fix broken quotes`}
        value={directFetchRecords}
        onChange={value => setDirectFetchRecords(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={VisibilityIcon} />
          <SettingsList.ItemText>
            <Trans>Fetch records directly from PDS to fix broken quotes</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="show_bite_button"
        label={l`Show bite in post menus`}
        value={showBiteButton}
        onChange={value => setShowBiteButton(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={BiteIcon} />
          <SettingsList.ItemText>
            <Trans>Show bite in post menus</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="see_through_blocks"
        label={l`See through blocks`}
        value={seeThroughBlocks}
        onChange={value => setSeeThroughBlocks(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={VisibilityIcon} />
          <SettingsList.ItemText>
            <Trans>See through blocks</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="render_bridged_html"
        label={l`Render formatted text from bridged fediverse posts`}
        value={renderBridgedHtml}
        onChange={value => setRenderBridgedHtml(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={FediverseIcon} />
          <SettingsList.ItemText>
            <Trans>Render formatted text from bridged fediverse posts</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="auto_like_on_repost"
        label={l`Auto-like what you repost`}
        value={autoLikeOnRepost}
        onChange={value => setAutoLikeOnRepost(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={LikeRepostIcon} />
          <SettingsList.ItemText>
            <Trans>Auto-like what you repost</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="disable_via_repost_notification"
        label={l`Disable via repost notifications`}
        value={disableViaRepostNotification}
        onChange={value => setDisableViaRepostNotification(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={BellRingingIcon} />
          <SettingsList.ItemText>
            <Trans>Disable via repost notifications</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <Admonition type="info" style={[a.flex_1]}>
          <Trans>
            Forcefully disables the notifications other people receive when you
            like/repost a post someone else has reposted for privacy.
          </Trans>
        </Admonition>
      </SettingsList.Item>
      <Toggle.Item
        name="discover_context"
        label={l`Show debug context for posts in Discover feed`}
        value={discoverContextEnabled}
        onChange={value => setDiscoverContextEnabled(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={BeakerIcon} />
          <SettingsList.ItemText>
            <Trans>Show debug context for posts in Discover feed</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="omit_via_field"
        label={l`Don't include the 'via' field in own posts`}
        value={omitViaField}
        onChange={value => setOmitViaField(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={ExplosionIcon} />
          <SettingsList.ItemText>
            <Trans>Don't include the 'via' field in own posts</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={HashtagIcon} />
        <SettingsList.ItemText>
          <Trans>Custom TID suffix for posts</Trans>
        </SettingsList.ItemText>
        <SettingsList.BadgeButton
          label={tidSuffix ? l`Change` : l`Set`}
          onPress={() => setTidSuffixControl.open()}
        />
      </SettingsList.Item>
      <SettingsList.Item>
        <Admonition type="info" style={[a.flex_1]}>
          <Trans>
            Replace the last characters of the first post in a thread's record
            key with a custom suffix (up to 6 characters). Current:&nbsp;
            <Text style={[a.font_bold]}>{tidSuffix || l`none`}</Text>
          </Trans>
        </Admonition>
      </SettingsList.Item>
      <Toggle.Item
        name="dev_mode"
        label={l`Developer mode`}
        value={devMode}
        onChange={value => setDevMode(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={CodeBracketsIcon} />
          <SettingsList.ItemText>
            <Trans>Developer mode</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="auto_translate_posts"
        label={l`Automatically translate posts in other languages`}
        value={autoTranslate}
        onChange={value => setAutoTranslate(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={TranslateIcon} />
          <SettingsList.ItemText>
            <Trans>Automatically translate posts in other languages</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <Admonition type="info" style={[a.flex_1]}>
          <Trans>
            Posts translate in place a moment after they scroll into view, using
            the free MyMemory service. Post text is sent to
            mymemory.translated.net to be translated, and its daily limit means
            only a few hundred posts a day. Without an email it is about a tenth
            of that.
          </Trans>
        </Admonition>
      </SettingsList.Item>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={EnvelopeIcon} />
        <SettingsList.ItemText>
          <Trans>MyMemory contact email</Trans>
        </SettingsList.ItemText>
        <SettingsList.BadgeButton
          label={mymemoryEmail ? l`Change` : l`Set`}
          onPress={() => mymemoryEmailControl.open()}
        />
      </SettingsList.Item>
      <SettingsList.Item>
        <Admonition type="info" style={[a.flex_1]}>
          <Trans>
            Sent to MyMemory to raise its daily translation limit from 5,000 to
            50,000 characters. Optional, and stored only on this account.
            Current:&nbsp;
            <Text style={[a.font_bold]}>{mymemoryEmail || l`none`}</Text>
          </Trans>
        </Admonition>
      </SettingsList.Item>
      <SettingsList.LinkItem
        to="/settings/runes/extra/feature-gates"
        label={l`Feature gates`}>
        <SettingsList.ItemIcon icon={BeakerIcon} />
        <SettingsList.ItemText>
          <Trans>Feature gates</Trans>
        </SettingsList.ItemText>
      </SettingsList.LinkItem>
      <TidSuffixDialog control={setTidSuffixControl} />
      <MymemoryEmailDialog control={mymemoryEmailControl} />
    </RunesScreenLayout>
  )
}

const MAX_TID_SUFFIX_LEN = 6

function TidSuffixDialog({control}: {control: Dialog.DialogControlProps}) {
  const pal = usePalette('default')
  const {t: l} = useLingui()

  const tidSuffix = useTidSuffix()
  const [suffix, setSuffix] = useState(tidSuffix ?? '')
  const setTidSuffix = useSetTidSuffix()
  const isClear = suffix.trim().length === 0

  const submit = () => {
    const trimmedSuffix = suffix.trim().slice(0, MAX_TID_SUFFIX_LEN)
    control.close(() => {
      setTidSuffix(trimmedSuffix || undefined)
    })
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() => setSuffix(tidSuffix ?? '')}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Custom TID suffix`}>
        <View style={[a.gap_sm, a.pb_lg]}>
          <Text style={[a.text_2xl, a.font_bold]}>
            <Trans>Custom TID suffix</Trans>
          </Text>
        </View>

        <View style={a.gap_lg}>
          <Dialog.Input
            label={l`TID suffix`}
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={text => setSuffix(text.slice(0, MAX_TID_SUFFIX_LEN))}
            placeholder={l`e.g. abc`}
            placeholderTextColor={pal.colors.textLight}
            onSubmitEditing={submit}
            accessibilityHint={l`Input up to 6 characters to use as a TID suffix`}
            defaultValue={tidSuffix}
            maxLength={MAX_TID_SUFFIX_LEN}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end]}>
            <Button
              label={isClear ? l`Clear` : l`Save`}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color={isClear ? 'secondary' : 'primary'}>
              <ButtonText>
                {isClear ? <Trans>Clear</Trans> : <Trans>Save</Trans>}
              </ButtonText>
            </Button>
          </View>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

const styles = {
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
}
