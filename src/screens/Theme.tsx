import {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {AtUri} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {useRichText} from '#/lib/hooks/useRichText'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {shareUrl} from '#/lib/sharing'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {useSetThemePrefs, useThemePrefs} from '#/state/shell'
import {atoms as a, platform, useTheme} from '#/alf'
import {useMaterialYouPalette} from '#/alf/util/materialYou'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Slider} from '#/components/forms/Slider'
import {ArrowOutOfBoxModified_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowOutOfBox'
import {
  Bookmark_Filled_Corner0_Rounded as BookmarkFilled,
  Bookmark_Stroke2_Corner0_Rounded as Bookmark,
} from '#/components/icons/Bookmark'
import {DotGrid3x1_Stroke2_Corner0_Rounded as EllipsisIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {
  useApplyTheme,
  useSaveTheme,
  useThemeLibrary,
  useThemeRecord,
  useUnsaveTheme,
} from '#/features/themes/api'
import {FEATURED_THEMES} from '#/features/themes/catalog'
import {resolveHueRecord} from '#/features/themes/hue'
import {
  materialYouStyleForSet,
  resolveMaterialYouRecord,
} from '#/features/themes/materialYou'
import {ThemePreview} from '#/features/themes/ThemePreview'
import {ThemeVariantCard} from '#/features/themes/ThemeVariantCard'
import {
  getColorSets,
  isHueTheme,
  isMaterialYouTheme,
  THEME_COLLECTION,
  themeAuthor,
  type ThemeView,
} from '#/features/themes/types'
import {themeShareUrl} from '#/features/themes/urls'
import {hexToHue, hueToHex} from './Settings/AppearanceSettings/shared'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Theme'>

export function ThemeScreen({route, navigation}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const {currentAccount} = useSession()
  const materialPalette = useMaterialYouPalette()
  const local = FEATURED_THEMES.find(
    item =>
      item.uri.endsWith(`/${route.params.rkey}`) &&
      (item.author === route.params.name ||
        new AtUri(item.uri).hostname === route.params.name),
  )
  const query = useThemeRecord(
    local ? undefined : route.params.name,
    local ? undefined : route.params.rkey,
  )
  const rawTheme: ThemeView | undefined = local ?? query.data
  const {activeTheme, material3Accent} = useThemePrefs()
  const {setActiveTheme, setHue, setMaterial3Accent, setMaterial3Style} =
    useSetThemePrefs()
  const rawActiveSelection = rawTheme
    ? activeTheme?.[rawTheme.record.mode]
    : undefined
  const isActiveTheme = rawActiveSelection?.uri === rawTheme?.uri
  const [selectedHue, setSelectedHue] = useState(0)
  useEffect(() => {
    setSelectedHue(isActiveTheme ? (rawActiveSelection?.hue ?? 0) : 0)
  }, [isActiveTheme, rawActiveSelection?.hue, rawTheme?.uri])
  const theme = useMemo<ThemeView | undefined>(() => {
    if (!rawTheme) return
    const materialRecord = resolveMaterialYouRecord(
      rawTheme.record,
      materialPalette,
      material3Accent,
      IS_WEB,
    )
    return {
      ...rawTheme,
      record: resolveHueRecord(materialRecord, selectedHue),
    }
  }, [material3Accent, materialPalette, rawTheme, selectedHue])
  const [descriptionRT] = useRichText(theme?.record.description ?? '')
  const creator = useProfileQuery({did: theme?.author})
  const library = useThemeLibrary()
  const applyTheme = useApplyTheme()
  const [selectedSet, setSelectedSet] = useState<string>()

  const activeSelection = rawActiveSelection
  const isMaterialYou = Boolean(theme && isMaterialYouTheme(theme.record))
  const isHue = Boolean(rawTheme && isHueTheme(rawTheme.record))
  const activeSetName = isActiveTheme ? activeSelection?.colorSet : undefined
  const colorSets = useMemo(
    () => (theme ? getColorSets(theme.record) : []),
    [theme],
  )

  useEffect(() => {
    setSelectedSet(
      current =>
        activeSetName ??
        (current && colorSets.some(set => set.name === current)
          ? current
          : colorSets[0]?.name),
    )
  }, [activeSetName, colorSets])

  const selected = colorSets.find(set => set.name === selectedSet)
  const isSelectedVariantActive =
    isActiveTheme && activeSetName === selected?.name
  const saved = library.data?.saved.find(item => item.uri === theme?.uri)
  let companion: AtUri | undefined
  try {
    companion = theme?.record.recommendedPair
      ? new AtUri(theme.record.recommendedPair)
      : undefined
    if (
      companion &&
      (!theme?.record.recommendedPair?.startsWith('at://') ||
        companion.collection !== THEME_COLLECTION ||
        !companion.rkey ||
        companion.search ||
        companion.hash ||
        companion.toString() === theme?.uri)
    ) {
      companion = undefined
    }
  } catch {}
  const localCompanion = FEATURED_THEMES.find(
    item => item.uri === companion?.toString(),
  )
  const companionQuery = useThemeRecord(
    localCompanion ? undefined : companion?.hostname,
    localCompanion ? undefined : companion?.rkey,
  )
  const companionTheme = localCompanion ?? companionQuery.data
  const validCompanion = Boolean(
    companionTheme &&
    companionTheme.uri !== theme?.uri &&
    companionTheme.record.mode !== theme?.record.mode,
  )
  const companionMode = theme?.record.mode === 'dark' ? 'light' : 'dark'
  const creatorHandle = creator.data?.handle ?? theme?.author
  const isOwn = Boolean(
    currentAccount && themeAuthor(rawTheme?.uri ?? '') === currentAccount.did,
  )

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {theme?.record.mode === 'dark' ? (
              <Trans>Dark theme</Trans>
            ) : theme?.record.mode === 'light' ? (
              <Trans>Light theme</Trans>
            ) : (
              <Trans>Theme</Trans>
            )}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {theme && rawTheme && selected ? (
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <Button
              label={_(msg`Use this theme`)}
              size="small"
              color="primary"
              disabled={isSelectedVariantActive}
              onPress={() => applyTheme(rawTheme, selected.name, selectedHue)}>
              <ButtonText>
                <Trans>Use theme</Trans>
              </ButtonText>
            </Button>
            <ThemePageMenu
              theme={rawTheme}
              savedRecordUri={saved?.savedRecordUri}
              isOwn={isOwn}
              rkey={route.params.rkey}
              shareName={route.params.name}
              remixColorSet={selected.name}
            />
          </View>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      <Layout.Content contentContainerStyle={[a.pb_5xl]}>
        {!theme && query.isLoading ? (
          <View
            style={[
              a.flex_1,
              a.align_center,
              a.justify_center,
              {minHeight: 360},
            ]}>
            <Loader size="xl" />
          </View>
        ) : !theme ? (
          <Text style={[a.p_lg]}>
            <Trans>This theme could not be loaded.</Trans>
          </Text>
        ) : (
          <View style={[a.px_xl, a.py_lg, a.gap_2xl]}>
            <View
              style={[
                a.flex_row,
                a.flex_wrap,
                a.align_start,
                a.gap_xl,
                a.p_lg,
                a.rounded_lg,
                t.atoms.bg_contrast_25,
              ]}>
              <View style={[a.flex_1, a.gap_md, {minWidth: 230}]}>
                <View style={[a.gap_xs]}>
                  <Text style={[a.text_3xl, a.font_bold]}>
                    {theme.record.name}
                  </Text>
                  <Text style={[t.atoms.text_contrast_medium]}>
                    <Trans>
                      by{' '}
                      <InlineLinkText
                        label={_(msg`View theme creator's profile`)}
                        to={{
                          screen: 'Profile',
                          params: {name: creatorHandle ?? theme.author},
                        }}
                        style={[t.atoms.text_contrast_medium, a.font_bold]}>
                        {sanitizeHandle(creatorHandle ?? theme.author, '@')}
                      </InlineLinkText>
                    </Trans>
                  </Text>
                </View>
                {theme.record.description && (
                  <RichText
                    testID="themeDescription"
                    style={[a.text_md]}
                    selectable={platform({android: false, default: true})}
                    value={descriptionRT}
                    enableTags
                    authorHandle={creatorHandle}
                  />
                )}
                {companion && validCompanion && (
                  <Button
                    label={_(msg`View companion ${companionMode} theme`)}
                    size="small"
                    color="secondary"
                    style={[a.self_start]}
                    onPress={() =>
                      navigation.navigate('Theme', {
                        name: companion.hostname,
                        rkey: companion.rkey,
                      })
                    }>
                    <ButtonText>
                      <Trans>View companion {companionMode} theme</Trans>
                    </ButtonText>
                  </Button>
                )}
              </View>
              {selected && (
                <ThemePreview
                  colorSet={selected}
                  label={theme.record.name}
                  hideLabel
                  style={{
                    width: 220,
                    flexBasis: 220,
                    flexGrow: 0,
                    flexShrink: 0,
                  }}
                />
              )}
            </View>

            <View style={[a.gap_md]}>
              {isHue && (
                <>
                  <Text style={[a.text_xl, a.font_bold]}>
                    <Trans>Hue</Trans>
                  </Text>
                  <Slider
                    value={selectedHue}
                    onValueChange={value => {
                      setSelectedHue(value)
                      if (isActiveTheme && activeTheme && rawTheme) {
                        setActiveTheme({
                          ...activeTheme,
                          [rawTheme.record.mode]: {
                            ...activeTheme[rawTheme.record.mode],
                            hue: value,
                          },
                        })
                      }
                    }}
                    minimumValue={-180}
                    maximumValue={180}
                    step={1}
                    debounceFull
                  />
                </>
              )}
              {isMaterialYou && IS_WEB && (
                <>
                  <Text style={[a.text_xl, a.font_bold]}>
                    <Trans>Accent color</Trans>
                  </Text>
                  <Slider
                    value={hexToHue(material3Accent)}
                    onValueChange={value => {
                      const accent = hueToHex(value)
                      setMaterial3Accent(accent)
                      setHue(0)
                      if (isActiveTheme && activeTheme && rawTheme) {
                        const nextTheme = {
                          ...theme,
                          record: resolveMaterialYouRecord(
                            rawTheme.record,
                            materialPalette,
                            accent,
                            true,
                          ),
                        }
                        setActiveTheme({
                          ...activeTheme,
                          [theme.record.mode]: {
                            ...nextTheme,
                            colorSet: selectedSet ?? nextTheme.record.base.name,
                          },
                        })
                      }
                    }}
                    minimumValue={0}
                    maximumValue={360}
                    step={1}
                    debounceFull
                  />
                </>
              )}
              {(!isMaterialYou || IS_WEB) && (
                <>
                  <Text style={[a.text_xl, a.font_bold]}>
                    {colorSets.length === 1 ? (
                      <Trans>Variant</Trans>
                    ) : (
                      <Trans>Variants</Trans>
                    )}
                  </Text>
                  <View style={[a.flex_row, a.flex_wrap, a.gap_lg]}>
                    {colorSets.map(set => (
                      <ThemeVariantCard
                        key={set.name}
                        colorSet={set}
                        selected={selectedSet === set.name}
                        onPress={() => {
                          setSelectedSet(set.name)
                          if (isMaterialYou) {
                            const style = materialYouStyleForSet(set.name)
                            if (style) setMaterial3Style(style)
                          }
                          if (isActiveTheme && activeTheme && rawTheme) {
                            setActiveTheme({
                              ...activeTheme,
                              [theme.record.mode]: {
                                ...rawTheme,
                                colorSet: set.name,
                                hue: isHue ? selectedHue : undefined,
                              },
                            })
                          }
                        }}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </Layout.Content>
    </Layout.Screen>
  )
}

function ThemePageMenu({
  theme,
  savedRecordUri,
  isOwn,
  rkey,
  shareName,
  remixColorSet,
}: {
  theme: ThemeView
  savedRecordUri?: string
  isOwn: boolean
  rkey: string
  shareName: string
  remixColorSet: string
}) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const saveTheme = useSaveTheme()
  const unsaveTheme = useUnsaveTheme()
  const navigation = useNavigation<NavigationProp>()

  return (
    <Menu.Root>
      <Menu.Trigger label={_(msg`Open theme actions`)}>
        {({props}) => (
          <Button
            {...props}
            label={_(msg`Open theme actions`)}
            size="small"
            variant="solid"
            color="secondary"
            shape="square">
            <ButtonIcon icon={EllipsisIcon} size="sm" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        {currentAccount && (
          <Menu.Item
            label={savedRecordUri ? _(msg`Unsave theme`) : _(msg`Save theme`)}
            onPress={() => {
              if (savedRecordUri) unsaveTheme.mutate(savedRecordUri)
              else saveTheme.mutate(theme)
            }}>
            <Menu.ItemText>
              {savedRecordUri ? <Trans>Unsave</Trans> : <Trans>Save</Trans>}
            </Menu.ItemText>
            <Menu.ItemIcon
              icon={savedRecordUri ? BookmarkFilled : Bookmark}
              position="right"
            />
          </Menu.Item>
        )}
        {currentAccount && (
          <Menu.Item
            label={_(msg`Remix theme`)}
            onPress={() =>
              navigation.navigate('ThemeEditor', {
                remix: {name: theme.author, rkey, colorSet: remixColorSet},
              })
            }>
            <Menu.ItemText>
              <Trans>Remix</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={PencilIcon} position="right" />
          </Menu.Item>
        )}
        {isOwn && (
          <Menu.Item
            testID="editThemeMenuItem"
            label={_(msg`Edit theme`)}
            onPress={() => navigation.navigate('ThemeEditor', {rkey})}>
            <Menu.ItemText>
              <Trans>Edit</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={PencilIcon} position="right" />
          </Menu.Item>
        )}
        <Menu.Item
          label={_(msg`Share theme`)}
          onPress={() => void shareUrl(themeShareUrl(shareName, rkey))}>
          <Menu.ItemText>
            <Trans>Share</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={ShareIcon} position="right" />
        </Menu.Item>
      </Menu.Outer>
    </Menu.Root>
  )
}
