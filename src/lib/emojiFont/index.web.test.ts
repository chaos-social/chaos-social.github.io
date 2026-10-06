jest.mock(
  '../../../assets/fonts/noto-color-emoji/WitchskyNotoColorEmoji.woff2',
  () => '/noto.woff2',
)
jest.mock(
  '../../../assets/fonts/twemoji/WitchskyTwemoji.woff2',
  () => '/twemoji.woff2',
)

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalFontFace = Object.getOwnPropertyDescriptor(globalThis, 'FontFace')
const registered = new Set<FontFace>()
const properties = new Map<string, string>()
const created: TestFontFace[] = []
let failLoading = false
let fonts: typeof import('./index')

class TestFontFace {
  constructor(
    public family: string,
    public source: string,
  ) {
    created.push(this)
  }

  load() {
    return failLoading
      ? Promise.reject(new Error('Font download failed'))
      : Promise.resolve(this)
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'FontFace', {
    configurable: true,
    value: TestFontFace,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      fonts: registered,
      documentElement: {
        style: {
          setProperty: (key: string, value: string) =>
            properties.set(key, value),
          removeProperty: (key: string) => properties.delete(key),
        },
      },
    },
  })
})

beforeEach(async () => {
  jest.resetModules()
  registered.clear()
  properties.clear()
  created.length = 0
  failLoading = false
  fonts = await import('./index')
})

afterAll(() => {
  if (originalDocument) {
    Object.defineProperty(globalThis, 'document', originalDocument)
  } else {
    Reflect.deleteProperty(globalThis, 'document')
  }
  if (originalFontFace) {
    Object.defineProperty(globalThis, 'FontFace', originalFontFace)
  } else {
    Reflect.deleteProperty(globalThis, 'FontFace')
  }
})

it('does not request fonts at startup or when using system emoji', () => {
  fonts.setEmojiFont('system')
  expect(created).toHaveLength(0)
  expect(properties.size).toBe(0)
  expect(registered.size).toBe(0)
})

it.each([
  ['noto', '/noto.woff2', 'WitchskyNotoColorEmoji'],
  ['twemoji', '/twemoji.woff2', 'WitchskyTwemoji'],
] as const)(
  'loads only %s on demand and reuses its download',
  async (name, url, family) => {
    fonts.setEmojiFont(name)
    expect(created).toHaveLength(0)
    expect(properties.size).toBe(0)

    const loading = fonts.loadEmojiFont(name)
    expect(fonts.loadEmojiFont(name)).toBe(loading)
    expect(created.map(face => face.source)).toEqual([
      `url("${url}")`,
      `url("${url}")`,
    ])
    await loading
    fonts.setEmojiFont(name)
    expect(properties.get('--emoji-font')).toBe(family)
    expect([...registered].map(face => face.family)).toEqual([
      family,
      'EmojiMart',
    ])

    fonts.setEmojiFont('system')
    expect(properties.size).toBe(0)
    expect([...registered].map(face => face.family)).toEqual([family])
    await fonts.loadEmojiFont(name)
    expect(created).toHaveLength(2)
  },
)

it('replaces the picker font when switching and restores system emoji', async () => {
  await fonts.loadEmojiFont('noto')
  fonts.setEmojiFont('noto')
  const notoPicker = [...registered].find(face => face.family === 'EmojiMart')

  await fonts.loadEmojiFont('twemoji')
  fonts.setEmojiFont('twemoji')
  expect(properties.get('--emoji-font')).toBe('WitchskyTwemoji')
  expect(registered.has(notoPicker!)).toBe(false)
  expect(
    [...registered].filter(face => face.family === 'EmojiMart'),
  ).toHaveLength(1)

  fonts.setEmojiFont('noto')
  expect(properties.get('--emoji-font')).toBe('WitchskyNotoColorEmoji')
  expect(registered.has(notoPicker!)).toBe(true)

  fonts.setEmojiFont('system')
  expect(properties.size).toBe(0)
  expect(
    [...registered].filter(face => face.family === 'EmojiMart'),
  ).toHaveLength(0)
})

it('keeps system emoji after a failed download and allows a retry', async () => {
  failLoading = true
  await expect(fonts.loadEmojiFont('twemoji')).rejects.toThrow(
    'Font download failed',
  )
  fonts.setEmojiFont('twemoji')
  expect(properties.size).toBe(0)
  expect(registered.size).toBe(0)

  failLoading = false
  await fonts.loadEmojiFont('twemoji')
  fonts.setEmojiFont('twemoji')
  expect(properties.get('--emoji-font')).toBe('WitchskyTwemoji')
})
