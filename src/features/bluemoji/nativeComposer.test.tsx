import {createRef, useState} from 'react'
import {StyleSheet, type TextStyle, type ViewProps} from 'react-native'
import {RichText} from '@bsky/sdk/richtext'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {act, fireEvent, render} from '@testing-library/react-native'

import {TextInput} from '#/view/com/composer/text-input/TextInput'
import {type TextInputRef} from '#/view/com/composer/text-input/TextInput.types'
import {item} from '#/features/bluemoji/__tests__/fixtures'
import {NATIVE_EMOJI_SLOT as slot} from '#/features/bluemoji/nativeEditor'

jest.mock('#/alf', () => ({
  atoms:
    jest.requireActual<typeof import('@bsky.app/alf')>('@bsky.app/alf').atoms,
  flatten:
    jest.requireActual<typeof import('react-native')>('react-native').StyleSheet
      .flatten,
  applyFonts: jest.fn(),
  utils: {alpha: (color: string) => color},
  useAlf: () => ({
    theme: {
      atoms: {
        text: {color: '#000'},
        text_link: {color: '#00f'},
        text_contrast_low: {color: '#777'},
      },
      palette: {primary_500: '#00f'},
    },
    fonts: {scaleMultiplier: 1, family: 'system'},
  }),
}))
jest.mock('#/lib/ThemeContext', () => ({
  useTheme: () => ({colorScheme: 'light'}),
}))
jest.mock('#/components/Composer/SyntaxText', () => ({
  SyntaxText: ({text}: {text: string}) =>
    jest
      .requireActual<typeof import('react')>('react')
      .createElement(
        jest.requireActual<typeof import('react-native')>('react-native').Text,
        null,
        text,
      ),
}))
jest.unmock('multiformats/cid')
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/features/bluemoji/useComposerItems', () => ({
  useComposerBluemojiItems: () =>
    new Map([
      [
        jest.requireActual<
          typeof import('#/features/bluemoji/__tests__/fixtures')
        >('#/features/bluemoji/__tests__/fixtures').item.record.name,
        jest.requireActual<
          typeof import('#/features/bluemoji/__tests__/fixtures')
        >('#/features/bluemoji/__tests__/fixtures').item,
      ],
    ]),
}))
jest.mock('#/features/bluemoji/NativeComposerLayout', () => ({
  NativeComposerLayout: ({
    emojiLayout,
    children,
    ...props
  }: {
    emojiLayout: string
    children?: React.ReactNode
  } & ViewProps) =>
    jest
      .requireActual<typeof import('react')>('react')
      .createElement(
        jest.requireActual<typeof import('react-native')>('react-native').View,
        {...props, testID: 'nativeEmojiLayout', accessibilityHint: emojiLayout},
        children,
      ),
}))
jest.mock('#/features/bluemoji/InlineBluemoji', () => ({
  InlineBluemoji: () =>
    jest
      .requireActual<typeof import('react')>('react')
      .createElement(
        jest.requireActual<typeof import('react-native')>('react-native').Text,
        {testID: 'emojiImage'},
        'image',
      ),
}))
jest.mock('#/view/com/composer/text-input/mobile/Autocomplete', () => ({
  Autocomplete: () => null,
}))
jest.mock('expo-paste-input', () => ({
  TextInputWrapper:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}))
jest.mock('#/lib/media/manip', () => ({downloadAndResize: jest.fn()}))

it('keeps one selected emoji while native input reports subsequent edits', () => {
  const ref = createRef<TextInputRef>()
  const changed = jest.fn()
  function Harness() {
    const [richtext, setRichText] = useState(new RichText({text: 'Hello '}))
    return (
      <TextInput
        accessibilityLabel="Text input field"
        accessibilityHint={undefined}
        ref={ref}
        richtext={richtext}
        setRichText={rt => {
          changed(rt.text)
          setRichText(rt)
        }}
        webForceMinHeight={false}
        hasRightPadding={false}
        isActive
        placeholder="Post"
        onPhotoPasted={jest.fn()}
        onPressPublish={jest.fn()}
        onNewLink={jest.fn()}
        onError={jest.fn()}
        onFocus={jest.fn()}
        canAddPost={false}
        canMovePostUp={false}
        canMovePostDown={false}
        onBackspaceEmpty={() => false}
        onAddPost={jest.fn()}
        onFocusPost={jest.fn()}
        onMovePost={jest.fn()}
      />
    )
  }
  const view = render(
    <I18nProvider i18n={setupI18n({locale: 'en', messages: {en: {}}})}>
      <Harness />
    </I18nProvider>,
  )
  fireEvent(view.getByTestId('composerTextInput'), 'selectionChange', {
    nativeEvent: {selection: {start: 6, end: 6}},
  })
  act(() => ref.current?.insertText(`${item.record.name} `))
  expect(view.getByTestId('composerTextInput').props.value).toBe(
    `Hello ${slot} `,
  )
  expect(
    view.getAllByTestId('emojiImage', {includeHiddenElements: true}),
  ).toHaveLength(1)
  expect(
    StyleSheet.flatten<TextStyle>(
      view.getByTestId('composerTextInput').props.style,
    )?.color,
  ).toBe('#000')

  fireEvent.changeText(view.getByTestId('composerTextInput'), `Hello ${slot} x`)
  expect(changed).toHaveBeenLastCalledWith('Hello :blobcat: x')
  expect(
    view.getAllByTestId('emojiImage', {includeHiddenElements: true}),
  ).toHaveLength(1)
  fireEvent(view.getByTestId('composerTextInput'), 'selectionChange', {
    nativeEvent: {selection: {start: 9, end: 9}},
  })
  fireEvent.changeText(view.getByTestId('composerTextInput'), `Hello ${slot} `)
  expect(changed).toHaveBeenLastCalledWith('Hello :blobcat: ')
  expect(
    view.getAllByTestId('emojiImage', {includeHiddenElements: true}),
  ).toHaveLength(1)
  const image = view.getByTestId('emojiImage', {includeHiddenElements: true})
  fireEvent(view.getByTestId('composerTextInput'), 'selectionChange', {
    nativeEvent: {selection: {start: 0, end: 0}},
  })
  fireEvent.changeText(view.getByTestId('composerTextInput'), `aHello ${slot} `)
  expect(changed).toHaveBeenLastCalledWith('aHello :blobcat: ')
  expect(view.getByTestId('emojiImage', {includeHiddenElements: true})).toBe(
    image,
  )
  expect(view.queryByTestId('composerEmojiMeasurement')).toBeNull()
  expect(
    view.getByTestId('nativeEmojiLayout', {includeHiddenElements: true}).props
      .accessibilityHint,
  ).toBe(
    JSON.stringify({
      text: `aHello ${slot} `,
      emojis: [{id: `composer-emoji-${item.uri}-0`, index: 7}],
    }),
  )
  const observer = view.getByTestId('nativeEmojiLayout', {
    includeHiddenElements: true,
  })
  expect(StyleSheet.flatten(observer.props.style)).toMatchObject({
    position: 'absolute',
    width: 0,
    height: 0,
  })
  expect(observer.props.children).toBeUndefined()
  expect(view.getByTestId('composerTextInputContainer').props.collapsable).toBe(
    false,
  )
  expect(view.getByTestId('composerTextInput').parent).not.toBe(observer)

  fireEvent(view.getByTestId('composerTextInput'), 'selectionChange', {
    nativeEvent: {selection: {start: 7, end: 7}},
  })
  fireEvent.changeText(
    view.getByTestId('composerTextInput'),
    `aHello \n${slot} `,
  )
  expect(changed).toHaveBeenLastCalledWith('aHello \n:blobcat: ')
  expect(view.getByTestId('composerTextInput').props.value).toBe(
    `aHello \n${slot} `,
  )
  expect(view.getByTestId('emojiImage', {includeHiddenElements: true})).toBe(
    image,
  )
  expect(
    view.getByTestId('nativeEmojiLayout', {includeHiddenElements: true}).props
      .accessibilityHint,
  ).toBe(
    JSON.stringify({
      text: `aHello \n${slot} `,
      emojis: [{id: `composer-emoji-${item.uri}-0`, index: 8}],
    }),
  )

  fireEvent(view.getByTestId('composerTextInput'), 'selectionChange', {
    nativeEvent: {selection: {start: 10, end: 10}},
  })
  act(() => ref.current?.insertText(`\nSecond ${item.record.name}`))
  expect(view.getByTestId('composerTextInput').props.value).toBe(
    `aHello \n${slot} \nSecond ${slot}`,
  )
  const images = view.getAllByTestId('emojiImage', {
    includeHiddenElements: true,
  })
  expect(images).toHaveLength(2)
  expect(images[0]).toBe(image)
  fireEvent(view.getByTestId('composerTextInput'), 'selectionChange', {
    nativeEvent: {selection: {start: 8, end: 8}},
  })
  fireEvent.changeText(
    view.getByTestId('composerTextInput'),
    `aHello ${slot} \nSecond ${slot}`,
  )
  expect(changed).toHaveBeenLastCalledWith(
    'aHello :blobcat: \nSecond :blobcat:',
  )
  expect(
    view.getByTestId('nativeEmojiLayout', {includeHiddenElements: true}).props
      .accessibilityHint,
  ).toBe(
    JSON.stringify({
      text: `aHello ${slot} \nSecond ${slot}`,
      emojis: [
        {id: `composer-emoji-${item.uri}-0`, index: 7},
        {id: `composer-emoji-${item.uri}-1`, index: 17},
      ],
    }),
  )
  expect(
    view.getAllByTestId('emojiImage', {includeHiddenElements: true}),
  ).toEqual(images)
})
