import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {fireEvent, render} from '@testing-library/react-native'

import {RichText} from '#/components/RichText'
import {item} from '#/features/bluemoji/__tests__/fixtures'
import {detectBluemojiFacets} from '#/features/bluemoji/util'

jest.unmock('multiformats/cid')
jest.mock('#/env', () => ({IS_NATIVE: true}))
jest.mock('#/alf', () => ({
  atoms: {text_sm: {fontSize: 14}},
  android: () => undefined,
  flatten:
    jest.requireActual<typeof import('react-native')>('react-native').StyleSheet
      .flatten,
  useAlf: () => ({fonts: {scaleMultiplier: 1.25}}),
}))
jest.mock('#/alf/util/dimensions', () => ({useNativeFontScale: () => 1.4}))
jest.mock('#/components/Link', () => ({InlineLinkText: () => null}))
jest.mock('#/components/ProfileHoverCard', () => ({
  ProfileHoverCard: () => null,
}))
jest.mock('#/components/RichTextTag', () => ({RichTextTag: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/features/bluemoji/InlineBluemoji', () => ({
  InlineBluemoji: ({
    size,
    baselineOffset,
  }: {
    size: number
    baselineOffset?: number
  }) =>
    jest
      .requireActual<typeof import('react')>('react')
      .createElement(
        jest.requireActual<typeof import('react-native')>('react-native').Text,
        {testID: 'emojiSize', accessibilityHint: String(baselineOffset)},
        String(size),
      ),
}))

it.each([
  ['hello 😁 :blobcat:', 28],
  ['😁 :blobcat:', 51.8],
])('scales custom emoji with native text in %s', async (text, expectedSize) => {
  const value = new RichTextAPI({text})
  await detectBluemojiFacets(value, () => Promise.resolve(item))
  const view = render(<RichText value={value} style={{fontSize: 16}} />)
  expect(Number(view.getByTestId('emojiSize').props.children)).toBeCloseTo(
    expectedSize,
  )
  const measurement = view.getByTestId('nativeEmojiMeasurement', {
    includeHiddenElements: true,
  })
  expect(measurement.props.style).toMatchObject({opacity: 0})
  fireEvent(measurement, 'textLayout', {
    nativeEvent: {
      lines: [{width: expectedSize * 1.2, descender: expectedSize * 0.25}],
    },
  })
  expect(Number(view.getByTestId('emojiSize').props.children)).toBeCloseTo(
    expectedSize * 1.2,
  )
  expect(
    Number(view.getByTestId('emojiSize').props.accessibilityHint),
  ).toBeCloseTo(expectedSize * 0.25)
})
