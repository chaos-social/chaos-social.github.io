jest.unmock('multiformats/cid')

import {createElement} from 'react'
import {Image} from 'expo-image'
import {parseCid} from '@atproto/lex'
import {type DidString} from '@atproto/syntax'
import {fireEvent, render, renderHook} from '@testing-library/react-native'

import {uploadBlob} from '#/lib/api'
import {compressImage, createComposerImage} from '#/state/gallery'
import {useImageCdnHost} from '#/state/preferences/image-cdn-host'
import {usePdsClient} from '#/state/session'
import {type app} from '#/lexicons'
import {LinkFavicon} from './components/LinkFavicon'
import {linksFromRecords} from './record'
import {useUploadCustomLinkIcon, useWriteProfileLinks} from './state'
import {type ProfileLink} from './types'

jest.mock('#/lib/api', () => ({uploadBlob: jest.fn()}))
jest.mock('#/state/gallery', () => ({
  compressImage: jest.fn(),
  createComposerImage: jest.fn(),
}))
jest.mock('#/state/session', () => ({usePdsClient: jest.fn()}))
jest.mock('#/state/preferences/moderation-opts', () => ({}))
jest.mock('#/ageAssurance', () => ({}))
jest.mock('#/state/preferences/image-cdn-host', () => ({
  ...jest.requireActual('#/state/preferences/image-cdn-host'),
  useImageCdnHost: jest.fn(),
}))
jest.mock('#/components/Button', () => ({ButtonIcon: () => null}))
jest.mock('expo-image', () => ({
  Image:
    jest.requireActual<typeof import('react-native')>('react-native').Image,
}))

const did = 'did:plc:test' as DidString
const uri = `at://${did}/app.bsky.actor.link/test`
const icon = {
  $type: 'blob' as const,
  ref: parseCid('bafkreibq3lmclwphfiidatqr3jkvwrrxpcj3k27kb2zyx4gd4wngevqmta'),
  mimeType: 'image/png',
  size: 1024,
}

function mockPdsClient() {
  const put = jest
    .fn<
      Promise<{uri: string; cid: string}>,
      [unknown, app.bsky.actor.link.Main, unknown]
    >()
    .mockResolvedValue({uri, cid: 'updated'})
  const client = {put} as unknown as ReturnType<typeof usePdsClient>
  jest.mocked(usePdsClient).mockReturnValue(client)
  return {put, client}
}

beforeEach(() => jest.resetAllMocks())

it('compresses uploaded icons to PNG within the link record limits', async () => {
  const image = {
    path: 'file:///selected.webp',
    width: 2048,
    height: 1024,
    mime: 'image/webp',
    size: 200_000,
  }
  const composerImage = {alt: '', source: {...image, id: 'selected'}}
  jest.mocked(createComposerImage).mockResolvedValue(composerImage)
  jest.mocked(compressImage).mockResolvedValue({
    ...image,
    path: 'file:///small.png',
    mime: 'image/png',
    size: 1024,
  })
  jest.mocked(uploadBlob).mockResolvedValue({blob: icon})

  const {client} = mockPdsClient()
  const {result: hook} = renderHook(() => useUploadCustomLinkIcon())
  const result = await hook.current(image)

  expect(compressImage).toHaveBeenCalledWith(composerImage, {
    maxDimension: 128,
    maxSize: 100_000,
  })
  expect(uploadBlob).toHaveBeenCalledWith(
    client,
    'file:///small.png',
    'image/png',
  )
  expect(result).toEqual({icon, previewUrl: 'file:///small.png'})
})

it('stores uploaded images in the standard icon field and reloads them', async () => {
  const {put} = mockPdsClient()
  const {result} = renderHook(() => useWriteProfileLinks())
  const before: ProfileLink = {url: 'https://ko-fi.com/test', uri, cid: 'old'}
  const updated = {...before, icon}

  await result.current(did, [updated], [before])

  const record = put.mock.calls[0][1]
  expect(record.icon).toEqual(icon)
  expect(
    linksFromRecords(
      [{uri, cid: 'updated'}],
      [{uri, cid: 'updated', value: record}],
    )[0],
  ).toMatchObject({icon})
})

it('removes the stored image when restoring a bundled default icon', async () => {
  const {put} = mockPdsClient()
  const {result} = renderHook(() => useWriteProfileLinks())
  const before: ProfileLink = {
    url: 'https://ko-fi.com/test',
    uri,
    cid: 'old',
    icon,
  }

  await result.current(did, [{...before, icon: undefined}], [before])

  expect(put).toHaveBeenCalledTimes(1)
  expect(put.mock.calls[0][1].icon).toBeUndefined()
})

it('propagates upload failures so the editor can keep the previous icon', async () => {
  jest.mocked(uploadBlob).mockRejectedValue(new Error('upload failed'))
  const image = {
    path: 'file:///image.png',
    width: 128,
    height: 128,
    mime: 'image/png',
    size: 1024,
  }
  jest.mocked(createComposerImage).mockResolvedValue({
    alt: '',
    source: {...image, id: 'selected'},
  })
  jest.mocked(compressImage).mockResolvedValue(image)
  mockPdsClient()
  const {result} = renderHook(() => useUploadCustomLinkIcon())
  await expect(result.current(image)).rejects.toThrow('upload failed')
})

const cdnIconUrl = `https://cdn.bsky.app/img/avatar_thumbnail/plain/${did}/${icon.ref.toString()}@png`

it('keeps local profile link previews off the blob proxy', () => {
  const uri = 'file:///selected.png'
  jest.mocked(useImageCdnHost).mockReturnValue('https://images.example')
  const {UNSAFE_getByType} = render(
    createElement(LinkFavicon, {
      uri,
      size: 16,
      fallback: null,
    }),
  )
  expect(UNSAFE_getByType(Image).props.source).toEqual({uri})
})

it('retries a failed link icon when the configured blob proxy changes', () => {
  jest.mocked(useImageCdnHost).mockReturnValue('https://old.example')
  const element = () =>
    createElement(LinkFavicon, {
      uri: cdnIconUrl,
      size: 16,
      fallback: null,
    })
  const {UNSAFE_getByType, UNSAFE_queryByType, rerender} = render(element())
  fireEvent(UNSAFE_getByType(Image), 'error')
  expect(UNSAFE_queryByType(Image)).toBeNull()
  jest.mocked(useImageCdnHost).mockReturnValue('https://new.example')
  rerender(element())
  expect(UNSAFE_getByType(Image).props.source).toEqual({
    uri: cdnIconUrl.replace('https://cdn.bsky.app', 'https://new.example'),
  })
})
