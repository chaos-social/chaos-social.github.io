import {pollPostParts, stripPollLines, voteRkey} from './parse'

const START =
  "last night during intimacy, a roach escaped from your rich spouse's perfect body. wdyd? #krautpoll"
const OPTIONS = [
  'divorce',
  'in sickness and in pest',
  'fumigate every 10 years',
  'incorporate pest play',
]
const CENTRALIZED_TEXT = `${START}\n\n${OPTIONS.map((o, i) => `${i + 1}⃣ ${o}`).join('\n')}\n\n📊 Show results`

const byteRange = (text: string, needle: string) => {
  const enc = new TextEncoder()
  const start = enc.encode(text.slice(0, text.indexOf(needle))).length
  return {byteStart: start, byteEnd: start + enc.encode(needle).length}
}

const CENTRALIZED = {
  text: CENTRALIZED_TEXT,
  facets: [
    ...OPTIONS.flatMap((option, i) => {
      const optionLine = `${i + 1}⃣ ${option}`
      const index = byteRange(CENTRALIZED_TEXT, optionLine)
      return [
        {
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: `https://poll.blue/p/u9vz5D/${i + 1}`,
            },
          ],
          index,
        },
        {
          features: [{$type: 'blue.poll.post.facet#option', number: i + 1}],
          index,
        },
      ]
    }),
    {
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: 'https://poll.blue/p/u9vz5D/0',
        },
      ],
      index: byteRange(CENTRALIZED_TEXT, '📊 Show results'),
    },
  ],
}

const PUBLIC = {
  text: 'must ask: skeets skoots posts\n\n1⃣ skeets\n2⃣ skoots\n3⃣ posts\n\n📊 Show results',
  facets: [
    {
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: 'https://poll.blue/p/did:plc:abc~cjdu5oafc2kaz/1',
        },
      ],
      index: {byteStart: 0, byteEnd: 5},
    },
    {
      features: [{$type: 'blue.poll.post.facet#option', number: 1}],
      index: {byteStart: 0, byteEnd: 5},
    },
  ],
}

describe('pollPostParts', () => {
  it('reads options and the results line out of a poll post', () => {
    const parts = pollPostParts(CENTRALIZED)!
    expect(parts.id).toBe('u9vz5D')
    expect(parts.options.map(o => o.number)).toEqual([1, 2, 3, 4])
    const bytes = new TextEncoder().encode(CENTRALIZED.text)
    const at = (start: number, end: number) =>
      new TextDecoder().decode(bytes.slice(start, end))
    const block = at(parts.optionsStart, parts.optionsEnd)
    expect(block).toContain('1⃣ divorce')
    expect(block).toContain('incorporate pest play')
    expect(at(parts.resultsStart!, parts.resultsEnd!)).toContain('Show results')
  })

  it('keeps ~ in public poll ids', () => {
    expect(pollPostParts(PUBLIC)!.id).toBe('did:plc:abc~cjdu5oafc2kaz')
  })

  it('ignores posts that merely link to poll.blue', () => {
    expect(
      pollPostParts({
        text: 'look at this https://poll.blue/p/abc/1',
        facets: [
          {
            features: [
              {
                $type: 'app.bsky.richtext.facet#link',
                uri: 'https://poll.blue/p/abc/1',
              },
            ],
            index: {byteStart: 13, byteEnd: 39},
          },
        ],
      }),
    ).toBeNull()
  })

  it('returns null for a plain post', () => {
    expect(pollPostParts({text: 'hello'})).toBeNull()
  })

  it('reduces a real poll post to just its question', () => {
    const parts = pollPostParts(CENTRALIZED)!
    expect(stripPollLines(CENTRALIZED.text, parts)).toBe(START)
  })
})

describe('stripPollLines', () => {
  it('leaves only the question', () => {
    // Ranges are whole lines, as `pollPostParts` reports them.
    const text = 'Question?\n\n1⃣ one\n2⃣ two\n\n📊 Show results'
    const byteOf = (needle: string) =>
      new TextEncoder().encode(text.slice(0, text.indexOf(needle))).length
    const optionsStart = byteOf('1⃣')
    const optionsEnd = byteOf('📊')
    // Mirror `pollPostParts`: ranges stop at their line end.
    const resultsStart = optionsEnd
    const parts = {
      id: 'x',
      options: [],
      optionsStart,
      optionsEnd,
      resultsStart,
      resultsEnd: new TextEncoder().encode(text).length,
    }
    expect(stripPollLines(text, parts)).toBe('Question?')
  })
})

describe('voteRkey', () => {
  it('matches poll.blue keys', () => {
    expect(
      voteRkey(
        'at://did:plc:bnqkww7bjxaacajzvu5gswdf/blue.poll.poll.poll/cjdu5oafc2kaz',
      ),
    ).toBe('vshkl3l')
  })
})
