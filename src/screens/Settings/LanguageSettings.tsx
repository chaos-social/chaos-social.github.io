import {useCallback, useMemo, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {
  codeToLanguageName,
  languageName,
  sanitizeAppLanguageSetting,
} from '#/locale/helpers'
import {APP_LANGUAGES, LANGUAGES} from '#/locale/languages'
import {
  useLanguagePrefs,
  useLanguagePrefsApi,
  useSetTranslationServicePreference,
  useTranslationServicePreference,
} from '#/state/preferences'
import {fromPostLanguages, toPostLanguages} from '#/state/preferences/languages'
import {LibreTranslateInstanceDialog} from '#/screens/Settings/components/LibreTranslateInstanceDialog'
import {atoms as a, native, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {LanguageSelectDialog} from '#/components/dialogs/LanguageSelectDialog'
import * as Toggle from '#/components/forms/Toggle'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronBottomIcon} from '#/components/icons/Chevron'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {createStaticClick, InlineLinkText} from '#/components/Link'
import * as Select from '#/components/Select'
import {Text} from '#/components/Typography'
import * as SettingsList from './components/SettingsList'

const DEDUPED_LANGUAGES = LANGUAGES.filter(
  (lang, i, arr) =>
    lang.code2 && arr.findIndex(l => l.code2 === lang.code2) === i,
)

type Props = NativeStackScreenProps<CommonNavigatorParams, 'LanguageSettings'>
export function LanguageSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [postLanguagesFocused, setPostLanguagesFocused] = useState(false)
  const langPrefs = useLanguagePrefs()
  const setLangPrefs = useLanguagePrefsApi()
  const translationServicePreference = useTranslationServicePreference()
  const setTranslationServicePreference = useSetTranslationServicePreference()
  const libreTranslateInstanceControl = useDialogControl()

  const translationProviderItems = [
    {value: 'google', label: l`Google Translate`},
    {value: 'kagi', label: l`Kagi Translate`},
    {value: 'papago', label: l`Naver Papago`},
    {value: 'libreTranslate', label: l`LibreTranslate`},
  ] as const

  // changing langPrefs causes a slow re-render, so we use a local state copy
  // and update that first to drive the UI on this screen to keep it snappy
  const [contentLanguages, _setContentLanguages] = useState(
    langPrefs.contentLanguages,
  )
  const setContentLanguages = useCallback(
    (languages: string[]) => {
      _setContentLanguages(languages)
      // TODO: try using startTransition/useOptimistic when we switch to New Arch
      // Old arch doesn't support concurrent react features so use rAF instead
      requestAnimationFrame(() => {
        setLangPrefs.setContentLanguages(languages)
      })
    },
    [setLangPrefs],
  )

  const contentLanguagePrefsControl = useDialogControl()
  const postLanguagePrefsControl = useDialogControl()
  const defaultPostLanguages = toPostLanguages(langPrefs.postLanguage)

  const onChangePrimaryLanguage = useCallback(
    (value: string) => {
      if (!value) return
      if (langPrefs.primaryLanguage !== value) {
        setLangPrefs.setPrimaryLanguage(value)
      }
    },
    [langPrefs, setLangPrefs],
  )

  const onChangeAppLanguage = useCallback(
    (value: string) => {
      if (!value) return
      if (langPrefs.appLanguage !== value) {
        setLangPrefs.setAppLanguage(sanitizeAppLanguageSetting(value))
      }
    },
    [langPrefs, setLangPrefs],
  )

  const [recentLanguages, setRecentLanguages] = useState<string[]>(
    langPrefs.contentLanguages,
  )

  const possibleLanguages = useMemo(() => {
    return [
      ...new Set([
        ...recentLanguages,
        ...contentLanguages,
        ...langPrefs.primaryLanguage,
      ]),
    ]
      .map(lang => LANGUAGES.find(l => l.code2 === lang))
      .filter(x => !!x)
  }, [recentLanguages, contentLanguages, langPrefs.primaryLanguage])

  return (
    <Layout.Screen testID="PreferencesLanguagesScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Languages</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Group iconInset={false}>
            <SettingsList.ItemText>
              <Trans>App language</Trans>
            </SettingsList.ItemText>
            <View style={[a.gap_md, a.w_full]}>
              <Text style={[a.leading_snug]}>
                <Trans>
                  Select which language to use for the app's user interface.
                </Trans>
              </Text>
              <Select.Root
                value={sanitizeAppLanguageSetting(langPrefs.appLanguage)}
                onValueChange={onChangeAppLanguage}>
                <Select.Trigger label={l`Select app language`}>
                  <Select.ValueText />
                  <Select.Icon />
                </Select.Trigger>
                <Select.Content
                  label={l`App language`}
                  renderItem={({label, value}) => (
                    <Select.Item value={value} label={label}>
                      <Select.ItemIndicator />
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  )}
                  items={APP_LANGUAGES.map(l => ({
                    label: l.name,
                    value: l.code2,
                  }))}
                />
              </Select.Root>
            </View>
          </SettingsList.Group>
          <SettingsList.Divider />
          <SettingsList.Group iconInset={false}>
            <SettingsList.ItemText>
              <Trans>Default posting languages</Trans>
            </SettingsList.ItemText>
            <View style={[a.gap_md, a.w_full]}>
              <Text style={[a.leading_snug]}>
                <Trans>
                  Select up to 3 languages for new posts and replies.
                </Trans>
              </Text>
              <Button
                testID="defaultPostLanguagesBtn"
                color="secondary"
                size="large"
                shape="rectangular"
                style={[
                  a.w_full,
                  a.justify_between,
                  a.pl_lg,
                  a.pr_md,
                  web([
                    a.gap_sm,
                    a.py_sm,
                    a.px_md,
                    t.atoms.bg_contrast_50,
                    {
                      maxWidth: 400,
                      borderWidth: 1,
                      borderColor: postLanguagesFocused
                        ? t.palette.primary_500
                        : t.palette.contrast_50,
                    },
                  ]),
                ]}
                hoverStyle={web(t.atoms.bg_contrast_50)}
                label={l`Choose default posting languages`}
                onFocus={() => setPostLanguagesFocused(true)}
                onBlur={() => setPostLanguagesFocused(false)}
                onPress={postLanguagePrefsControl.open}>
                <Text style={[a.flex_1, native(a.text_md)]}>
                  {defaultPostLanguages
                    .map(language =>
                      codeToLanguageName(language, langPrefs.appLanguage),
                    )
                    .join(' + ')}
                </Text>
                <ChevronBottomIcon size="xs" style={t.atoms.text} />
              </Button>
              <LanguageSelectDialog
                control={postLanguagePrefsControl}
                titleText={<Trans>Default posting languages</Trans>}
                subtitleText={
                  <Trans>
                    Select up to 3 languages for new posts and replies
                  </Trans>
                }
                currentLanguages={defaultPostLanguages}
                minLanguages={1}
                maxLanguages={3}
                onSelectLanguages={languages => {
                  if (languages.length > 0) {
                    setLangPrefs.setPostLanguage(fromPostLanguages(languages))
                  }
                }}
              />
            </View>
          </SettingsList.Group>
          <SettingsList.Divider />
          <SettingsList.Group iconInset={false}>
            <SettingsList.ItemText>
              <Trans>Content languages</Trans>
            </SettingsList.ItemText>
            <View style={[a.gap_md]}>
              <Text style={[a.leading_snug]}>
                <Trans>
                  Select which languages you want your subscribed feeds to
                  include. If none are selected, all languages will be shown.
                </Trans>
              </Text>

              {contentLanguages.length === 0 && (
                <Admonition type="info">
                  <Trans>All languages will be shown in your feeds.</Trans>
                </Admonition>
              )}

              <View style={[a.w_full, web({maxWidth: 400})]}>
                <Toggle.Group
                  label={l`Select content languages`}
                  values={contentLanguages}
                  onChange={setContentLanguages}>
                  <Toggle.PanelGroup>
                    {possibleLanguages.map((language, index) => {
                      const name = languageName(language, langPrefs.appLanguage)
                      return (
                        <Toggle.Item
                          key={language.code2}
                          name={language.code2}
                          label={name}>
                          {({selected}) => (
                            <Toggle.Panel
                              active={selected}
                              adjacent={index === 0 ? 'trailing' : 'both'}>
                              <Toggle.Checkbox />
                              <Toggle.PanelText>{name}</Toggle.PanelText>
                            </Toggle.Panel>
                          )}
                        </Toggle.Item>
                      )
                    })}
                    <Button
                      label={l`Add more languages…`}
                      onPress={contentLanguagePrefsControl.open}>
                      <Toggle.Panel
                        adjacent={
                          possibleLanguages.length === 0 ? undefined : 'leading'
                        }>
                        <Toggle.PanelIcon icon={PlusIcon} />
                        <Toggle.PanelText>
                          <Trans>Add more languages…</Trans>
                        </Toggle.PanelText>
                      </Toggle.Panel>
                    </Button>
                  </Toggle.PanelGroup>
                </Toggle.Group>
              </View>

              <LanguageSelectDialog
                control={contentLanguagePrefsControl}
                titleText={<Trans>Select content languages</Trans>}
                subtitleText={
                  <Trans>
                    If none are selected, all languages will be shown in your
                    feeds.
                  </Trans>
                }
                currentLanguages={contentLanguages}
                onSelectLanguages={languages => {
                  setContentLanguages(languages)
                  setRecentLanguages(recent => [
                    ...new Set([...recent, ...languages]),
                  ])
                }}
              />
            </View>
          </SettingsList.Group>
          <SettingsList.Divider />
          <SettingsList.Group iconInset={false}>
            <SettingsList.ItemText>
              <Trans>Translation language</Trans>
            </SettingsList.ItemText>
            <View style={[a.gap_md, a.w_full]}>
              <Text style={[a.leading_snug]}>
                <Trans>
                  Select your preferred language for translations in your feed.
                </Trans>
              </Text>
              <Select.Root
                value={langPrefs.primaryLanguage}
                onValueChange={onChangePrimaryLanguage}>
                <Select.Trigger label={l`Select translation language`}>
                  <Select.ValueText />
                  <Select.Icon />
                </Select.Trigger>
                <Select.Content
                  label={l`Translation language`}
                  renderItem={({label, value}) => (
                    <Select.Item value={value} label={label}>
                      <Select.ItemIndicator />
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  )}
                  items={DEDUPED_LANGUAGES.map(l => ({
                    label: languageName(l, langPrefs.appLanguage),
                    value: l.code2,
                  })).sort((a, b) =>
                    a.label.localeCompare(b.label, langPrefs.appLanguage),
                  )}
                />
              </Select.Root>
            </View>
          </SettingsList.Group>
          <SettingsList.Divider />
          <SettingsList.Group iconInset={false}>
            <SettingsList.ItemText>
              <Trans>Post translation provider</Trans>
            </SettingsList.ItemText>
            <View style={[a.gap_md, a.w_full]}>
              <Text style={[a.leading_snug]}>
                <Trans>
                  Select which service to use when translating posts.
                </Trans>
              </Text>
              <Select.Root
                value={translationServicePreference}
                onValueChange={value => {
                  setTranslationServicePreference(
                    value as typeof translationServicePreference,
                  )
                }}>
                <Select.Trigger label={l`Select post translation provider`}>
                  <Select.ValueText />
                  <Select.Icon />
                </Select.Trigger>
                <Select.Content
                  label={l`Post translation provider`}
                  renderItem={({label, value}) => (
                    <Select.Item value={value} label={label}>
                      <Select.ItemIndicator />
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  )}
                  items={[...translationProviderItems]}
                />
              </Select.Root>
              {translationServicePreference === 'libreTranslate' && (
                <View style={[a.w_full, a.align_start]}>
                  <InlineLinkText
                    label={l`Change instance`}
                    {...createStaticClick(() =>
                      libreTranslateInstanceControl.open(),
                    )}>
                    <Trans>Change instance</Trans>
                  </InlineLinkText>
                </View>
              )}
            </View>
          </SettingsList.Group>
        </SettingsList.Container>
        <LibreTranslateInstanceDialog control={libreTranslateInstanceControl} />
      </Layout.Content>
    </Layout.Screen>
  )
}
