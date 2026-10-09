import {
  copyAsync,
  createDownloadResumable,
  deleteAsync,
} from 'expo-file-system/legacy'
import {saveToLibraryAsync} from 'expo-media-library/legacy'

import {
  saveImageToMediaLibrary,
  saveVideoToMediaLibrary,
} from '#/lib/media/manip'

jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/env', () => ({IS_ANDROID: false, IS_IOS: true, IS_NATIVE: true}))
jest.mock('#/lib/media/original-image', () => ({
  getDownloadImageUri: (uri: string) => Promise.resolve(uri),
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
