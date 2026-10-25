import {deleteAsync} from 'expo-file-system/legacy'
import {type ImageManipulatorContext, SaveFormat} from 'expo-image-manipulator'
import {fromByteArray, toByteArray} from 'base64-js'

import {compressImage} from '#/lib/media/image/compress'
import {renderImage} from '#/lib/media/image-manipulator'
import {type ComposerImage} from '#/state/gallery'

jest.mock('#/lib/media/image-manipulator', () => ({renderImage: jest.fn()}))
jest.mock('#/lib/media/image/cache', () => ({
  moveIfNecessary: jest.fn((uri: string) => Promise.resolve(uri)),
}))

const opaquePng =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNIqej5D8IMMAYAUsQJnR9BTBcAAAAASUVORK5CYII='
const transparentPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNIqehpAGEGGAMAQ+IHobKi+cYAAAAASUVORK5CYII='
const image: ComposerImage = {
  alt: '',
  source: {
    id: 'source',
    path: 'source.jpg',
    width: 6000,
    height: 3000,
    mime: 'image/jpeg',
  },
}
const limits = {maxDimension: 4000, maxSize: 2000000}

/** Pad a valid fixture after IEND to simulate a larger encoder output. */
function pngWithSize(png: string, size: number) {
  const bytes = new Uint8Array(size)
  bytes.set(toByteArray(png))
  return fromByteArray(bytes)
}

function mockRenderer({
  png = opaquePng,
  jpegSize = (quality: number, _width: number) => quality * 2400000,
}: {
  png?: string
  jpegSize?: (quality: number, width: number) => number
} = {}) {
  jest
    .mocked(renderImage)
    .mockImplementation((_source, manipulate, options) => {
      let dimensions = {width: 0, height: 0}
      manipulate?.({
        resize: (value: typeof dimensions) => {
          dimensions = value
        },
      } as unknown as ImageManipulatorContext)
      const base64 =
        options?.format === SaveFormat.PNG
          ? png
          : 'a'.repeat(
              Math.ceil(
                jpegSize(options?.compress ?? 1, dimensions.width) / 3,
              ) * 4,
            )
      return Promise.resolve({
        uri: `file://image-${jest.mocked(renderImage).mock.calls.length}`,
        ...dimensions,
        base64,
      })
    })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRenderer()
})

it('compresses opaque PNGs as JPEG at the highest fitting quality before resizing', async () => {
  mockRenderer({png: pngWithSize(opaquePng, 2100000)})
  const result = await compressImage(
    {...image, source: {...image.source, mime: 'image/png'}},
    limits,
  )
  expect(result).toMatchObject({mime: 'image/jpeg', width: 4000, height: 2000})
  expect(result.size).toBeLessThanOrEqual(limits.maxSize)
  const qualities = jest
    .mocked(renderImage)
    .mock.calls.slice(1)
    .map(([, , options]) => options!.compress!)
  expect(qualities).toContain(0.83)
  expect(qualities).toContain(0.84)
  expect(result.size).toBe(1992000)
  expect(deleteAsync).not.toHaveBeenCalledWith(result.path, expect.anything())
  expect(jest.mocked(deleteAsync).mock.calls.length).toBe(qualities.length)
})

it('keeps opaque PNGs lossless when they fit', async () => {
  const result = await compressImage(
    {...image, source: {...image.source, mime: 'image/png'}},
    limits,
  )
  expect(result).toMatchObject({mime: 'image/png', width: 4000, height: 2000})
  expect(renderImage).toHaveBeenCalledTimes(1)
})

it('keeps a PNG exactly at the byte limit', async () => {
  const result = await compressImage(
    {...image, source: {...image.source, mime: 'image/png'}},
    {...limits, maxSize: 95},
  )
  expect(result).toMatchObject({mime: 'image/png', size: 95})
  expect(renderImage).toHaveBeenCalledTimes(1)
})

it('keeps transparency and avoids unnecessary PNG rendering when it fits', async () => {
  mockRenderer({png: transparentPng})
  expect(await compressImage(image, limits)).toMatchObject({
    mime: 'image/png',
    width: 4000,
    height: 2000,
  })
  expect(renderImage).toHaveBeenCalledTimes(1)
})

it('shrinks oversized PNGs without flattening their transparency', async () => {
  mockRenderer({png: transparentPng})
  const renderer = jest.mocked(renderImage).getMockImplementation()!
  jest.mocked(renderImage).mockImplementation(async (...args) => {
    const result = await renderer(...args)
    return {
      ...result,
      base64:
        result.width > 3200 ? pngWithSize(transparentPng, 400) : transparentPng,
    }
  })
  const result = await compressImage(image, {...limits, maxSize: 100})
  expect(result).toMatchObject({mime: 'image/png', width: 3200, height: 1600})
  expect(result.size).toBeLessThanOrEqual(100)
  expect(
    jest
      .mocked(renderImage)
      .mock.calls.every(([, , options]) => options?.format === SaveFormat.PNG),
  ).toBe(true)
})

it('reduces JPEG dimensions when the quality floor cannot meet the limit', async () => {
  mockRenderer({
    jpegSize: (_quality, width) => (width > 3200 ? 2100000 : 1000000),
  })
  expect(await compressImage(image, limits)).toMatchObject({
    mime: 'image/jpeg',
    width: 3200,
    height: 1600,
  })
  expect(
    jest
      .mocked(renderImage)
      .mock.calls.slice(1)
      .every(([, , options]) => options!.compress! >= 0.26),
  ).toBe(true)
})

it('uses the cropped source and never upscales small or very narrow images', async () => {
  mockRenderer({jpegSize: () => 100})
  const result = await compressImage(
    {
      ...image,
      transformed: {
        path: 'crop.png',
        width: 1,
        height: 10000,
        mime: 'image/png',
      },
    },
    limits,
  )
  expect(result).toMatchObject({width: 1, height: 4000})
  expect(
    jest.mocked(renderImage).mock.calls.every(([path]) => path === 'crop.png'),
  ).toBe(true)
  expect(
    await compressImage(
      {...image, source: {...image.source, width: 100, height: 50}},
      limits,
    ),
  ).toMatchObject({width: 100, height: 50})
})

it('cleans up intermediate files when a render fails', async () => {
  jest.mocked(renderImage).mockRejectedValueOnce(new Error('decode failed'))
  await expect(compressImage(image, limits)).rejects.toThrow('decode failed')
  mockRenderer()
  const renderer = jest.mocked(renderImage).getMockImplementation()!
  jest
    .mocked(renderImage)
    .mockImplementationOnce(renderer)
    .mockRejectedValueOnce(new Error('encode failed'))
  await expect(compressImage(image, limits)).rejects.toThrow('encode failed')
  expect(deleteAsync).toHaveBeenCalledWith(expect.stringMatching(/^file:/), {
    idempotent: true,
  })
})

it('rejects a failed base64 export and cleans up the output', async () => {
  jest
    .mocked(renderImage)
    .mockResolvedValueOnce({uri: 'file://failed', width: 4000, height: 2000})
  await expect(compressImage(image, limits)).rejects.toThrow(
    'Unable to compress image',
  )
  expect(deleteAsync).toHaveBeenCalledWith('file://failed', {idempotent: true})
})
