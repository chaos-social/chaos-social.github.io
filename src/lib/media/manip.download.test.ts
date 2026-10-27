import {
  copyAsync,
  createDownloadResumable,
  deleteAsync,
} from 'expo-file-system/legacy'
import {createAlbumAsync, saveToLibraryAsync} from 'expo-media-library/legacy'

import {
  saveImageToMediaLibrary,
  saveVideoToMediaLibrary,
} from '#/lib/media/manip'
import * as env from '#/env'

jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/env', () => ({
  __esModule: true,
  IS_ANDROID: false,
  IS_IOS: true,
  IS_NATIVE: true,
}))
jest.mock('#/lib/media/original-image', () => ({
  getDownloadImageUri: (uri: string) => Promise.resolve(uri),
}))
jest.mock('expo-media-library/legacy', () => ({
  createAlbumAsync: jest.fn().mockResolvedValue(undefined),
  saveToLibraryAsync: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  copyAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  createDownloadResumable: jest.fn(),
}))

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

it.each(['content-type', 'Content-Type', 'CONTENT-TYPE'])(
  'saves Android AVIF downloads using the %s response header',
  async header => {
    jest.replaceProperty(env, 'IS_ANDROID', true)
    jest.mocked(createDownloadResumable).mockReturnValue({
      downloadAsync: () =>
        Promise.resolve({
          uri: 'file:///cache/download.bin',
          headers: {[header]: 'image/avif; charset=binary'},
        }),
    } as unknown as ReturnType<typeof createDownloadResumable>)

    await saveImageToMediaLibrary({
      uri: 'https://cdn.example/image',
      format: 'avif',
      downloadName: 'alice.example-3abc-1',
    })

    expect(createAlbumAsync).toHaveBeenCalledWith(
      'Witchsky',
      undefined,
      undefined,
      expect.stringMatching(/\/witchsky-alice\.example-3abc-1\.avif$/),
    )
  },
)

it('saves original images with a descriptive basename and their downloaded MIME extension', async () => {
  jest.mocked(createDownloadResumable).mockReturnValue({
    downloadAsync: () =>
      Promise.resolve({
        uri: 'file:///cache/download.bin',
        mimeType: 'image/png',
      }),
  } as unknown as ReturnType<typeof createDownloadResumable>)
  await saveImageToMediaLibrary({
    uri: 'https://pds.example/image',
    downloadName: 'alice.example-3abc-1',
  })
  expect(saveToLibraryAsync).toHaveBeenCalledWith(
    expect.stringMatching(/\/witchsky-alice\.example-3abc-1\.png$/),
  )
  const path = jest.mocked(saveToLibraryAsync).mock.calls[0][0]
  expect(deleteAsync).toHaveBeenCalledWith(
    path.slice(0, path.lastIndexOf('/')),
    {idempotent: true},
  )
})

it('uses distinct staging folders for repeated filenames and cleans up failed saves', async () => {
  jest.mocked(createDownloadResumable).mockReturnValue({
    downloadAsync: () =>
      Promise.resolve({
        uri: 'file:///cache/download.bin',
        headers: {'content-type': 'video/mp4'},
      }),
  } as unknown as ReturnType<typeof createDownloadResumable>)
  await saveVideoToMediaLibrary({
    uri: 'https://pds.example/video',
    downloadName: 'alice.example-3abc',
  })
  jest
    .mocked(saveToLibraryAsync)
    .mockRejectedValueOnce(new Error('save failed'))
  await expect(
    saveVideoToMediaLibrary({
      uri: 'https://pds.example/video',
      downloadName: 'alice.example-3abc',
    }),
  ).rejects.toThrow('save failed')
  const first = jest.mocked(saveToLibraryAsync).mock.calls[0][0]
  const second = jest.mocked(saveToLibraryAsync).mock.calls[1][0]
  expect(first).toMatch(/\/witchsky-alice\.example-3abc\.mp4$/)
  expect(second).toMatch(/\/witchsky-alice\.example-3abc\.mp4$/)
  expect(first).not.toBe(second)
  expect(deleteAsync).toHaveBeenCalledWith(
    second.slice(0, second.lastIndexOf('/')),
    {idempotent: true},
  )
  expect(copyAsync).toHaveBeenCalledTimes(2)
})

it('saves Android videos directly to the Witchsky album', async () => {
  jest.replaceProperty(env, 'IS_ANDROID', true)
  jest.mocked(createDownloadResumable).mockReturnValue({
    downloadAsync: () =>
      Promise.resolve({
        uri: 'file:///cache/download.bin',
        headers: {'content-type': 'video/mp4'},
      }),
  } as unknown as ReturnType<typeof createDownloadResumable>)

  await saveVideoToMediaLibrary({
    uri: 'https://pds.example/video',
    downloadName: 'alice.example-3abc',
  })

  expect(createAlbumAsync).toHaveBeenCalledWith(
    'Witchsky',
    undefined,
    undefined,
    expect.stringMatching(/\/witchsky-alice\.example-3abc\.mp4$/),
  )
  expect(saveToLibraryAsync).not.toHaveBeenCalled()
})

it('reports Android album failures without saving images to another folder', async () => {
  jest.replaceProperty(env, 'IS_ANDROID', true)
  jest.mocked(createDownloadResumable).mockReturnValue({
    downloadAsync: () =>
      Promise.resolve({
        uri: 'file:///cache/download.bin',
        headers: {'content-type': 'image/png'},
      }),
  } as unknown as ReturnType<typeof createDownloadResumable>)
  jest.mocked(createAlbumAsync).mockRejectedValueOnce(new Error('save failed'))

  await expect(
    saveImageToMediaLibrary({uri: 'https://pds.example/image'}),
  ).rejects.toThrow('save failed')

  expect(createAlbumAsync).toHaveBeenCalledTimes(1)
  expect(saveToLibraryAsync).not.toHaveBeenCalled()
  const path = jest.mocked(createAlbumAsync).mock.calls[0][3]!
  expect(deleteAsync).toHaveBeenCalledWith(
    path.slice(0, path.lastIndexOf('/')),
    {idempotent: true},
  )
})
