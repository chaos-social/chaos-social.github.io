import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'

jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest
    .fn()
    .mockResolvedValue('https://owner.pds.example'),
}))

import {resolveEmbedImageUris} from './embed-image-formats'
import {getDownloadImageUri} from './original-image'
import {modifyImageFormat} from './util'

const image =
  'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:example/bafyexample@jpeg'

it('preserves app server image URLs when using the app server format', () => {
  for (const uri of [image, image.replace('@jpeg', ''), `${image}?v=1`]) {
    expect(modifyImageFormat(uri, 'default')).toBe(uri)
  }
})

it('preserves app server formats for small images despite the PNG preference', () => {
  const thumb = image.replace('/feed_fullsize/', '/feed_thumbnail/')
  const result = resolveEmbedImageUris(
    {fullsize: image, thumb, aspectRatio: {width: 100, height: 100}},
    {thumbnailFormat: 'default', fullsizeFormat: 'default', loadAsPngs: true},
  )
  expect(result).toEqual({fullsize: image, thumb})
})

it('downloads original blobs from their owner rather than the CDN or account host', async () => {
  const original = new URL(await getDownloadImageUri(image, 'original'))
  expect(original.origin).toBe('https://owner.pds.example')
  expect(resolvePdsServiceUrl).toHaveBeenCalledWith('did:plc:example')
  expect(original.pathname).toBe('/xrpc/com.atproto.sync.getBlob')
  expect(original.searchParams.get('did')).toBe('did:plc:example')
  expect(original.searchParams.get('cid')).toBe('bafyexample')
})

it('only converts image CDN paths, leaving external and local images intact', () => {
  for (const uri of [
    'blob:https://example.com/123',
    'data:image/png;base64,abc',
    'https://example.com/image.jpg',
  ]) {
    expect(modifyImageFormat(uri, 'png')).toBe(uri)
  }
  expect(modifyImageFormat(image, 'png')).toBe(image.replace('@jpeg', '@png'))
})

it('honors original fullsize even with the small PNG preference', () => {
  const result = resolveEmbedImageUris(
    {
      fullsize: image,
      thumb: image,
      mimeType: 'image/gif',
      aspectRatio: {width: 100, height: 100},
    },
    {
      thumbnailFormat: 'webp',
      fullsizeFormat: 'original',
      loadAsPngs: true,
    },
  )
  expect(result.fullsize).toBe(image.replace('@jpeg', '@gif'))
})

it('keeps thumbnails small even when full-size images use PNG', () => {
  const thumb = image.replace('/feed_fullsize/', '/feed_thumbnail/')
  const result = resolveEmbedImageUris(
    {fullsize: image, thumb, aspectRatio: {width: 100, height: 100}},
    {thumbnailFormat: 'webp', fullsizeFormat: 'webp', loadAsPngs: true},
  )
  expect(result.thumb).toBe(thumb.replace('@jpeg', '@webp'))
  expect(result.fullsize).toBe(image.replace('@jpeg', '@png'))
})

it('does not override an explicitly chosen full-size format with PNG', () => {
  const result = resolveEmbedImageUris(
    {fullsize: image, thumb: image, aspectRatio: {width: 100, height: 100}},
    {thumbnailFormat: 'webp', fullsizeFormat: 'ico', loadAsPngs: true},
  )
  expect(result.fullsize).toBe(image.replace('@jpeg', '@ico'))
})

it('reuses the feed thumbnail URL when no thumbnail format is selected', () => {
  const thumb = image.replace('/feed_fullsize/', '/feed_thumbnail/')
  const result = resolveEmbedImageUris(
    {fullsize: image, thumb},
    {fullsizeFormat: 'webp', loadAsPngs: true},
  )
  expect(result.thumb).toBe(thumb)
})

it('preserves the server image when the original MIME type is unavailable', () => {
  expect(modifyImageFormat(image, 'original')).toBe(image)
})

it('resolves encoded did:web owners on custom CDNs', async () => {
  const uri =
    'https://cdn.example/img/avatar/plain/did:web:alice.example%3Ausers%3Abob/bafyexample@png'
  const original = new URL(await getDownloadImageUri(uri, 'original'))
  expect(resolvePdsServiceUrl).toHaveBeenCalledWith(
    'did:web:alice.example:users:bob',
  )
  expect(original.origin).toBe('https://owner.pds.example')
  expect(original.searchParams.get('did')).toBe(
    'did:web:alice.example:users:bob',
  )
})

it('leaves local, external and already resolved original downloads intact', async () => {
  for (const uri of [
    'blob:https://example.com/123',
    'data:image/png;base64,abc',
    'https://example.com/image.jpg',
    'https://owner.pds.example/xrpc/com.atproto.sync.getBlob?did=did:plc:example&cid=bafyexample',
  ]) {
    jest.mocked(resolvePdsServiceUrl).mockClear()
    expect(await getDownloadImageUri(uri, 'original')).toBe(uri)
    expect(resolvePdsServiceUrl).not.toHaveBeenCalled()
  }
})

it('keeps converted downloads on the configured CDN without resolving a PDS', async () => {
  jest.mocked(resolvePdsServiceUrl).mockClear()
  const custom = image.replace('cdn.bsky.app', 'cdn.example')
  expect(await getDownloadImageUri(custom, 'png')).toBe(
    custom.replace('/feed_fullsize/', '/download/').replace('@jpeg', '@png'),
  )
  expect(resolvePdsServiceUrl).not.toHaveBeenCalled()
})

it('fails original downloads when no owner PDS is declared', async () => {
  jest.mocked(resolvePdsServiceUrl).mockResolvedValueOnce(undefined)
  await expect(getDownloadImageUri(image, 'original')).rejects.toThrow(
    'Image owner has no PDS endpoint',
  )
})

it.each([
  ['image/png', 'png'],
  ['image/jpeg', 'jpeg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['IMAGE/AVIF; charset=binary', 'avif'],
])(
  'uses the original %s format for both CDN sizes without resolving a PDS',
  (mimeType, format) => {
    jest.mocked(resolvePdsServiceUrl).mockClear()
    const thumb = image.replace('/feed_fullsize/', '/feed_thumbnail/')
    const result = resolveEmbedImageUris(
      {fullsize: image, thumb, mimeType},
      {
        thumbnailFormat: 'original',
        fullsizeFormat: 'original',
        loadAsPngs: true,
      },
    )
    expect(result.fullsize).toBe(image.replace('@jpeg', `@${format}`))
    expect(result.thumb).toBe(thumb.replace('@jpeg', `@${format}`))
    expect(resolvePdsServiceUrl).not.toHaveBeenCalled()
  },
)

it('appends the original suffix on a custom CDN and preserves URL parameters', () => {
  const uri =
    image.replace('cdn.bsky.app', 'cdn.example').replace('@jpeg', '') + '?v=1'
  expect(modifyImageFormat(uri, 'original', 'image/png')).toBe(
    uri.replace('?v=1', '@png?v=1'),
  )
})
