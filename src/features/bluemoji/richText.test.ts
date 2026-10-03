import {type Unknown$TypedObject} from '@atproto/lex'
import {RichText} from '@bsky/sdk/richtext'

import {item} from '#/features/bluemoji/__tests__/fixtures'
import {isOnlyEmojiRichText} from '#/features/bluemoji/richText'
import {
  createBluemojiFacet,
  detectBluemojiFacets,
} from '#/features/bluemoji/util'

jest.unmock('multiformats/cid')
jest.mock('#/alf', () => ({}))
jest.mock('#/platform/ui-text-view', () => ({
  UITextView:
    jest.requireActual<typeof import('react-native')>('react-native').Text,
}))

it.each([
  [':blobcat:', true],
  [':blobcat: :blobcat:', true],
  ['💙 :blobcat: 😘', true],
  ['test :blobcat: yay', false],
  [':blobcat: ordinary text', false],
  [':missing:', false],
  ['💙', true],
  ['hello 💙', false],
  ['  ', false],
])('detects emoji-only content in %s', async (text, expected) => {
  const rt = new RichText({text})
  await detectBluemojiFacets(rt, name =>
    Promise.resolve(name === item.record.name ? item : null),
  )
  expect(isOnlyEmojiRichText(rt)).toBe(expected)
})

it('retains the existing limit on enlarging long runs of emoji', async () => {
  const rt = new RichText({text: Array(8).fill(item.record.name).join(' ')})
  await detectBluemojiFacets(rt, () => Promise.resolve(item))
  expect(isOnlyEmojiRichText(rt)).toBe(false)
})

it('does not count unvalidated or linked aliases as emoji', () => {
  const rt = new RichText({text: item.record.name})
  const index = {byteStart: 0, byteEnd: item.record.name.length}
  rt.facets = [
    {
      index,
      features: [
        {$type: 'blue.moji.richtext.facet'} as unknown as Unknown$TypedObject,
      ],
    },
  ]
  expect(isOnlyEmojiRichText(rt)).toBe(false)
  rt.facets = [
    {
      index,
      features: [
        createBluemojiFacet(item) as unknown as Unknown$TypedObject,
        {$type: 'app.bsky.richtext.facet#link', uri: 'https://moji.blue'},
      ],
    },
  ]
  expect(isOnlyEmojiRichText(rt)).toBe(false)
})
