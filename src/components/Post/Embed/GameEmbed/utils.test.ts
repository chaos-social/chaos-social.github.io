import {type BlobRef} from '@atproto/lex'

import {
  createGameDescription,
  GAME_FIELD,
  getGameAspect,
  getGameEmbedFromRecord,
  getGameKindFromFilename,
  getGameMimeType,
  getGamePlayerUrl,
  getGameUrl,
  isGameEmbed,
  parseGamePath,
  stripGameExtension,
} from './utils'

/* The legacy shape reads `cid` directly, keeping this fixture free of CID internals. */
const blob: BlobRef = {
  cid: 'bafkreigame',
  mimeType: 'application/x-shockwave-flash',
}

/** A post record shaped like a real one written by the composer. */
function postRecord(value: unknown = {kind: 'vnds', file: blob}) {
  return {
    $type: 'app.bsky.feed.post',
    text: 'nothing to see here just experimenting',
    createdAt: '2026-11-01T00:00:00.000Z',
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        $type: 'app.bsky.embed.external#external',
        uri: 'https://witchsky.app/game/did:plc:alice/bafkreigame',
        title: 'Saya’s Song',
        description: 'VNDS visual novel game',
        [GAME_FIELD]: value,
      },
    },
  }
}

describe('isGameEmbed', () => {
  it('accepts a well-formed attachment', () => {
    expect(isGameEmbed({kind: 'flash', file: blob})).toBe(true)
  })

  it('rejects a missing or unknown kind', () => {
    expect(isGameEmbed({file: blob})).toBe(false)
    expect(isGameEmbed({kind: 'java', file: blob})).toBe(false)
    expect(isGameEmbed({kind: 'flash'})).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isGameEmbed(null)).toBe(false)
    expect(isGameEmbed('flash')).toBe(false)
  })
})

describe('getGameEmbedFromRecord', () => {
  it('reads the attachment off a real post record', () => {
    expect(getGameEmbedFromRecord(postRecord())?.kind).toBe('vnds')
  })

  it('reaches through a recordWithMedia wrapper', () => {
    const record = postRecord()
    record.embed = {
      $type: 'app.bsky.embed.recordWithMedia',
      record: {},
      media: record.embed,
    } as never
    expect(getGameEmbedFromRecord(record)?.kind).toBe('vnds')
  })

  it('returns undefined for other posts and malformed attachments', () => {
    expect(getGameEmbedFromRecord(undefined)).toBeUndefined()
    expect(getGameEmbedFromRecord({})).toBeUndefined()
    expect(getGameEmbedFromRecord({embed: {}})).toBeUndefined()
    expect(
      getGameEmbedFromRecord({
        embed: {$type: 'app.bsky.embed.images', images: []},
      }),
    ).toBeUndefined()
    expect(getGameEmbedFromRecord(postRecord({kind: 'nope'}))).toBeUndefined()
  })

  /*
   * The AppView rebuilds `view.external` from known fields and drops unknown
   * ones, so the hydrated view must NOT be trusted as a source. This is the bug
   * that shipped: the record had the attachment and the view did not.
   */
  it('is unaffected by the field being stripped from the hydrated view', () => {
    const view = {
      $type: 'app.bsky.embed.external#viewExternal',
      uri: 'https://witchsky.app/game/did:plc:alice/bafkreigame',
      title: 'Saya’s Song',
      description: 'VNDS visual novel game',
    }
    expect(view).not.toHaveProperty(GAME_FIELD)
    expect(getGameEmbedFromRecord(postRecord())?.kind).toBe('vnds')
  })
})

describe('getGameUrl / parseGamePath', () => {
  it('builds a URL that parses back to the same did and cid', () => {
    const url = getGameUrl('https://witchsky.app', 'did:plc:alice', blob)
    expect(url).toBe('https://witchsky.app/game/did:plc:alice/bafkreigame')
    expect(parseGamePath(new URL(url).pathname)).toEqual({
      did: 'did:plc:alice',
      cid: 'bafkreigame',
    })
  })

  it('rejects paths that are not player URLs', () => {
    expect(parseGamePath('/game/only-one')).toBeUndefined()
    expect(parseGamePath('/profile/alice')).toBeUndefined()
    expect(parseGamePath('/game/a/b/c')).toBeUndefined()
  })
})

describe('getGameAspect', () => {
  it('uses the recorded dimensions', () => {
    expect(getGameAspect({width: 256, height: 192})).toBeCloseTo(4 / 3)
    expect(getGameAspect({width: 640, height: 480})).toBeCloseTo(4 / 3)
    expect(getGameAspect({width: 320, height: 240})).toBeCloseTo(4 / 3)
  })

  it('falls back to 4:3 when dimensions are absent or invalid', () => {
    expect(getGameAspect({})).toBe(4 / 3)
    expect(getGameAspect({width: 0, height: 0})).toBe(4 / 3)
    expect(getGameAspect({width: -1, height: 10})).toBe(4 / 3)
  })
})

describe('getGamePlayerUrl', () => {
  it('carries the game URL and kind into the player page', () => {
    const url = new URL(
      getGamePlayerUrl('https://witchsky.app', 'https://witchsky.app/game/did:x/cid1', {
        kind: 'flash',
        width: 256,
        height: 192,
        alt: 'A title screen',
      }),
    )
    expect(url.pathname).toBe('/static/iframe/game.html')
    expect(url.searchParams.get('game')).toBe('https://witchsky.app/game/did:x/cid1')
    expect(url.searchParams.get('kind')).toBe('flash')
    expect(url.searchParams.get('w')).toBe('256')
    expect(url.searchParams.get('h')).toBe('192')
    expect(url.searchParams.get('alt')).toBe('A title screen')
  })
})

describe('createGameDescription', () => {
  it('names the runtime and appends alt text when present', () => {
    expect(createGameDescription('flash', '')).toBe('Flash game')
    expect(createGameDescription('vnds', '  A horror visual novel  ')).toBe(
      'VNDS visual novel game · A horror visual novel',
    )
  })
})

describe('getGameKindFromFilename', () => {
  it.each([
    ['movie.swf', 'flash'],
    ['Movie.SWF', 'flash'],
    ['tool.jar', 'jar'],
    ['saya-1.0.tar.gz', 'vnds'],
    ['saya.tgz', 'vnds'],
    ['saya.zip', 'vnds'],
    ['notes.txt', undefined],
  ])('%s -> %s', (name, kind) => {
    expect(getGameKindFromFilename(name)).toBe(kind)
  })
})

describe('stripGameExtension', () => {
  it.each([
    ['movie.swf', 'movie'],
    ['tool.jar', 'tool'],
    // Regression: the composer stripped only the final `.gz`, titling the post
    // "saya-1.0.tar".
    ['saya-1.0.tar.gz', 'saya-1.0'],
    ['saya.tgz', 'saya'],
    ['saya.zip', 'saya'],
    ['no-extension', 'no-extension'],
  ])('%s -> %s', (name, expected) => {
    expect(stripGameExtension(name)).toBe(expected)
  })
})

describe('getGameMimeType', () => {
  it('maps each kind to its upload type', () => {
    expect(getGameMimeType('flash')).toBe('application/x-shockwave-flash')
    expect(getGameMimeType('jar')).toBe('application/java-archive')
    expect(getGameMimeType('vnds')).toBe('application/gzip')
  })
})
