import {resolveEmbedImageUris} from './embed-image-formats'
import {getDownloadImageUri, modifyImageFormat} from './util'

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

it('downloads original blobs without a CDN conversion', () => {
  const original = new URL(getDownloadImageUri(image, 'original'))
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
    {fullsize: image, thumb: image, aspectRatio: {width: 100, height: 100}},
    {thumbnailFormat: 'webp', fullsizeFormat: 'original', loadAsPngs: true},
  )
  expect(result.fullsize).toContain('/xrpc/com.atproto.sync.getBlob?')
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
