import {useCallback, useEffect, useState} from 'react'
import {View} from 'react-native'
import Animated, {
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {
  useEnableSquareAvatars,
  useSetEnableSquareAvatars,
} from '#/state/preferences/enable-square-avatars'
import {
  useEnableSquareButtons,
  useSetEnableSquareButtons,
} from '#/state/preferences/enable-square-buttons'
import {
  useHideDisplayNames,
  useSetHideDisplayNames,
} from '#/state/preferences/hide-display-names'
import {useKawaiiMode, useSetKawaiiMode} from '#/state/preferences/kawaii'
import {
  useRepostCarouselEnabled,
  useSetRepostCarouselEnabled,
} from '#/state/preferences/repost-carousel-enabled'
import {useSession} from '#/state/session'
import {useSetThemePrefs, useThemePrefs} from '#/state/shell'
import {AppearanceToggleButtonGroup} from '#/screens/Settings/components/AppearanceToggleButtonGroup'
import {EmojiFontControl} from '#/screens/Settings/components/EmojiFontControl'
import {ShapeSlider} from '#/screens/Settings/components/ShapeSlider'
import {ItemTextWithSubtitle} from '#/screens/Settings/NotificationSettings/components/ItemTextWithSubtitle'
import {type Alf, atoms as a, native, useAlf, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {At_Stroke2_Corner0_Rounded as AtIcon} from '#/components/icons/At'
import {Repost_Stroke2_Corner3_Rounded as RepostIcon} from '#/components/icons/Repost'
import {Shapes_Stroke2_Corner0_Rounded as CornersIcon} from '#/components/icons/Shapes'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {TextSize_Stroke2_Corner0_Rounded as TextSize} from '#/components/icons/TextSize'
import {TitleCase_Stroke2_Corner0_Rounded as Aa} from '#/components/icons/TitleCase'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {IS_ANDROID} from '#/env'
import {useActiveThemeUpdate, useSaveTheme} from '#/features/themes/api'
import {
  type ActiveTheme,
  getColorSets,
  type ThemeView,
} from '#/features/themes/types'
import {ThemeQuickSelector} from './AppearanceSettings/ThemeQuickSelector'
import * as SettingsList from './components/SettingsList'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AppearanceSettings'>

export function AppearanceSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {fonts} = useAlf()
  const {currentAccount} = useSession()

  const {activeTheme} = useThemePrefs()
  const {setActiveTheme} = useSetThemePrefs()
  const availableUpdate = useActiveThemeUpdate(activeTheme)
  const saveTheme = useSaveTheme()
  const [preview, setPreview] = useState<{
    previous: ActiveTheme
    next: ActiveTheme
    theme: ThemeView
    seconds: number
  }>()

  const kawaiiMode = useKawaiiMode()
  const setKawaiiMode = useSetKawaiiMode()

  const enableSquareAvatars = useEnableSquareAvatars()
  const setEnableSquareAvatars = useSetEnableSquareAvatars()

  const repostCarouselEnabled = useRepostCarouselEnabled()
  const setRepostCarouselEnabled = useSetRepostCarouselEnabled()

  const enableSquareButtons = useEnableSquareButtons()
  const setEnableSquareButtons = useSetEnableSquareButtons()

  const hideDisplayNames = useHideDisplayNames()
  const setHideDisplayNames = useSetHideDisplayNames()

  useEffect(() => {
    if (!preview) return
    const interval = setInterval(() => {
      setPreview(current => {
        if (!current) return
        if (current.seconds <= 1) {
          setActiveTheme(current.previous)
          return undefined
        }
        return {...current, seconds: current.seconds - 1}
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [preview, setActiveTheme])

  const startUpdatePreview = useCallback(
    (mode: 'light' | 'dark', update: ThemeView) => {
      if (!activeTheme) return
      const next: ActiveTheme = {
        ...activeTheme,
        [mode]: {
          ...update,
          colorSet:
            getColorSets(update.record).find(
              set => set.name === activeTheme[mode].colorSet,
            )?.name ?? update.record.base.name,
        },
      }
      setActiveTheme(next)
      setPreview({previous: activeTheme, next, theme: update, seconds: 15})
    },
    [activeTheme, setActiveTheme],
  )

  const onChangeFontFamily = useCallback(
    (value: 'system' | 'theme' | 'material') => {
      fonts.setFontFamily(value)
    },
    [fonts],
  )

  const onChangeFontScale = useCallback(
    (value: Alf['fonts']['scale']) => {
      fonts.setFontScale(value)
    },
    [fonts],
  )

  return (
    <LayoutAnimationConfig skipExiting skipEntering>
      <Layout.Screen testID="preferencesThreadsScreen">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Appearance</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <Layout.Content>
          <SettingsList.Container>
            <ThemeQuickSelector />

            {availableUpdate && !preview && (
              <SettingsList.Item style={[a.gap_md]}>
                <View
                  style={[
                    a.rounded_full,
                    {width: 9, height: 9, backgroundColor: '#f04f46'},
                  ]}
                />
                <ItemTextWithSubtitle
                  titleText={
                    availableUpdate.mode === 'light' ? (
                      <Trans>Light theme update available</Trans>
                    ) : (
                      <Trans>Dark theme update available</Trans>
                    )
                  }
                  subtitleText={l`Preview the creator's latest colors before applying them.`}
                />
                <Button
                  label={l`Keep current theme colors`}
                  size="small"
                  color="secondary"
                  onPress={() => {
                    if (!activeTheme) return
                    const current = activeTheme[availableUpdate.mode]
                    const kept: ActiveTheme = {
                      ...activeTheme,
                      [availableUpdate.mode]: {
                        ...current,
                        cid: availableUpdate.theme.cid,
                      },
                    }
                    setActiveTheme(kept)
                    if (currentAccount) {
                      saveTheme.mutate({
                        ...availableUpdate.theme,
                        record: current.record,
                      })
                    }
                  }}>
                  <ButtonText>
                    <Trans>Keep old</Trans>
                  </ButtonText>
                </Button>
                <Button
                  label={l`Preview theme update`}
                  size="small"
                  color="primary"
                  onPress={() =>
                    startUpdatePreview(
                      availableUpdate.mode,
                      availableUpdate.theme,
                    )
                  }>
                  <ButtonText>
                    <Trans>Preview</Trans>
                  </ButtonText>
                </Button>
              </SettingsList.Item>
            )}

            <Animated.View layout={native(LinearTransition)}>
              <SettingsList.Divider />

              <AppearanceToggleButtonGroup
                title={l`Font`}
                description={l`For the best experience, we recommend using the theme font.`}
                icon={Aa}
                items={[
                  {
                    label: l`System`,
                    name: 'system',
                  },
                  {
                    label: l`Theme`,
                    name: 'theme',
                  },
                  ...(IS_ANDROID
                    ? [
                        {
                          label: l`Google Sans`,
                          name: 'material' as 'system' | 'theme' | 'material',
                        },
                      ]
                    : []),
                ]}
                value={fonts.family}
                onChange={onChangeFontFamily}
              />

              <AppearanceToggleButtonGroup
                title={l`Font size`}
                icon={TextSize}
                items={[
                  {
                    label: l`Smaller`,
                    name: '-1',
                  },
                  {
                    label: l`Default`,
                    name: '0',
                  },
                  {
                    label: l`Larger`,
                    name: '1',
                  },
                ]}
                value={fonts.scale}
                onChange={onChangeFontScale}
              />

              <EmojiFontControl />

              <SettingsList.Divider />

              <Toggle.Item
                name="hide_display_names"
                label={l`Hide display names`}
                value={hideDisplayNames}
                onChange={value => setHideDisplayNames(value)}>
                <SettingsList.Item>
                  <SettingsList.ItemIcon icon={AtIcon} />
                  <SettingsList.ItemText>
                    <Trans>Hide display names</Trans>
                  </SettingsList.ItemText>
                  <Toggle.Platform />
                </SettingsList.Item>
              </Toggle.Item>

              <Toggle.Item
                name="repost_carousel"
                label={l`Combine reposts into a horizontal carousel`}
                value={repostCarouselEnabled}
                onChange={value => setRepostCarouselEnabled(value)}>
                <SettingsList.Item>
                  <SettingsList.ItemIcon icon={RepostIcon} />
                  <SettingsList.ItemText>
                    <Trans>Combine reposts into a horizontal carousel</Trans>
                  </SettingsList.ItemText>
                  <Toggle.Platform />
                </SettingsList.Item>
              </Toggle.Item>

              <SettingsList.Divider />

              <Toggle.Item
                name="kawaii_mode"
                label={l`Enable kawaii logo`}
                value={kawaiiMode}
                onChange={value => setKawaiiMode(value)}>
                <SettingsList.Item>
                  <SettingsList.ItemIcon icon={SparkleIcon} />
                  <SettingsList.ItemText>
                    <Trans>Enable kawaii logo</Trans>
                  </SettingsList.ItemText>
                  <Toggle.Platform />
                </SettingsList.Item>
              </Toggle.Item>
              <SettingsList.Divider />

              <SettingsList.Item style={a.pb_2xs}>
                <SettingsList.ItemIcon icon={CornersIcon} />
                <Text
                  accessibilityRole="header"
                  style={[a.text_lg, a.font_bold]}>
                  <Trans>Corners</Trans>
                </Text>
              </SettingsList.Item>
              <SettingsList.Item style={[a.align_start, a.gap_lg]}>
                <ShapeSlider
                  label={l`Avatars`}
                  value={enableSquareAvatars}
                  onChange={setEnableSquareAvatars}
                  testID="avatarShapeSlider"
                />
                <ShapeSlider
                  label={l`Buttons`}
                  value={enableSquareButtons}
                  onChange={setEnableSquareButtons}
                  testID="buttonShapeSlider"
                />
              </SettingsList.Item>
            </Animated.View>
          </SettingsList.Container>
        </Layout.Content>
        {preview && (
          <View
            style={[
              a.absolute,
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.p_md,
              a.rounded_md,
              t.atoms.bg_contrast_50,
              t.atoms.border_contrast_low,
              a.border,
              {left: 12, right: 12, bottom: 12},
            ]}>
            <Text style={[a.flex_1, a.font_bold]}>
              <Trans>Testing update · {preview.seconds}s</Trans>
            </Text>
            <Button
              label={l`Revert theme update`}
              size="small"
              color="secondary"
              onPress={() => {
                setActiveTheme(preview.previous)
                setPreview(undefined)
              }}>
              <ButtonText>
                <Trans>Revert</Trans>
              </ButtonText>
            </Button>
            <Button
              label={l`Apply theme update`}
              size="small"
              color="primary"
              onPress={() => {
                saveTheme.mutate(preview.theme)
                setPreview(undefined)
              }}>
              <ButtonText>
                <Trans>Apply</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
      </Layout.Screen>
    </LayoutAnimationConfig>
  )
}
