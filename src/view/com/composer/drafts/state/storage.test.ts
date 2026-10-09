import {resolvePdsServiceUrl} from '#/state/queries/resolve-identity'
import {clearMediaCache, mediaExists, saveMediaToLocal} from './storage'

const mockDownload = jest.fn().mockResolvedValue(undefined)
const mockCopy = jest.fn()

jest.mock('expo-file-system', () => ({
  Paths: {document: 'file:///documents'},
  Directory: class {
    uri = 'file:///documents/bsky-draft-media'
    exists = true
    list() {
      return []
    }
  },
  File: class {
    uri: string
    constructor(parent: string | {uri: string}, filename?: string) {
      this.uri =
        typeof parent === 'string' ? parent : `${parent.uri}/${filename}`
    }
    copy(destination: unknown) {
      mockCopy(this.uri, destination)
    }
    static downloadFileAsync(...args: unknown[]) {
      return mockDownload(...args)
    }
  },
}))
jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest
    .fn()
    .mockResolvedValue('https://owner.pds.example'),
}))
jest.mock('#/view/com/composer/drafts/state/logger', () => ({
  logger: {debug: jest.fn(), error: jest.fn(), warn: jest.fn()},
}))

const cdn =
  'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:owner/bafyimage'
const original =
  'https://owner.pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aowner&cid=bafyimage'

beforeEach(() => {
  jest.clearAllMocks()
  clearMediaCache()
})

it.each([cdn, original])(
  'downloads native draft images from the owner PDS: %s',
  async uri => {
    await saveMediaToLocal('image:redraft', uri)
    await saveMediaToLocal('image:redraft', uri)

    expect(mockDownload).toHaveBeenCalledTimes(2)
    expect(mockDownload).toHaveBeenCalledWith(
      original,
      expect.objectContaining({
        uri: 'file:///documents/bsky-draft-media/image%3Aredraft',
      }),
      {idempotent: true},
    )
    expect(mockCopy).not.toHaveBeenCalled()
    expect(mediaExists('image:redraft')).toBe(true)
  },
)

it.each(['file:///images/photo.png', '/images/photo.png'])(
  'continues to copy local native media: %s',
  async uri => {
    await saveMediaToLocal('image:local', uri)

    expect(mockCopy).toHaveBeenCalledWith(
      'file:///images/photo.png',
      expect.anything(),
    )
    expect(mockDownload).not.toHaveBeenCalled()
    expect(resolvePdsServiceUrl).not.toHaveBeenCalled()
  },
)

it('does not fall back to a CDN or mark failed downloads as saved', async () => {
  mockDownload.mockRejectedValueOnce(new Error('download failed'))
  await expect(saveMediaToLocal('image:failed', cdn)).rejects.toThrow(
    'download failed',
  )
  expect(mockDownload).toHaveBeenCalledTimes(1)
  expect(mockDownload).toHaveBeenCalledWith(original, expect.anything(), {
    idempotent: true,
  })
  expect(mockCopy).not.toHaveBeenCalled()
  expect(mediaExists('image:failed')).toBe(false)
})
