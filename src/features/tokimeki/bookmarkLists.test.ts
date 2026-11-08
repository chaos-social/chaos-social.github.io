import {tokimekiXrpc} from './bookmarkLists'

/** Default Infrastructure setting: the TOKIMEKI AppView host plus its service id. */
const TOKIMEKI_API = 'did:web:api.tokimeki.tech#tokimeki_api'

type Call = [string, RequestInit]

function clientWith(fetchHandler: jest.Mock) {
  return {agent: {did: 'did:plc:test', fetchHandler}} as never
}

function ok(
  body: unknown,
  status = 200,
  text = '',
  contentType: string | null = 'application/json; charset=utf-8',
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: () => contentType},
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  } as unknown as Response
}

function calls(fetchHandler: jest.Mock): Call[] {
  return fetchHandler.mock.calls as Call[]
}

describe('tokimekiXrpc', () => {
  it('builds a GET request with a query string', async () => {
    const fetchHandler = jest
      .fn()
      .mockResolvedValue(ok({bookmarks: [], cursor: 0}))
    const result = await tokimekiXrpc(
      clientWith(fetchHandler),
      'tech.tokimeki.bookmark.getFeed',
      {
        query: {
          owner: 'did:plc:test',
          id: 1,
          cursor: 0,
          limit: 20,
          skip: undefined,
        },
      },
    )

    expect(result).toEqual({bookmarks: [], cursor: 0})
    const [path, init] = calls(fetchHandler)[0]
    expect(path).toBe(
      '/xrpc/tech.tokimeki.bookmark.getFeed?owner=did%3Aplc%3Atest&id=1&cursor=0&limit=20',
    )
    const headers = init.headers as Record<string, string>
    expect(init.method).toBe('GET')
    expect(headers['atproto-proxy']).toBe(TOKIMEKI_API)
    expect(headers['content-type']).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('POSTs a JSON body', async () => {
    const fetchHandler = jest.fn().mockResolvedValue(ok({}))
    await tokimekiXrpc(
      clientWith(fetchHandler),
      'tech.tokimeki.bookmark.addBookmark',
      {body: {bookmark: {owner: 'did:plc:test', name: 'Recipes'}}},
    )

    const [path, init] = calls(fetchHandler)[0]
    const headers = init.headers as Record<string, string>
    expect(path).toBe('/xrpc/tech.tokimeki.bookmark.addBookmark')
    expect(init.method).toBe('POST')
    expect(headers['atproto-proxy']).toBe(TOKIMEKI_API)
    expect(headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      bookmark: {owner: 'did:plc:test', name: 'Recipes'},
    })
  })

  it('throws on a non-2xx response', async () => {
    const fetchHandler = jest.fn().mockResolvedValue(ok({}, 401))
    await expect(
      tokimekiXrpc(
        clientWith(fetchHandler),
        'tech.tokimeki.bookmark.getBookmarks',
      ),
    ).rejects.toThrow('tech.tokimeki.bookmark.getBookmarks failed: 401')
  })

  it('resolves to undefined for a 200 with no body, instead of throwing', async () => {
    const fetchHandler = jest
      .fn()
      .mockResolvedValue(ok(undefined, 200, '', null))
    await expect(
      tokimekiXrpc(
        clientWith(fetchHandler),
        'tech.tokimeki.bookmark.addBookmarkItem',
        {body: {bookmark: {}}},
      ),
    ).resolves.toBeUndefined()
  })

  it('includes the response body in the error, since some failures are plain text', async () => {
    const fetchHandler = jest
      .fn()
      .mockResolvedValue(ok(null, 400, 'Bad Request'))
    await expect(
      tokimekiXrpc(
        clientWith(fetchHandler),
        'tech.tokimeki.bookmark.addBookmarkItem',
        {body: {bookmark: {}}},
      ),
    ).rejects.toThrow(
      'tech.tokimeki.bookmark.addBookmarkItem failed: 400 Bad Request',
    )
  })
})
