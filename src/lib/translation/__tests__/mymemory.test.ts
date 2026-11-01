import {type splitIntoChunks, type translateWithMyMemory} from '../mymemory'

jest.mock('#/logger', () => ({
  logger: {warn: () => {}},
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

let myMemory: {
  translateWithMyMemory: typeof translateWithMyMemory
  splitIntoChunks: typeof splitIntoChunks
}

function ok(body: unknown) {
  return {ok: true, status: 200, json: () => Promise.resolve(body)}
}

beforeEach(() => {
  jest.resetModules()
  mockFetch.mockReset()
  myMemory = require('../mymemory')
})

describe('splitIntoChunks', () => {
  it('keeps every chunk under the API limit', () => {
    const text = 'Ceci est une phrase. '.repeat(30)
    const chunks = myMemory.splitIntoChunks(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(480)
    }
    // Chunks rejoin with a newline, so only the boundary space changes.
    expect(chunks.join('').replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''))
  })

  it('leaves short text alone', () => {
    expect(myMemory.splitIntoChunks('hello')).toEqual(['hello'])
  })
})

describe('translateWithMyMemory', () => {
  it('sends the language pair and contact email', async () => {
    mockFetch.mockResolvedValue(
      ok({
        responseStatus: 200,
        quotaFinished: false,
        responseData: {translatedText: 'Hello world'},
      }),
    )

    const result = await myMemory.translateWithMyMemory({
      text: 'Bonjour le monde',
      targetLanguage: 'en',
      sourceLanguage: 'fr',
      email: 'you@example.com',
    })

    expect(result).toEqual({
      translatedText: 'Hello world',
      sourceLanguage: 'fr',
      targetLanguage: 'en',
    })
    const [requestUrl] = mockFetch.mock.calls[0] as [string]
    const url = new URL(requestUrl)
    expect(url.searchParams.get('q')).toBe('Bonjour le monde')
    expect(url.searchParams.get('langpair')).toBe('fr|en')
    expect(url.searchParams.get('de')).toBe('you@example.com')
  })

  it('joins a long post into one translation', async () => {
    mockFetch.mockResolvedValue(
      ok({
        responseStatus: 200,
        quotaFinished: false,
        responseData: {translatedText: 'A sentence.'},
      }),
    )

    const result = await myMemory.translateWithMyMemory({
      text: 'Ceci est une phrase. '.repeat(60),
      targetLanguage: 'en',
    })

    expect(mockFetch.mock.calls.length).toBeGreaterThan(1)
    expect(result.translatedText.split('\n').length).toBe(
      mockFetch.mock.calls.length,
    )
  })

  it('stops calling the API once the quota is finished', async () => {
    mockFetch.mockResolvedValue(ok({responseStatus: 200, quotaFinished: true}))

    await expect(
      myMemory.translateWithMyMemory({text: 'Bonjour', targetLanguage: 'en'}),
    ).rejects.toThrow(/quota/i)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await expect(
      myMemory.translateWithMyMemory({text: 'Salut', targetLanguage: 'en'}),
    ).rejects.toThrow(/quota/i)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('rejects when the API refuses the pair', async () => {
    mockFetch.mockResolvedValue(
      ok({
        responseStatus: 403,
        responseDetails: 'PLEASE SELECT TWO DISTINCT LANGUAGES',
        responseData: {},
      }),
    )

    await expect(
      myMemory.translateWithMyMemory({text: 'Hello', targetLanguage: 'en'}),
    ).rejects.toThrow(/DISTINCT/)
  })
})
