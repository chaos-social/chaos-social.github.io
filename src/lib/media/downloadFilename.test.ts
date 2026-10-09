import {
  getMediaDownloadFilename,
  getPostMediaDownloadName,
} from '#/lib/media/downloadFilename'

const post = {
  uri: 'at://did:plc:alice/app.bsky.feed.post/3abc',
  author: {handle: 'alice.example'},
}

it('names post media and numbers each image in a gallery', () => {
  expect(getPostMediaDownloadName(post)).toBe('alice.example-3abc')
  expect(getPostMediaDownloadName(post, 0)).toBe('alice.example-3abc-1')
  expect(getPostMediaDownloadName(post, 1)).toBe('alice.example-3abc-2')
})

it('does not invent post context for other media', () => {
  expect(getPostMediaDownloadName(undefined)).toBeUndefined()
  expect(
    getPostMediaDownloadName({...post, uri: 'not an at uri'}),
  ).toBeUndefined()
})

it('keeps the actual file extension and removes unsafe filename characters', () => {
  expect(
    getMediaDownloadFilename({
      downloadName: '../alice:example-3abc/1',
      uri: '',
      extension: 'png',
      kind: 'image',
    }),
  ).toBe('witchsky-_alice_example-3abc_1.png')
  expect(
    getMediaDownloadFilename({
      downloadName: getPostMediaDownloadName(post),
      uri: '',
      extension: 'mp4',
      kind: 'video',
    }),
  ).toBe('witchsky-alice.example-3abc.mp4')
})

it.each([
  [
    'image',
    'https://cdn.example/img/feed_fullsize/plain/did:plc:alice/bafyimage@jpeg',
    'png',
    'witchsky-image-bafyimage.png',
  ],
  [
    'video',
    'https://pds.example/xrpc/com.atproto.sync.getBlob?did=did:plc:alice&cid=bafyvideo',
    'mp4',
    'witchsky-video-bafyvideo.mp4',
  ],
] as const)(
  'uses a blob identity when %s post metadata is unavailable',
  (kind, uri, extension, expected) => {
    expect(getMediaDownloadFilename({uri, kind, extension})).toBe(expected)
  },
)
