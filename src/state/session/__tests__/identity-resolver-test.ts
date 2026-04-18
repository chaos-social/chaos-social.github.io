import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockResolveHandle: jest.MockedFunction<
  (
    params: {handle: string},
    options?: {signal?: AbortSignal},
  ) => Promise<{
    data: {
      did: string
    }
  }>
> = jest.fn()
const mockDispose: jest.MockedFunction<() => void> = jest.fn()

jest.mock('../agent', () => ({
  createPublicAgent() {
    return {
      resolveHandle: mockResolveHandle,
      dispose: mockDispose,
    }
  },
}))

import {
  createIdentityResolver,
  getPdsServiceUrlFromIdentityInfo,
  resolveIdentityUsingAppView,
} from '../identity-resolver'

describe('appview identity resolver', () => {
  beforeEach(() => {
    mockResolveHandle.mockReset()
    mockDispose.mockReset()
    jest.restoreAllMocks()
  })

  it('resolves handles through the current appview and DID docs', async () => {
    const signal = new AbortController().signal
    mockResolveHandle.mockResolvedValueOnce({
      data: {
        did: 'did:plc:alice12345678901234567890',
      },
    })
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'did:plc:alice12345678901234567890',
          alsoKnownAs: ['at://xan.lol'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.alice.example',
            },
          ],
        }),
    } as Response)

    const identity = await resolveIdentityUsingAppView('xan.lol', signal)

    expect(mockResolveHandle).toHaveBeenCalledWith(
      {handle: 'xan.lol'},
      {signal},
    )
    expect(mockDispose).toHaveBeenCalled()
    expect(identity).toEqual({
      did: 'did:plc:alice12345678901234567890',
      handle: 'xan.lol',
      didDoc: {
        id: 'did:plc:alice12345678901234567890',
        alsoKnownAs: ['at://xan.lol'],
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.alice.example',
          },
        ],
      },
    })
  })

  it('falls back to client-side handle resolution when appview resolution fails', async () => {
    const signal = new AbortController().signal
    mockResolveHandle.mockRejectedValueOnce(new Error('appview down'))
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Answer: [
              {
                type: 16,
                data: '"did=did:plc:alice12345678901234567890"',
              },
            ],
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'did:plc:alice12345678901234567890',
            alsoKnownAs: ['at://xan.lol'],
            service: [
              {
                id: '#atproto_pds',
                type: 'AtprotoPersonalDataServer',
                serviceEndpoint: 'https://pds.alice.example',
              },
            ],
          }),
      } as Response)

    const identity = await resolveIdentityUsingAppView('xan.lol', signal)

    expect(mockResolveHandle).toHaveBeenCalledWith(
      {handle: 'xan.lol'},
      {signal},
    )
    expect(identity.did).toBe('did:plc:alice12345678901234567890')
    expect(identity.handle).toBe('xan.lol')
  })

  it('resolves did:web identities without requiring appview resolveIdentity', async () => {
    mockResolveHandle.mockResolvedValueOnce({
      data: {
        did: 'did:web:alice.example',
      },
    })
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'did:web:alice.example',
          alsoKnownAs: ['at://alice.example'],
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.alice.example',
            },
          ],
        }),
    } as Response)

    const resolver = createIdentityResolver()
    const identity = await resolver.resolve('did:web:alice.example')

    expect(mockResolveHandle).toHaveBeenCalledWith(
      {handle: 'alice.example'},
      {signal: undefined},
    )
    expect(identity).toEqual({
      did: 'did:web:alice.example',
      handle: 'alice.example',
      didDoc: {
        id: 'did:web:alice.example',
        alsoKnownAs: ['at://alice.example'],
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://pds.alice.example',
          },
        ],
      },
    })
  })

  it('extracts the pds service url from resolved identity info', () => {
    expect(
      getPdsServiceUrlFromIdentityInfo({
        didDoc: {
          service: [
            {
              id: '#bsky_appview',
              type: 'BskyAppView',
              serviceEndpoint: 'https://appview.example',
            },
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example',
            },
          ],
        },
      }),
    ).toBe('https://pds.example')
  })
})
