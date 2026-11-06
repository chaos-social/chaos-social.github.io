import {useMemo} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useSetThemePrefs, useThemePrefs} from '#/state/shell'
import {atoms as a, useTheme} from '#/alf'
import {generatePaletteFromColor} from '#/alf/util/material3'
import {useMaterialYouPalette} from '#/alf/util/materialYou'
import {useThemeName} from '#/alf/util/useColorModeTheme'
import {Button, ButtonText} from '#/components/Button'
import {Slider} from '#/components/forms/Slider'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {useApplyTheme} from '#/features/themes/api'
import {DEFAULT_ACTIVE_THEME} from '#/features/themes/catalog'
import {
  materialYouColorSets,
  materialYouRecord,
  materialYouSetForStyle,
  resolveMaterialYouRecord,
} from '#/features/themes/materialYou'
import {ThemeVariantCard} from '#/features/themes/ThemeVariantCard'
import * as SettingsList from '../components/SettingsList'
import {hexToHue, hueToHex, MATERIAL3_STYLE_OPTIONS} from './shared'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'AppearanceColorThemeSettings'
>

export function AppearanceColorThemeSettingsScreen({}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const themeName = useThemeName()
  const mode = themeName === 'light' ? 'light' : 'dark'
  const materialPalette = useMaterialYouPalette()
  const {activeTheme, material3Accent, material3Style} = useThemePrefs()
  const {setActiveTheme, setHue, setMaterial3Accent, setMaterial3Style} =
    useSetThemePrefs()
  const applyTheme = useApplyTheme()
  const sourceTheme = useMemo(
    () => ({
      uri: `at://did:plc:nstiflhvn4dywu5xlwq5wp4v/app.witchsky.theme.colors/${
        mode === 'light' ? '3mug7d56nl22i' : '3mug7d56zc22i'
      }`,
      cid:
        mode === 'light'
          ? 'bafyreia77cy66ecrxdbzv2koodsqgjntc2nuvxbh4jv3kc4sjj6ndu66ci'
          : 'bafyreifv7i3jtkobfaqwzb4buhaveyqly3s734eddashfwm2rjihyvhkxu',
      author: 'witchsky.app',
      record: materialYouRecord(mode, material3Accent),
      source: 'featured' as const,
    }),
    [material3Accent, mode],
  )
  const materialTheme = useMemo(
    () => ({
      ...sourceTheme,
      record: resolveMaterialYouRecord(
        sourceTheme.record,
        materialPalette,
        material3Accent,
        IS_WEB,
      ),
    }),
    [material3Accent, materialPalette, sourceTheme],
  )
  const isActive =
    (activeTheme ?? DEFAULT_ACTIVE_THEME)[mode].uri === materialTheme.uri
  const styleColorSets = useMemo(
    () =>
      MATERIAL3_STYLE_OPTIONS.map(({name, label}) => {
        const sets = materialYouColorSets(
          generatePaletteFromColor(material3Accent, name),
        )
        return {
          name,
          colorSet: {
            ...(themeName === 'light' ? sets.light : sets.dark),
            name: label,
          },
        }
      }),
    [material3Accent, themeName],
  )
  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Material You</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Button
          label={
            isActive ? _(msg`Material You is active`) : _(msg`Use Material You`)
          }
          size="small"
          color="primary"
          disabled={isActive}
          onPress={() =>
            applyTheme(
              materialTheme,
              materialYouSetForStyle(material3Style) ??
                materialTheme.record.base.name,
            )
          }>
          <ButtonText>
            <Trans>Use theme</Trans>
          </ButtonText>
        </Button>
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <View style={[a.gap_lg, a.px_lg, a.py_md]}>
            {IS_WEB ? (
              <>
                <Text style={[a.flex_1, t.atoms.text_contrast_medium]}>
                  <Trans>Accent color</Trans>
                </Text>
                <Slider
                  value={hexToHue(material3Accent)}
                  onValueChange={value => {
                    const accent = hueToHex(value)
                    setMaterial3Accent(accent)
                    setHue(0)
                    if (isActive && activeTheme) {
                      const record = resolveMaterialYouRecord(
                        sourceTheme.record,
                        materialPalette,
                        accent,
                        true,
                      )
                      setActiveTheme({
                        ...activeTheme,
                        [mode]: {
                          ...materialTheme,
                          record,
                          colorSet:
                            materialYouSetForStyle(material3Style) ??
                            record.base.name,
                        },
                      })
                    }
                  }}
                  minimumValue={0}
                  maximumValue={360}
                  step={1}
                  debounceFull={true}
                />

                <Text style={[a.text_xl, a.font_bold]}>
                  <Trans>Variants</Trans>
                </Text>
                <View style={[a.flex_row, a.flex_wrap, a.gap_lg]}>
                  {styleColorSets.map(({name, colorSet}) => (
                    <ThemeVariantCard
                      key={name}
                      colorSet={colorSet}
                      selected={material3Style === name}
                      onPress={() => {
                        setMaterial3Style(name)
                        if (isActive && activeTheme) {
                          setActiveTheme({
                            ...activeTheme,
                            [mode]: {
                              ...activeTheme[mode],
                              colorSet: colorSet.name,
                            },
                          })
                        }
                      }}
                    />
                  ))}
                </View>
              </>
            ) : (
              <Text style={[t.atoms.text_contrast_medium]}>
                <Trans>Material You uses your device's system colors.</Trans>
              </Text>
            )}
          </View>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}
