import {useCallback} from 'react'
import {Pressable, View} from 'react-native'
import Animated, {
  FadeInUp,
  FadeOutUp,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

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
import {useKawaiiMode, useSetKawaiiMode} from '#/state/preferences/kawaii'
import {useSetThemePrefs, useThemePrefs} from '#/state/shell'
import {SettingsListItem as AppIconSettingsListItem} from '#/screens/Settings/AppIconSettings/SettingsListItem'
import {type Alf, atoms as a, native, useAlf, useTheme} from '#/alf'
import {
  BLACKSKY_PALETTE,
  BLUESKY_PALETTE,
  CATPPUCIN_PALETTE,
  DEER_PALETTE,
  DEFAULT_PALETTE,
  EVERGARDEN_PALETTE,
  KITTY_PALETTE,
  MATERIAL_3_PALETTE,
  REDDWARF_PALETTE,
  ZEPPELIN_PALETTE,
} from '#/alf/themes'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {Slider} from '#/components/forms/Slider'
import * as Toggle from '#/components/forms/Toggle'
import {Circle_And_Square_Stroke1_Corner0_Rounded_Filled as SquareIcon} from '#/components/icons/CircleAndSquare'
import {ColorPalette_Stroke2_Corner0_Rounded as ColorPaletteIcon} from '#/components/icons/ColorPalette'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartIconFilled,
  Heart2_Stroke2_Corner0_Rounded as HeartIconOutline,
} from '#/components/icons/Heart2'
import {Moon_Stroke2_Corner0_Rounded as MoonIcon} from '#/components/icons/Moon'
import {Phone_Stroke2_Corner0_Rounded as PhoneIcon} from '#/components/icons/Phone'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {TextSize_Stroke2_Corner0_Rounded as TextSize} from '#/components/icons/TextSize'
import {TitleCase_Stroke2_Corner0_Rounded as Aa} from '#/components/icons/TitleCase'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {IS_ANDROID, IS_INTERNAL, IS_NATIVE} from '#/env'
import * as SettingsList from './components/SettingsList'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AppearanceSettings'>

type ColorSchemeName =
  | 'witchsky'
  | 'bluesky'
  | 'blacksky'
  | 'deer'
  | 'zeppelin'
  | 'kitty'
  | 'reddwarf'
  | 'catppuccin'
  | 'evergarden'
  | 'material3'

type ColorSchemeOption = {
  name: ColorSchemeName
  label: string
  primary: string
}

export function AppearanceSettingsScreen({}: Props) {
  const {_} = useLingui()
  const {fonts} = useAlf()
  const t = useTheme()

  const {colorMode, colorScheme, darkTheme, hue} = useThemePrefs()
  const {setColorMode, setColorScheme, setDarkTheme, setHue} =
    useSetThemePrefs()

  const kawaiiMode = useKawaiiMode()
  const setKawaiiMode = useSetKawaiiMode()

  const enableSquareAvatars = useEnableSquareAvatars()
  const setEnableSquareAvatars = useSetEnableSquareAvatars()

  const enableSquareButtons = useEnableSquareButtons()
  const setEnableSquareButtons = useSetEnableSquareButtons()

  const onChangeAppearance = useCallback(
    (value: 'light' | 'system' | 'dark') => {
      setColorMode(value)
    },
    [setColorMode],
  )

  const onChangeScheme = useCallback(
    (value: ColorSchemeName) => {
      setColorScheme(value)
    },
    [setColorScheme],
  )

  const onChangeDarkTheme = useCallback(
    (value: 'dim' | 'dark') => {
      setDarkTheme(value)
    },
    [setDarkTheme],
  )

  const onChangeFontFamily = useCallback(
    (value: 'system' | 'theme') => {
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

  const colorSchemes: ColorSchemeOption[] = [
    {
      name: 'witchsky',
      label: _(msg`Witchsky`),
      primary: DEFAULT_PALETTE.primary_500,
    },
    {
      name: 'bluesky',
      label: _(msg`Bluesky`),
      primary: BLUESKY_PALETTE.primary_500,
    },
    {
      name: 'blacksky',
      label: _(msg`Blacksky`),
      primary: BLACKSKY_PALETTE.primary_500,
    },
    {
      name: 'deer',
      label: _(msg`Deer`),
      primary: DEER_PALETTE.primary_500,
    },
    {
      name: 'zeppelin',
      label: _(msg`Zeppelin`),
      primary: ZEPPELIN_PALETTE.primary_500,
    },
    {
      name: 'kitty',
      label: _(msg`Kitty`),
      primary: KITTY_PALETTE.primary_500,
    },
    {
      name: 'reddwarf',
      label: _(msg`Red Dwarf`),
      primary: REDDWARF_PALETTE.primary_500,
    },
    {
      name: 'catppuccin',
      label: _(msg`Catppuccin`),
      primary: CATPPUCIN_PALETTE.primary_500,
    },
    {
      name: 'evergarden',
      label: _(msg`Evergarden`),
      primary: EVERGARDEN_PALETTE.primary_500,
    },
    ...(IS_ANDROID
      ? [
          {
            name: 'material3',
            label: _(msg`Material You`),
            primary: MATERIAL_3_PALETTE.primary_500,
          } satisfies ColorSchemeOption,
        ]
      : []),
  ]

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
            <AppearanceToggleButtonGroup
              title={_(msg`Color mode`)}
              icon={PhoneIcon}
              items={[
                {
                  label: _(msg`System`),
                  name: 'system',
                },
                {
                  label: _(msg`Light`),
                  name: 'light',
                },
                {
                  label: _(msg`Dark`),
                  name: 'dark',
                },
              ]}
              value={colorMode}
              onChange={onChangeAppearance}
            />

            {colorMode !== 'light' && (
              <Animated.View
                entering={native(FadeInUp)}
                exiting={native(FadeOutUp)}>
                <AppearanceToggleButtonGroup
                  title={_(msg`Dark theme`)}
                  icon={MoonIcon}
                  items={[
                    {
                      label: _(msg`Dim`),
                      name: 'dim',
                    },
                    {
                      label: _(msg`Dark`),
                      name: 'dark',
                    },
                  ]}
                  value={darkTheme ?? 'dim'}
                  onChange={onChangeDarkTheme}
                />
              </Animated.View>
            )}

            <SettingsList.Group>
              <SettingsList.ItemIcon icon={ColorPaletteIcon} />
              <SettingsList.ItemText>
                <Trans>Color Theme</Trans>
              </SettingsList.ItemText>
              <View style={[a.w_full, a.gap_md]}>
                <Text style={[a.flex_1, t.atoms.text_contrast_medium]}>
                  <Trans>Choose which color scheme to use:</Trans>
                </Text>
                <ColorSchemeGrid
                  schemes={colorSchemes}
                  selectedScheme={colorScheme}
                  onSchemeChange={onChangeScheme}
                />
                <Text style={[a.flex_1, t.atoms.text_contrast_medium]}>
                  <Trans>Hue shift the colors:</Trans>
                </Text>
                <Slider
                  value={hue}
                  onValueChange={setHue}
                  minimumValue={0}
                  maximumValue={360}
                  step={1}
                  debounceFull={true}
                />
              </View>
            </SettingsList.Group>

            <Animated.View layout={native(LinearTransition)}>
              <SettingsList.Divider />

              <AppearanceToggleButtonGroup
                title={_(msg`Font`)}
                description={_(
                  msg`For the best experience, we recommend using the theme font.`,
                )}
                icon={Aa}
                items={[
                  {
                    label: _(msg`System`),
                    name: 'system',
                  },
                  {
                    label: _(msg`Theme`),
                    name: 'theme',
                  },
                ]}
                value={fonts.family}
                onChange={onChangeFontFamily}
              />

              <AppearanceToggleButtonGroup
                title={_(msg`Font size`)}
                icon={TextSize}
                items={[
                  {
                    label: _(msg`Smaller`),
                    name: '-1',
                  },
                  {
                    label: _(msg`Default`),
                    name: '0',
                  },
                  {
                    label: _(msg`Larger`),
                    name: '1',
                  },
                ]}
                value={fonts.scale}
                onChange={onChangeFontScale}
              />

              <SettingsList.Divider />

              <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
                <SettingsList.ItemIcon icon={SparkleIcon} />
                <SettingsList.ItemText>
                  <Trans>Logo</Trans>
                </SettingsList.ItemText>
                <Toggle.Item
                  name="kawaii_mode"
                  label={_(msg`Enable kawaii logo`)}
                  value={kawaiiMode}
                  onChange={value => setKawaiiMode(value)}
                  style={[a.w_full]}>
                  <Toggle.LabelText style={[a.flex_1]}>
                    <Trans>Enable kawaii logo</Trans>
                  </Toggle.LabelText>
                  <Toggle.Platform />
                </Toggle.Item>
              </SettingsList.Group>

              <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
                <SettingsList.ItemIcon icon={SquareIcon} />
                <SettingsList.ItemText>
                  <Trans>Shapes</Trans>
                </SettingsList.ItemText>
                <Toggle.Item
                  name="enable_square_avatars"
                  label={_(msg`Enable square avatars`)}
                  value={enableSquareAvatars}
                  onChange={value => setEnableSquareAvatars(value)}
                  style={[a.w_full]}>
                  <Toggle.LabelText style={[a.flex_1]}>
                    <Trans>Enable square avatars</Trans>
                  </Toggle.LabelText>
                  <Toggle.Platform />
                </Toggle.Item>

                <Toggle.Item
                  name="enable_square_buttons"
                  label={_(msg`Enable square buttons`)}
                  value={enableSquareButtons}
                  onChange={value => setEnableSquareButtons(value)}
                  style={[a.w_full]}>
                  <Toggle.LabelText style={[a.flex_1]}>
                    <Trans>Enable square buttons</Trans>
                  </Toggle.LabelText>
                  <Toggle.Platform />
                </Toggle.Item>
              </SettingsList.Group>
              {IS_NATIVE && IS_INTERNAL && (
                <>
                  <SettingsList.Divider />
                  <AppIconSettingsListItem />
                </>
              )}
            </Animated.View>
          </SettingsList.Container>
        </Layout.Content>
      </Layout.Screen>
    </LayoutAnimationConfig>
  )
}

function ColorSchemeGrid({
  schemes,
  selectedScheme,
  onSchemeChange,
}: {
  schemes: ColorSchemeOption[]
  selectedScheme: ColorSchemeName
  onSchemeChange: (scheme: ColorSchemeName) => void
}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
      {schemes.map(({name, label, primary}) => {
        const isSelected = selectedScheme === name
        const HeartIcon = isSelected ? HeartIconFilled : HeartIconOutline
        return (
          <Pressable
            accessibilityRole="button"
            key={name}
            onPress={() => onSchemeChange(name)}
            style={[
              a.flex_1,
              a.rounded_md,
              a.overflow_hidden,
              {minWidth: '30%'},
              a.border,
              {
                borderColor: isSelected
                  ? primary
                  : t.atoms.border_contrast_low.borderColor,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}>
            <View
              style={[
                a.p_sm,
                a.gap_xs,
                {backgroundColor: t.atoms.bg.backgroundColor},
              ]}>
              <View
                style={[
                  a.w_full,
                  a.rounded_xs,
                  {backgroundColor: primary, height: 24},
                ]}
              />
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  a.justify_center,
                  a.gap_xs,
                ]}>
                <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>
                  {label}
                </Text>
                <HeartIcon size="xs" style={[{color: primary}]} />
              </View>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

export function AppearanceToggleButtonGroup<T extends string>({
  title,
  description,
  icon: Icon,
  items,
  value,
  onChange,
}: {
  title: string
  description?: string
  icon: React.ComponentType<SVGIconProps>
  items: {
    label: string
    name: T
  }[]
  value: T
  onChange: (value: T) => void
}) {
  const t = useTheme()
  return (
    <>
      <SettingsList.Group contentContainerStyle={[a.gap_sm]} iconInset={false}>
        <SettingsList.ItemIcon icon={Icon} />
        <SettingsList.ItemText>{title}</SettingsList.ItemText>
        {description && (
          <Text
            style={[
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_medium,
              a.w_full,
            ]}>
            {description}
          </Text>
        )}
        <SegmentedControl.Root
          type="radio"
          label={title}
          value={value}
          onChange={onChange}>
          {items.map(item => (
            <SegmentedControl.Item
              key={item.name}
              label={item.label}
              value={item.name}>
              <SegmentedControl.ItemText>
                {item.label}
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </SettingsList.Group>
    </>
  )
}
