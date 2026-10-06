import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {usePalette} from '#/lib/hooks/usePalette'
import {IMAGE_FORMATS} from '#/lib/media/image-formats'
import {dynamicActivate} from '#/locale/i18n'
import {dynamicActivate as dynamicActivateWeb} from '#/locale/i18n.web'
import {type AppLanguage} from '#/locale/languages'
import {
  useAlsoLikedCollapseByDefault,
  useAlsoLikedFeedEnabled,
  useCompactPosts,
  useReplyIconIndicators,
  useSetCompactPosts,
  useSetReplyIconIndicators,
} from '#/state/preferences'
import {
  useDownloadFormat,
  useSetDownloadFormat,
} from '#/state/preferences/download-format'
import {
  useFullsizeFormat,
  useSetFullsizeFormat,
} from '#/state/preferences/fullsize-format'
import {
  useLoadAsPngs,
  useSetLoadAsPngs,
} from '#/state/preferences/load-small-pngs'
import {
  usePostReplacement,
  useSetPostReplacement,
} from '#/state/preferences/post-name-replacement'
import {
  useSetShowPostTags,
  useShowPostTags,
} from '#/state/preferences/show-post-tags'
import {
  useSetShowViaClient,
  useShowViaClient,
} from '#/state/preferences/show-via-client'
import {
  useSetSixSevenCelebration,
  useSixSevenCelebration,
} from '#/state/preferences/six-seven-celebration'
import {
  useSetThumbnailFormat,
  useThumbnailFormat,
} from '#/state/preferences/thumbnail-format'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import {Celebrate_Stroke2_Corner0_Rounded as CelebrateIcon} from '#/components/icons/Celebrate'
import {Heart2_Stroke2_Corner0_Rounded as HeartIcon} from '#/components/icons/Heart2'
import {Image_Stroke1_Corner0_Rounded as ImageIcon} from '#/components/icons/Image'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Tag_Stroke2_Corner2_Rounded as TagIcon} from '#/components/icons/Tag'
import {UFO_Stroke2_Corner0_Rounded as UfoIcon} from '#/components/icons/UFO'
import {Window_Stroke2_Corner2_Rounded as WindowIcon} from '#/components/icons/Window'
import {getReplyIcon} from '#/components/PostControls/ReplyIcon'
import * as Select from '#/components/Select'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {ItemTextWithSubtitle} from '../NotificationSettings/components/ItemTextWithSubtitle'
import {RunesScreenLayout} from './components/RunesScreenLayout'

export function RunesDisplaySettingsScreen() {
  const t = useTheme()
  const {t: l} = useLingui()

  const alsoLikedFeedEnabled = useAlsoLikedFeedEnabled()
  const alsoLikedCollapseByDefault = useAlsoLikedCollapseByDefault()
  const compactPosts = useCompactPosts()
  const setCompactPosts = useSetCompactPosts()

  const showPostTags = useShowPostTags()
  const setShowPostTags = useSetShowPostTags()

  const showViaClient = useShowViaClient()
  const setShowViaClient = useSetShowViaClient()
  const replyIconIndicators = useReplyIconIndicators()
  const setReplyIconIndicators = useSetReplyIconIndicators()

  const sixSevenCelebration = useSixSevenCelebration()
  const setSixSevenCelebration = useSetSixSevenCelebration()

  const thumbnailFormat = useThumbnailFormat() ?? 'default'
  const setThumbnailFormat = useSetThumbnailFormat()
  const fullsizeFormat = useFullsizeFormat() ?? 'default'
  const setFullsizeFormat = useSetFullsizeFormat()
  const downloadFormat = useDownloadFormat() ?? 'original'
  const setDownloadFormat = useSetDownloadFormat()
  const loadAsPngs = useLoadAsPngs()
  const setLoadAsPngs = useSetLoadAsPngs()
  const imageFormatItems = [
    {value: 'default', label: l`App server default`},
    ...IMAGE_FORMATS,
  ]

  const setPostReplacementDialogControl = Dialog.useDialogControl()

  return (
    <RunesScreenLayout titleText={l`Display`}>
      <SettingsList.LinkItem
        to="/settings/runes/display/also-liked"
        label={l`Also liked`}
        contentContainerStyle={[a.align_start]}>
        <SettingsList.ItemIcon icon={HeartIcon} />
        <ItemTextWithSubtitle
          titleText={<Trans>Also liked</Trans>}
          subtitleText={
            <AlsoLikedDeclaration
              enabled={alsoLikedFeedEnabled}
              collapseByDefault={alsoLikedCollapseByDefault}
            />
          }
        />
      </SettingsList.LinkItem>
      <Toggle.Item
        name="compact_posts"
        label={l`Compact posts`}
        value={compactPosts}
        onChange={value => setCompactPosts(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={UfoIcon} />
          <SettingsList.ItemText>
            <Trans>Compact posts</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        testID="showPostTagsToggle"
        name="show_post_tags"
        label={l`Show tags beneath posts`}
        value={showPostTags}
        onChange={setShowPostTags}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={TagIcon} />
          <SettingsList.ItemText>
            <Trans>Show tags beneath posts</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="show_via_client"
        label={l`Show client used to post`}
        value={showViaClient}
        onChange={value => setShowViaClient(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={WindowIcon} />
          <SettingsList.ItemText>
            <Trans>Show client used to post</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="reply_icon_indicators"
        label={l`Reply icon indicators`}
        value={replyIconIndicators ?? true}
        onChange={value => setReplyIconIndicators(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={getReplyIcon(3, false)} />
          <SettingsList.ItemText>
            <Trans>Reply icon indicators</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <Toggle.Item
        name="six_seven_celebration"
        label={l`67 celebration`}
        value={sixSevenCelebration ?? true}
        onChange={value => setSixSevenCelebration(value)}>
        <SettingsList.Item>
          <SettingsList.ItemIcon icon={CelebrateIcon} />
          <SettingsList.ItemText>
            <Trans>67 celebration</Trans>
          </SettingsList.ItemText>
          <Toggle.Platform />
        </SettingsList.Item>
      </Toggle.Item>
      <SettingsList.Item>
        <SettingsList.ItemIcon icon={PencilIcon} />
        <SettingsList.ItemText>
          <Trans>{`Custom post phrase`}</Trans>
        </SettingsList.ItemText>
        <SettingsList.BadgeButton
          label={l`Change`}
          onPress={() => setPostReplacementDialogControl.open()}
        />
      </SettingsList.Item>
      <PostReplacementDialog control={setPostReplacementDialogControl} />

      <SettingsList.Divider />
      <SettingsList.Group contentContainerStyle={[a.gap_sm]} iconInset={false}>
        <SettingsList.ItemIcon icon={ImageIcon} />
        <SettingsList.ItemText>
          <Trans>Images</Trans>
        </SettingsList.ItemText>
        <Text style={[a.w_full, a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>
            Choosing a different image format may increase load times.
          </Trans>
        </Text>
        <View style={[a.gap_md, a.w_full, a.pt_xs]}>
          <Text style={[a.font_bold]}>
            <Trans>Thumbnail format</Trans>
          </Text>
          <Select.Root
            value={thumbnailFormat}
            onValueChange={value => setThumbnailFormat(value)}>
            <Select.Trigger label={l`Select thumbnail format`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`Thumbnail format`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={imageFormatItems}
            />
          </Select.Root>
        </View>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.font_bold]}>
            <Trans>Full-size format</Trans>
          </Text>
          <Select.Root
            value={fullsizeFormat}
            onValueChange={value => setFullsizeFormat(value)}>
            <Select.Trigger label={l`Select full-size format`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`Full-size format`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={imageFormatItems}
            />
          </Select.Root>
        </View>
        <View style={[a.gap_md, a.w_full]}>
          <Text style={[a.font_bold]}>
            <Trans>Download format</Trans>
          </Text>
          <Select.Root
            value={downloadFormat}
            onValueChange={value => setDownloadFormat(value)}>
            <Select.Trigger label={l`Select download format`}>
              <Select.ValueText />
              <Select.Icon />
            </Select.Trigger>
            <Select.Content
              label={l`Download format`}
              renderItem={({label, value}) => (
                <Select.Item value={value} label={label}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{label}</Select.ItemText>
                </Select.Item>
              )}
              items={IMAGE_FORMATS}
            />
          </Select.Root>
        </View>
        <Toggle.Item
          name="load_as_pngs"
          label={l`Load especially small images as PNGs`}
          value={loadAsPngs}
          onChange={value => setLoadAsPngs(value)}
          style={[a.w_full, a.mt_xs]}>
          <Toggle.Checkbox />
          <Toggle.LabelText style={[a.flex_1]}>
            <Trans>Load especially small images as PNGs</Trans>
          </Toggle.LabelText>
        </Toggle.Item>
      </SettingsList.Group>
    </RunesScreenLayout>
  )
}

function AlsoLikedDeclaration({
  enabled,
  collapseByDefault,
}: {
  enabled: boolean
  collapseByDefault: boolean
}) {
  if (!enabled) {
    return <Trans>Hidden in thread views</Trans>
  }

  if (collapseByDefault) {
    return <Trans>Shown in thread views, collapsed by default</Trans>
  }

  return <Trans>Shown in thread views, expanded by default</Trans>
}

function PostReplacementDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  const pal = usePalette('default')
  const {t: l, i18n} = useLingui()

  const postReplacement = usePostReplacement()
  const setPostReplacement = useSetPostReplacement()

  const [singular, setSingular] = useState(postReplacement.postName)
  const [plural, setPlural] = useState(postReplacement.postsName)
  const [pluralManuallyEdited, setPluralManuallyEdited] = useState(false)
  const [singularInputVersion, setSingularInputVersion] = useState(0)
  const [pluralInputVersion, setPluralInputVersion] = useState(0)

  const syncInputValues = (
    nextSingular: string,
    nextPlural: string,
    manuallyEdited = false,
  ) => {
    setSingular(nextSingular)
    setPlural(nextPlural)
    setPluralManuallyEdited(manuallyEdited)
    setSingularInputVersion(version => version + 1)
    setPluralInputVersion(version => version + 1)
  }

  const submit = async () => {
    setPostReplacement({
      enabled: singular.trim().toLowerCase() !== 'post',
      postName: singular,
      postsName: plural,
    })

    const locale = i18n.locale
    await (IS_WEB
      ? dynamicActivateWeb(locale as AppLanguage)
      : dynamicActivate(locale as AppLanguage))

    control.close()
  }

  const handleSingularChange = (value: string) => {
    setSingular(value)
    if (!pluralManuallyEdited) {
      setPlural(`${value}s`)
      setPluralInputVersion(version => version + 1)
    }
  }

  const handlePluralChange = (value: string) => {
    setPlural(value)
    setPluralManuallyEdited(true)
  }

  const handlePresetSelect = (singularForm: string, pluralForm: string) => {
    syncInputValues(singularForm, pluralForm)
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventExpansion: true}}
      onClose={() =>
        syncInputValues(postReplacement.postName, postReplacement.postsName)
      }>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={l`Custom post phrase`}>
        <Text style={[a.text_2xl, a.font_bold, a.pb_lg]}>
          <Trans>Custom post phrase</Trans>
        </Text>

        <View style={a.gap_lg}>
          <Dialog.Input
            key={`post-replacement-singular-input-${singularInputVersion}`}
            label="Singular form"
            autoFocus
            style={[styles.textInput, pal.border, pal.text]}
            onChangeText={handleSingularChange}
            placeholder="skeet"
            placeholderTextColor={pal.colors.textLight}
            accessibilityHint={l`Input the singular form (e.g., "skeet")`}
            defaultValue={singular}
          />
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
            {[
              {singular: 'post', plural: 'posts'},
              {singular: 'skeet', plural: 'skeets'},
              {singular: 'note', plural: 'notes'},
              {singular: 'woot', plural: 'woots'},
              {singular: 'toot', plural: 'toots'},
              {singular: 'silly', plural: 'sillies'},
            ].map(preset => (
              <Button
                key={preset.singular}
                variant="ghost"
                color="primary"
                label={preset.singular}
                style={[a.px_sm, a.py_xs, a.rounded_sm]}
                onPress={() =>
                  handlePresetSelect(preset.singular, preset.plural)
                }>
                <ButtonText>{preset.singular}</ButtonText>
              </Button>
            ))}
          </View>
          <Dialog.Input
            key={`post-replacement-plural-input-${pluralInputVersion}`}
            label="Plural form"
            style={[styles.textInput, pal.border, pal.text, a.mt_lg]}
            onChangeText={handlePluralChange}
            placeholder="skeets"
            placeholderTextColor={pal.colors.textLight}
            accessibilityHint={l`Input the plural form (e.g., "skeets")`}
            defaultValue={plural}
          />

          <View style={IS_WEB && [a.flex_row, a.justify_end, a.pt_lg]}>
            <Button
              label={l`Save`}
              size="large"
              onPress={() => void submit()}
              variant="solid"
              color="primary"
              disabled={!singular.trim() || !plural.trim()}>
              <ButtonText>
                <Trans>Save</Trans>
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
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
}
