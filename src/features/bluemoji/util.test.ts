import {type ModerationOpts} from '@bsky/sdk/moderation'
import {RichText} from '@bsky/sdk/richtext'

import {applyFacetSyntax} from '#/lib/strings/rich-text-manip'
import {imageCid, item} from '#/features/bluemoji/__tests__/fixtures'
import {
  createBluemojiFacet,
  detectBluemojiFacets,
  getBluemojiFacet,
  getBluemojiImage,
  getBluemojiInsertionName,
  getBluemojiModeration,
  getBluemojiRefUri,
} from '#/features/bluemoji/util'
import {app, blue} from '#/lexicons'

jest.unmock('multiformats/cid')

it('writes v1 facets accepted by Bluemoji and Bluesky post schemas', () => {
  const facet = createBluemojiFacet(item)
  expect(blue.moji.richtext.facet.$matches(facet)).toBe(true)
  expect(facet.formats).toEqual({
    $type: 'blue.moji.richtext.facet#formats_v1',
    webp_128: imageCid,
  })
  expect(
    app.bsky.feed.post.$matches({
      $type: 'app.bsky.feed.post',
      text: item.record.name,
      createdAt: new Date().toISOString(),
      facets: [
        {
          index: {byteStart: 0, byteEnd: item.record.name.length},
          features: [facet],
        },
      ],
    }),
  ).toBe(true)
})

it('uses distinct fallback aliases for collisions and reuses prior selections', () => {
  const refs = {
    [item.record.name]: {
      did: item.did,
      name: item.record.name,
      record: {uri: item.uri, cid: item.cid},
    },
  }
  expect(getBluemojiInsertionName(item, refs)).toBe(item.record.name)
  const other = {...item, uri: `${item.uri}-other`}
  expect(getBluemojiInsertionName(other, refs)).toBe(':blobcat-2:')
  expect(
    getBluemojiInsertionName(other, {
      ...refs,
      ':blobcat-2:': refs[item.record.name],
    }),
  ).toBe(':blobcat-3:')
})

it('keeps UTF-8 offsets correct after Unicode text and resolves repeated aliases once', async () => {
  const rt = new RichText({text: '💙 café :blobcat: :blobcat:'})
  const lookup = jest.fn(() => Promise.resolve(item))
  await detectBluemojiFacets(rt, lookup)
  expect(lookup).toHaveBeenCalledTimes(1)
  expect(
    rt.facets?.map(f =>
      rt.unicodeText.slice(f.index.byteStart, f.index.byteEnd),
    ),
  ).toEqual([':blobcat:', ':blobcat:'])
  expect(rt.facets?.[0].index.byteStart).toBe(11)
  expect([...rt.segments()].filter(segment => segment.facet)).toHaveLength(2)
})

it('does not resolve aliases inside links or replace existing facets', async () => {
  const rt = new RichText({text: 'https://example.com/:blobcat: :missing:'})
  rt.detectFacetsWithoutResolution()
  const original = rt.facets?.[0]
  const lookup = jest.fn(() => Promise.resolve(null))
  await detectBluemojiFacets(rt, lookup)
  expect(lookup).toHaveBeenCalledTimes(1)
  expect(lookup).toHaveBeenCalledWith(':missing:')
  expect(rt.facets).toEqual([original])
})

it('derives Unicode references and rejects non-collection strong references', () => {
  expect(getBluemojiRefUri({did: item.did, name: ':日本語:'})).toBe(
    `at://${item.did}/blue.moji.collection.item/xn--wgv71a119e`,
  )
  expect(
    getBluemojiRefUri({
      did: item.did,
      name: item.record.name,
      record: {uri: `at://${item.did}/app.bsky.feed.post/abc`, cid: item.cid},
    }),
  ).toBeUndefined()
  expect(
    getBluemojiRefUri({did: 'https://example.com', name: ':cat:'}),
  ).toBeUndefined()
})

it('uses source assets, supports v0 blobs, and falls back for unsupported formats', () => {
  expect(getBluemojiImage(item)).toContain(imageCid)
  const formats = blue.moji.collection.item.formats_v1.$ifMatches(
    item.record.formats,
  )
  expect(
    getBluemojiImage({
      ...item,
      record: {
        ...item.record,
        formats: {
          $type: 'blue.moji.collection.item#formats_v0',
          webp_128: formats?.webp_128,
        },
      },
    }),
  ).toContain(imageCid)
  expect(
    getBluemojiImage({
      ...item,
      record: {
        ...item.record,
        formats: {$type: 'blue.moji.collection.item#formats_v0'},
      },
    }),
  ).toBeUndefined()
})

const opts = {
  userDid: item.did,
  prefs: {
    adultContentEnabled: true,
    labels: {porn: 'ignore', 'graphic-media': 'warn'},
  },
} as unknown as ModerationOpts

it('enforces source adultOnly and label preferences', () => {
  const adultItem = {...item, record: {...item.record, adultOnly: true}}
  expect(getBluemojiModeration(adultItem)).toBe('hide')
  expect(getBluemojiModeration(adultItem, opts)).toBe('ignore')
  expect(
    getBluemojiModeration(adultItem, {
      ...opts,
      prefs: {...opts.prefs, adultContentEnabled: false},
    }),
  ).toBe('hide')
  const warned = {
    ...item,
    record: {
      ...item.record,
      labels: {
        $type: 'com.atproto.label.defs#selfLabels' as const,
        values: [{val: 'graphic-media'}],
      },
    },
  }
  expect(getBluemojiModeration(warned, opts)).toBe('warn')
  expect(
    getBluemojiModeration(warned, {
      ...opts,
      prefs: {...opts.prefs, labels: {'graphic-media': 'hide'}},
    }),
  ).toBe('hide')
})

it('verifies legacy alias facets through their source record reference', () => {
  const legacy = {...item, uri: item.uri.replace('/blobcat', '/legacy-key')}
  const facet = createBluemojiFacet(legacy)
  expect(blue.moji.richtext.facet.$matches(facet)).toBe(true)
  expect(getBluemojiFacet(facet)?.record).toEqual({
    uri: legacy.uri,
    cid: legacy.cid,
  })
  expect(getBluemojiRefUri(getBluemojiFacet(facet)!)).toBe(legacy.uri)
})

it('removes odd escape markers without creating emoji facets and shifts valid UTF-8 ranges', async () => {
  const rt = new RichText({text: '💙 \\:blobcat: \\\\:blobcat: :blobcat:'})
  const lookup = jest.fn(() => Promise.resolve(item))
  await detectBluemojiFacets(rt, lookup)
  expect(rt.facets).toHaveLength(2)
  applyFacetSyntax(rt, {removeSyntax: true})
  expect(rt.text).toBe('💙 :blobcat: \\:blobcat: :blobcat:')
  expect(
    rt.facets?.map(f =>
      rt.unicodeText.slice(f.index.byteStart, f.index.byteEnd),
    ),
  ).toEqual([':blobcat:', ':blobcat:'])
  expect(rt.facets?.[0].index.byteStart).toBe(16)
})

it.each(['\\<:blobcat:>', '\\[:blobcat:](https://example.com)', '\\:blobcat:'])(
  'does not resolve protected emoji syntax %s',
  async text => {
    const rt = new RichText({text})
    const lookup = jest.fn(() => Promise.resolve(item))
    await detectBluemojiFacets(rt, lookup)
    applyFacetSyntax(rt, {removeSyntax: true})
    expect(lookup).not.toHaveBeenCalled()
    expect(rt.facets).toEqual([])
    expect(rt.text).toBe(text.slice(1))
  },
)
