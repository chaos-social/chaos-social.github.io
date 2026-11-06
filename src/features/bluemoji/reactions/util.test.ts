import {
  getLicenseUrl,
  getReactionEmojiImage,
  getSafeSourceUrl,
} from '#/features/bluemoji/reactions/util'

const emoji = {
  $type: 'blue.moji.feed.reaction#emojiRef',
  uri: 'at://did:plc:owner/blue.moji.collection.item/blobcat',
  name: ':blobcat:',
  formats: {
    $type: 'blue.moji.collection.item#formats_v1',
    png_128: {ref: {$link: 'bafypng'}},
  },
} as unknown as Parameters<typeof getReactionEmojiImage>[0]

describe('reaction image URL', () => {
  it('derives the owner from the item URI', () => {
    expect(getReactionEmojiImage(emoji)).toBe(
      'https://moji.blue/img/did%3Aplc%3Aowner/bafypng',
    )
  })

  it('prefers animated renditions over the still', () => {
    expect(
      getReactionEmojiImage({
        ...emoji,
        formats: {
          $type: 'blue.moji.collection.item#formats_v1',
          png_128: {ref: {$link: 'bafypng'}},
          gif_128: {ref: {$link: 'bafygif'}},
        },
      } as unknown as typeof emoji),
    ).toContain('bafygif')
  })

  it('gives up on a ref that is not an item URI', () => {
    expect(
      getReactionEmojiImage({
        ...emoji,
        uri: 'not-a-uri',
      } as unknown as typeof emoji),
    ).toBeUndefined()
  })
})

describe('provenance', () => {
  it('only links http(s) sources without credentials', () => {
    expect(getSafeSourceUrl('https://example.com/art')).toBe(
      'https://example.com/art',
    )
    expect(getSafeSourceUrl('javascript:alert(1)')).toBeUndefined()
    expect(getSafeSourceUrl('data:text/html,hi')).toBeUndefined()
    expect(getSafeSourceUrl('https://user:pw@example.com')).toBeUndefined()
    expect(getSafeSourceUrl('  ')).toBeUndefined()
  })

  it('links well-formed SPDX ids but not refs or junk', () => {
    expect(getLicenseUrl('CC-BY-4.0')).toBe(
      'https://spdx.org/licenses/CC-BY-4.0.html',
    )
    expect(getLicenseUrl('LicenseRef-All-Rights-Reserved')).toBeUndefined()
    expect(getLicenseUrl('not a license')).toBeUndefined()
  })
})
