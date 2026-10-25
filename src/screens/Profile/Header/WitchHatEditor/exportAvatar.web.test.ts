jest.unmock('multiformats/cid')

import {type Client} from '@atproto/lex'

import {createServiceClient} from '#/lib/lexClient'
import {exportAvatar} from '#/screens/Profile/Header/WitchHatEditor/exportAvatar.web'
import getBlob from '#/lexicons/com/atproto/sync/getBlob'

jest.mock('#/view/icons/Logo', () => ({
  LOGO_PATH: 'M0 0L512 512Z',
  LOGO_VIEW_BOX: '0 0 512 512',
}))

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const drawImage = jest.fn<void, [unknown, ...number[]]>()
const translate = jest.fn<void, [number, number]>()
const rotate = jest.fn<void, [number]>()
const save = jest.fn()
const restore = jest.fn()
const imageSources: string[] = []
const fetchMock = jest.fn()
const getBlobMock = jest.fn<
  Promise<Uint8Array<ArrayBuffer>>,
  [unknown, {did: string; cid: string}]
>()
const toBlob = jest.fn<void, [(blob: {size: number} | null) => void, string]>()
const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({drawImage, translate, rotate, save, restore}),
  toDataURL: jest.fn(() => 'data:image/png;base64,avatar'),
  toBlob,
}
const options = {
  previewRef: {current: null},
  avatar: 'https://cdn.bsky.app/img/avatar/plain/did:plc:test/blob@jpeg',
  placement: {x: 0.25, y: 0.38, size: 0.5, rotation: 30},
  color: '#123456',
  pdsClient: {call: getBlobMock} as unknown as Client,
}

beforeEach(() => {
  jest.clearAllMocks()
  imageSources.length = 0
  getBlobMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
  fetchMock.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob()),
  })
  toBlob.mockImplementation(callback => callback({size: 500_000}))
  URL.createObjectURL = jest.fn(() => 'blob:avatar')
  URL.revokeObjectURL = jest.fn()
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        if (tag === 'canvas') return canvas
        const image = {
          naturalWidth: 800,
          naturalHeight: 600,
          onload: () => {},
          set src(value: string) {
            imageSources.push(value)
            this.onload()
          },
        }
        return image
      },
    },
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'fetch', originalFetch!)
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

it('center-crops the photo, composites the colored SVG at the preview position, and exports PNG', async () => {
  const result = await exportAvatar(options)
  expect(getBlobMock).toHaveBeenCalledWith(getBlob, {
    did: 'did:plc:test',
    cid: 'blob',
  })
  expect(fetchMock).not.toHaveBeenCalled()
  expect(imageSources[0]).toBe('blob:avatar')
  expect(decodeURIComponent(imageSources[1])).toContain('fill="#123456"')
  expect(drawImage.mock.calls[0].slice(1)).toEqual([
    100, 0, 600, 600, 0, 0, 1000, 1000,
  ])
  expect(drawImage.mock.calls[1].slice(1)).toEqual([-250, -250, 500, 500])
  expect(result).toEqual({
    path: 'data:image/png;base64,avatar',
    width: 1000,
    height: 1000,
    mime: 'image/png',
  })
  expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
  expect(translate).toHaveBeenCalledWith(250, 380)
  expect(rotate).toHaveBeenCalledWith(Math.PI / 6)
  expect(save).toHaveBeenCalledTimes(1)
  expect(restore).toHaveBeenCalledTimes(1)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar')
})

it('reduces PNG dimensions to respect the avatar upload limit', async () => {
  toBlob.mockImplementationOnce(callback => callback({size: 1_100_000}))
  const result = await exportAvatar(options)
  expect(result.width).toBe(800)
  expect(result.height).toBe(800)
  expect(drawImage.mock.calls[3].slice(1)).toEqual([-200, -200, 400, 400])
})

it('routes the blob request to a self-hosted PDS using the real client', async () => {
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {'Content-Type': 'image/png'},
    }),
  )
  const pdsClient = createServiceClient('https://alice.pds.example')
  const avatar =
    'https://cdn.bsky.app/img/avatar/plain/did:plc:alice/bafkreieq5jui4j25lacwomsqgjeswwl3y5zcdrresptwgmfylxo2depppq@jpeg'
  const result = await exportAvatar({...options, avatar, pdsClient})
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const request: unknown = (fetchMock.mock.calls as unknown[][])[0][0]
  expect(String(request)).toBe(
    'https://alice.pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aalice&cid=bafkreieq5jui4j25lacwomsqgjeswwl3y5zcdrresptwgmfylxo2depppq',
  )
  expect(result.mime).toBe('image/png')
})

it.each([
  [
    'https://cdn.bsky.app/img/avatar/plain/did:web:alice.example/bafkreitest@jpeg',
    'did:web:alice.example',
  ],
  [
    'https://custom.appview.example/img/avatar/plain/did:plc:alice/bafkreitest@png',
    'did:plc:alice',
  ],
])(
  'downloads original CDN avatars through the account PDS client: %s',
  async (avatar, did) => {
    const result = await exportAvatar({...options, avatar})
    expect(getBlobMock).toHaveBeenCalledWith(getBlob, {did, cid: 'bafkreitest'})
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.mime).toBe('image/png')
  },
)

it.each([
  'blob:https://witchsky.app/avatar',
  'data:image/png;base64,avatar',
  'https://images.example/avatar.png',
])('preserves local and non-CDN avatar sources: %s', async avatar => {
  const result = await exportAvatar({...options, avatar})
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(avatar)
  expect(getBlobMock).not.toHaveBeenCalled()
  expect(result.mime).toBe('image/png')
})

it('surfaces download errors without creating a temporary URL', async () => {
  fetchMock.mockResolvedValue({ok: false, status: 403})
  await expect(
    exportAvatar({...options, avatar: 'https://images.example/avatar.png'}),
  ).rejects.toThrow('Image download failed: 403')
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

it('surfaces PDS blob failures without requesting the Bluesky entryway or CDN', async () => {
  getBlobMock.mockRejectedValue(new Error('BlobNotFound'))
  await expect(exportAvatar(options)).rejects.toThrow('BlobNotFound')
  expect(fetchMock).not.toHaveBeenCalled()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

it('releases the temporary URL when PNG encoding fails', async () => {
  toBlob.mockImplementation(callback => callback(null))
  await expect(exportAvatar(options)).rejects.toThrow('Could not export avatar')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar')
})
