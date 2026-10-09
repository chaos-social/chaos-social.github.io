jest.mock('#/state/queries/resolve-identity', () => ({
  resolvePdsServiceUrl: jest
    .fn()
    .mockResolvedValue('https://owner.pds.example'),
}))

import {ImageManipulator} from 'expo-image-manipulator'

import {renderImage} from './image-manipulator'

jest.mock('#/env', () => ({IS_WEB: true}))
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {manipulate: jest.fn()},
}))

it('uses an origin-clean blob and releases it when cropping fails', async () => {
  const fetchBefore = global.fetch
  const createBefore = URL.createObjectURL
  const revokeBefore = URL.revokeObjectURL
  const release = jest.fn()
  const blob = new Blob(['image'], {type: 'image/png'})
  global.fetch = jest
    .fn()
    .mockResolvedValue({ok: true, blob: jest.fn().mockResolvedValue(blob)})
  URL.createObjectURL = jest.fn().mockReturnValue('blob:local-image')
  URL.revokeObjectURL = jest.fn()
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({
    renderAsync: jest.fn().mockRejectedValue(new Error('crop failed')),
    release,
  } as unknown as ReturnType<typeof ImageManipulator.manipulate>)
  try {
    await expect(
      renderImage(
        'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:test/bafkreitest',
      ),
    ).rejects.toThrow('crop failed')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://owner.pds.example/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Atest&cid=bafkreitest',
    )
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('blob:local-image')
    expect(release).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-image')
  } finally {
    global.fetch = fetchBefore
    URL.createObjectURL = createBefore
    URL.revokeObjectURL = revokeBefore
  }
})
