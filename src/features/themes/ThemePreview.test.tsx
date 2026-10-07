import {StyleSheet, View} from 'react-native'
import {render} from '@testing-library/react-native'

import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {ThemePreview} from '#/features/themes/ThemePreview'
import {ThemeVariantCard} from '#/features/themes/ThemeVariantCard'
import {type ThemeColorSet} from '#/features/themes/types'

jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: jest.fn(() => 'sharp'),
}))
jest.mock('#/alf', () => ({
  atoms: {rounded_md: {borderRadius: 8}, rounded_full: {borderRadius: 999}},
  useBreakpoints: () => ({gtMobile: true}),
  web: () => undefined,
}))
jest.mock('#/components/Typography', () => ({Text: 'Text'}))
jest.mock('#/components/icons/Check', () => ({
  Check_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/icons/Sparkle', () => ({
  Sparkle_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/icons/Heart2', () => ({
  Heart2_Filled_Stroke2_Corner0_Rounded: () => null,
}))

const colorSet: ThemeColorSet = {
  name: 'Test theme',
  colors: {
    canvas: '#ffffff',
    surface: '#eeeeee',
    surfaceRaised: '#dddddd',
    text: '#000000',
    textMuted: '#555555',
    border: '#999999',
    accent: '#ff0000',
    accentSoft: '#ffaaaa',
    onAccent: '#ffffff',
    positive: '#00ff00',
    warning: '#ffff00',
    critical: '#ff0000',
    favorite: '#ff00ff',
  },
}

it('removes rounding from theme cards, selection badges, and both preview layers', () => {
  const {UNSAFE_getAllByType} = render(
    <ThemePreview
      colorSet={colorSet}
      secondaryColorSet={{...colorSet, name: 'Dark'}}
      selected
    />,
  )
  const corners = UNSAFE_getAllByType(View).flatMap(view =>
    Object.entries(
      StyleSheet.flatten(
        (view.props as {style?: React.ComponentProps<typeof View>['style']})
          .style,
      ) ?? {},
    ).filter(([key, value]) => key.endsWith('Radius') && value !== undefined),
  )
  expect(corners.length).toBeGreaterThan(12)
  for (const [, radius] of corners) {
    expect(radius).toBe(0)
  }
})

it('removes rounding from gallery variant cards and their selection outlines', () => {
  const {UNSAFE_getAllByType} = render(
    <ThemeVariantCard colorSet={colorSet} selected onPress={() => {}} />,
  )
  for (const view of UNSAFE_getAllByType(View)) {
    const style = StyleSheet.flatten(
      (view.props as {style?: React.ComponentProps<typeof View>['style']})
        .style,
    )
    if (style?.borderRadius !== undefined) {
      expect(style.borderRadius).toBe(0)
    }
  }
})

it('preserves the theme preview rounding when sharp mode is disabled', () => {
  jest.mocked(useEnableSquareButtons).mockReturnValue(true)
  const {UNSAFE_getAllByType} = render(<ThemePreview colorSet={colorSet} />)
  expect(
    UNSAFE_getAllByType(View).some(
      view =>
        StyleSheet.flatten(
          (view.props as {style?: React.ComponentProps<typeof View>['style']})
            .style,
        )?.borderRadius === 8,
    ),
  ).toBe(true)
})
