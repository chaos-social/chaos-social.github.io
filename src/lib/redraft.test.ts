import {
  type AppBskyEmbedGallery,
  type AppBskyEmbedImages,
  type AppBskyEmbedRecordWithMedia,
  type AppBskyFeedDefs,
  type AppBskyFeedPost,
  type BlobRef,
} from '@atproto/api'

import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {getRedraftImages} from './redraft'

jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest
    .fn()
    .mockResolvedValue('https://owner.pds.example'),
}))

const ownerDid = 'did:plc:owner'
const blobs = Array.from(
  {length: 5},
  (_, index) =>
    ({ref: {toString: () => `blob-${index}`}}) as unknown as BlobRef,
)

const recordGallery = {
  $type: 'app.bsky.embed.gallery',
  items: blobs.map((image, index) => ({
    $type: 'app.bsky.embed.gallery#image',
    image,
    alt: `alt ${index}`,
    aspectRatio: {width: index + 1, height: index + 2},
  })),
} as AppBskyEmbedGallery.Main

const viewGallery = {
  $type: 'app.bsky.embed.gallery#view',
  items: blobs.map((_, index) => ({
    $type: 'app.bsky.embed.gallery#viewImage',
    thumbnail: `https://cdn.example/${index}/thumb`,
    fullsize: `https://cdn.example/${index}/full`,
    alt: `alt ${index}`,
    aspectRatio: {width: index + 1, height: index + 2},
  })),
} as AppBskyEmbedGallery.View

describe('getRedraftImages', () => {
  it('restores galleries with more than four images from the owner PDS', async () => {
    const images = await getRedraftImages(
      recordGallery as AppBskyFeedPost.Record['embed'],
      viewGallery as AppBskyFeedDefs.PostView['embed'],
      ownerDid,
    )

    expect(images).toHaveLength(5)
    expect(images[4]).toEqual({
      uri: 'https://owner.pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aowner&cid=blob-4',
      width: 5,
      height: 6,
      altText: 'alt 4',
      blobRef: blobs[4],
    })
  })

  it('restores a gallery combined with a quote', async () => {
    const recordEmbed = {
      $type: 'app.bsky.embed.recordWithMedia',
      record: {
        $type: 'app.bsky.embed.record',
        record: {uri: 'at://did:plc:quoted/app.bsky.feed.post/1', cid: 'cid'},
      },
      media: recordGallery,
    } as AppBskyEmbedRecordWithMedia.Main
    const viewEmbed = {
      $type: 'app.bsky.embed.recordWithMedia#view',
      record: {$type: 'app.bsky.embed.record#view', record: {$type: 'unknown'}},
      media: viewGallery,
    } as unknown as AppBskyEmbedRecordWithMedia.View

    const images = await getRedraftImages(
      recordEmbed as AppBskyFeedPost.Record['embed'],
      viewEmbed as AppBskyFeedDefs.PostView['embed'],
      ownerDid,
    )
    expect(images).toHaveLength(5)
    expect(
      images.every(
        image => new URL(image.uri).origin === 'https://owner.pds.example',
      ),
    ).toBe(true)
  })

  it('uses the record blob and owner for ordinary images, never the CDN preview', async () => {
    const record = {
      $type: 'app.bsky.embed.images',
      images: [
        {
          image: blobs[0],
          alt: 'original',
          aspectRatio: {width: 960, height: 540},
        },
      ],
    } as AppBskyEmbedImages.Main
    const view = {
      $type: 'app.bsky.embed.images#view',
      images: [
        {
          fullsize: 'https://cdn.example/preview',
          thumb: 'https://cdn.example/thumb',
          alt: 'original',
          aspectRatio: {width: 960, height: 540},
        },
      ],
    } as AppBskyEmbedImages.View
    const images = await getRedraftImages(
      record as AppBskyFeedPost.Record['embed'],
      view as AppBskyFeedDefs.PostView['embed'],
      ownerDid,
    )

    expect(resolvePdsServiceUrl).toHaveBeenCalledWith(ownerDid)
    expect(images).toEqual([
      {
        uri: 'https://owner.pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aowner&cid=blob-0',
        width: 960,
        height: 540,
        altText: 'original',
        blobRef: blobs[0],
      },
    ])
  })

  it('fails instead of using CDN previews when the owner has no PDS', async () => {
    jest.mocked(resolvePdsServiceUrl).mockResolvedValueOnce(undefined)
    await expect(
      getRedraftImages(
        recordGallery as AppBskyFeedPost.Record['embed'],
        viewGallery as AppBskyFeedDefs.PostView['embed'],
        ownerDid,
      ),
    ).rejects.toThrow('Image owner has no PDS endpoint')
  })

  it('fails instead of using CDN previews when the original record blobs are missing', async () => {
    await expect(
      getRedraftImages(
        undefined,
        viewGallery as AppBskyFeedDefs.PostView['embed'],
        ownerDid,
      ),
    ).rejects.toThrow('Redraft image has no original blob')
  })

  it('does not resolve a PDS for posts without images', async () => {
    jest.mocked(resolvePdsServiceUrl).mockClear()
    await expect(
      getRedraftImages(undefined, undefined, ownerDid),
    ).resolves.toEqual([])
    expect(resolvePdsServiceUrl).not.toHaveBeenCalled()
  })
})
