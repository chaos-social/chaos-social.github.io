jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest
    .fn()
    .mockResolvedValue('https://owner.pds.example'),
}))

import {saveImageToMediaLibrary} from './manip.web'

const image =
  'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:example/bafyexample@jpeg'
const anchor = {
  href: '',
  download: '',
  target: '',
  rel: '',
  style: {display: ''},
  click: jest.fn(),
}
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')!
const fetchMock = jest.fn(() => Promise.reject(new TypeError('CORS blocked')))
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')

beforeEach(() => {
  fetchMock.mockClear()
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
  })
  anchor.click.mockClear()
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => anchor,
      body: {appendChild: jest.fn(), removeChild: jest.fn()},
    },
  })
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {href: 'https://witchsky.app/'},
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'fetch', originalFetch)
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  if (originalLocation)
    Object.defineProperty(window, 'location', originalLocation)
  else Reflect.deleteProperty(window, 'location')
})

it.each(['avif', 'gif'])(
  'downloads %s attachments without a CORS fetch',
  async format => {
    await saveImageToMediaLibrary({uri: image, format})
    expect(fetch).not.toHaveBeenCalled()
    expect(anchor.href).toBe(
      `https://cdn.bsky.app/img/download/plain/did:plc:example/bafyexample@${format}`,
    )
    expect(anchor.target).toBe('_blank')
    expect(anchor.rel).toBe('noopener noreferrer')
    expect(anchor.click).toHaveBeenCalledTimes(1)
  },
)

it('keeps original blobs on the fetch path and surfaces errors', async () => {
  await expect(
    saveImageToMediaLibrary({uri: image, format: 'original'}),
  ).rejects.toThrow('CORS blocked')
  expect(fetch).toHaveBeenCalledWith(
    'https://owner.pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aexample&cid=bafyexample',
  )
  expect(anchor.click).not.toHaveBeenCalled()
})
