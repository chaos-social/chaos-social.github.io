import {useMemo} from 'react'
import {Pressable, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {getShapeStyle} from '#/lib/shapes'
import {type Schema} from '#/state/persisted'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {
  BLACKSKY_PALETTE,
  BLUESKY_PALETTE,
  CATPPUCIN_PALETTE,
  CYAN_PALETTE,
  DEER_PALETTE,
  DEFAULT_PALETTE,
  EVERGARDEN_PALETTE,
  KITTY_PALETTE,
  REDDWARF_PALETTE,
  ZEPPELIN_PALETTE,
} from '#/alf/themes'
import {getMaterial3Colors} from '#/alf/util/material3Theme'
import {useMaterialYouPalette} from '#/alf/util/materialYou'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartIconFilled,
  Heart2_Stroke2_Corner0_Rounded as HeartIconOutline,
} from '#/components/icons/Heart2'
import {Text} from '#/components/Typography'
import {MATERIAL_YOU_STYLES} from '#/features/themes/materialYou'

export type ColorSchemeName =
  | 'witchsky'
  | 'bluesky'
  | 'blacksky'
  | 'deer'
  | 'zeppelin'
  | 'kitty'
  | 'reddwarf'
  | 'catppuccin'
  | 'evergarden'
  | 'cyan base'
  | 'material3'

export type ColorSchemeOption = {
  name: ColorSchemeName
  label: string
  primary: string
}

export function useColorSchemes() {
  const {_} = useLingui()
  const material3Palette = useMaterialYouPalette()
  const cachedScheme = useMemo(
    () => getMaterial3Colors(material3Palette),
    [material3Palette],
  )

  return useMemo<ColorSchemeOption[]>(
    () => [
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
      {
        name: 'cyan base',
        label: _(msg`Cyan Base`),
        primary: CYAN_PALETTE.primary_500,
      },
      {
        name: 'material3',
        label: _(msg`Material You`),
        primary: cachedScheme.regular.primary_500,
      },
    ],
    [_, cachedScheme],
  )
}

export function getColorSchemeLabel(
  colorSchemes: ColorSchemeOption[],
  colorScheme: ColorSchemeName,
) {
  return (
    colorSchemes.find(scheme => scheme.name === colorScheme)?.label ??
    colorScheme
  )
}

export function ColorSchemeGrid({
  schemes,
  selectedScheme,
  onSchemeChange,
}: {
  schemes: ColorSchemeOption[]
  selectedScheme: ColorSchemeName
  onSchemeChange: (scheme: ColorSchemeName) => void
}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()

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
              getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_md),
              a.overflow_hidden,
              {minWidth: '30%'},
              a.border,
              {
                borderColor: isSelected
                  ? primary
                  : t.atoms.border_contrast_low.borderColor,
                borderWidth: 2,
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
                  getShapeStyle(
                    enableSquareButtons,
                    a.rounded_xs,
                    a.rounded_xs,
                  ),
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

export const MATERIAL3_STYLE_OPTIONS: {
  name: Schema['material3Style']
  label: string
}[] = MATERIAL_YOU_STYLES

export function hueToHex(hue: number): string {
  const h = hue / 60
  const x = 1 - Math.abs((h % 2) - 1)
  let r = 0,
    g = 0,
    b = 0
  if (h < 1) {
    r = 1
    g = x
  } else if (h < 2) {
    r = x
    g = 1
  } else if (h < 3) {
    g = 1
    b = x
  } else if (h < 4) {
    g = x
    b = 1
  } else if (h < 5) {
    r = x
    b = 1
  } else {
    r = 1
    b = x
  }

  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  if (d === 0) return 0

  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4

  h = Math.round(h * 60)
  return h < 0 ? h + 360 : h
}
