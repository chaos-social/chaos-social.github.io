import {CID} from 'multiformats/cid'

jest.unmock('multiformats/cid')

import {getRecordImageMimeType} from '#/lib/media/recordImageMimeType'

const image =
  'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:alice/bafypng@jpeg'
const png = {cid: 'bafypng', mimeType: 'image/png'}
const gif = {cid: 'bafygif', mimeType: 'image/gif'}

it('matches source MIME types by CID even when the view images are reordered', () => {
  const record = {
    $type: 'app.bsky.feed.post',
    embed: {
      $type: 'app.bsky.embed.images',
      images: [{image: gif}, {image: png}],
    },
  }
  expect(getRecordImageMimeType(image, record)).toBe('image/png')
  expect(
    getRecordImageMimeType(image.replace('bafypng', 'bafygif'), record),
  ).toBe('image/gif')
  expect(
    getRecordImageMimeType(image.replace('bafypng', 'bafymissing'), record),
  ).toBeUndefined()
})

it('finds images in record-with-media galleries without confusing other items', () => {
  const record = {
    $type: 'app.bsky.feed.post',
    embed: {
      $type: 'app.bsky.embed.recordWithMedia',
      media: {
        $type: 'app.bsky.embed.gallery',
        items: [
          {$type: 'future.item', image: gif},
          {$type: 'app.bsky.embed.gallery#image', image: png},
        ],
      },
    },
  }
  expect(getRecordImageMimeType(image, record)).toBe('image/png')
  expect(
    getRecordImageMimeType(image.replace('bafypng', 'bafygif'), record),
  ).toBeUndefined()
})

it('uses an external card thumbnail blob MIME type', () => {
  const record = {
    $type: 'app.bsky.feed.post',
    embed: {$type: 'app.bsky.embed.external', external: {thumb: png}},
  }
  expect(getRecordImageMimeType(image, record)).toBe('image/png')
})

it('does not guess a source format from a view URL when the record is unavailable', () => {
  expect(getRecordImageMimeType(image, undefined)).toBeUndefined()
  expect(getRecordImageMimeType(image, {})).toBeUndefined()
})

it('matches modern blob refs decoded by the API client', () => {
  const cid = 'bafkreieq5jui4j25lacwomsqgjeswwl3y5zcdrresptwgmfylxo2depppq'
  const record = {
    $type: 'app.bsky.feed.post',
    embed: {
      $type: 'app.bsky.embed.images',
      images: [
        {
          image: {
            $type: 'blob',
            ref: CID.parse(cid),
            mimeType: 'image/webp',
            size: 100,
          },
        },
      ],
    },
  }
  expect(getRecordImageMimeType(image.replace('bafypng', cid), record)).toBe(
    'image/webp',
  )
})
