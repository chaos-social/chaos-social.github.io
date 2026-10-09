import {facets, Tapper} from '@bsky.app/tapper'

import {
  angleLinkFacet,
  angleMentionFacet,
  angleTagFacet,
  cashtagFacet,
  escapeAwareFacet,
  maskedLinkFacet,
  normalizeComposerLink,
} from './masked-links'

const postUrl =
  'https://witchsky.app/profile/did:plc:7ztoas5m6664r5bwab56byec/post/3muqcpj5o3c23'

function createTapper() {
  return new Tapper({
    facets: {
      mention: escapeAwareFacet(facets.mention),
      tag: escapeAwareFacet(facets.tag),
      cashtag: escapeAwareFacet(cashtagFacet),
      url: escapeAwareFacet(facets.url),
      emoji: escapeAwareFacet(facets.emoji),
      angleLink: angleLinkFacet,
      angleMention: angleMentionFacet,
      angleTag: angleTagFacet,
      maskedLink: maskedLinkFacet,
    },
  })
}

describe('composer masked link facets', () => {
  it.each([
    'steam://launch/3817250',
    'STEAM://launch/3817250',
    'custom+app.v2-test://open/item',
    'mailto:hello@example.com',
    'tel:+15551234567',
  ])('commits a masked app URI without adding HTTPS: %s', uri => {
    const tapper = createTapper()
    const committed = jest.fn()
    tapper.on('facetCommitted', facet =>
      committed(normalizeComposerLink(facet)),
    )
    tapper.handleTextChange(`[here](${uri}) `)

    expect(committed).toHaveBeenLastCalledWith(
      expect.objectContaining({type: 'url', value: uri}),
    )
  })

  it.each(['!', '?', '?!', '.)*', '!)*', ', next'])(
    'leaves punctuation after a masked link plain: %s',
    suffix => {
      const tapper = createTapper()
      const masked = '[with masked links](like.so)'
      tapper.handleTextChange(`(*text ${masked}${suffix}`)

      expect(
        tapper.nodes
          .filter(node => node.type === 'facet')
          .map(node => node.raw),
      ).toEqual([masked])
      expect(tapper.nodes.at(-1)).toMatchObject({type: 'text', raw: suffix})
    },
  )
  it.each([
    'https://breezewiki.com/starwars/wiki/67_(disambiguation)',
    '<https://breezewiki.com/starwars/wiki/67_(disambiguation)>',
    'https://breezewiki.com/starwars/wiki/67_\\(disambiguation\\)',
    '<https://example.com/a(b(c)d>',
  ])(
    'highlights and commits the complete masked destination: %s',
    destination => {
      const tapper = createTapper()
      const committed = jest.fn()
      tapper.on('facetCommitted', facet =>
        committed(normalizeComposerLink(facet)),
      )
      const text = `[page](${destination})`
      for (let i = 1; i <= text.length; i++)
        tapper.handleTextChange(text.slice(0, i))

      expect(tapper.nodes).toEqual([
        expect.objectContaining({
          facetType: 'maskedLink',
          raw: text,
          value: destination,
          start: 0,
          end: text.length,
        }),
      ])
      tapper.handleTextChange(`${text} `)
      expect(committed).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: 'url',
          value: destination.includes('breezewiki')
            ? 'https://breezewiki.com/starwars/wiki/67_(disambiguation)'
            : 'https://example.com/a(b(c)d',
        }),
      )
    },
  )

  it.each(['https://example.com/a(b)', '\\<https://example.com/a(b)>'])(
    'keeps an escaped masked destination plain: %s',
    destination => {
      const tapper = createTapper()
      tapper.handleTextChange(`\\[page](${destination})`)

      expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([])
    },
  )

  it.each(['', ' '])(
    'allows an independent angle link inside an escaped wrapper, padded with %j',
    padding => {
      const uri = 'https://breezewiki.com/starwars/wiki/67_(disambiguation)'
      const tapper = createTapper()
      const committed = jest.fn()
      tapper.on('facetCommitted', facet =>
        committed(normalizeComposerLink(facet)),
      )
      tapper.handleTextChange(`\\[${uri}](<${padding}${uri}${padding}>)`)

      expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([
        expect.objectContaining({
          facetType: 'angleLink',
          raw: `<${padding}${uri}${padding}>`,
        }),
      ])
      expect(committed).toHaveBeenLastCalledWith(
        expect.objectContaining({type: 'url', value: uri}),
      )
    },
  )

  it('keeps the contents of an independently escaped, spaced angle link plain', () => {
    const tapper = createTapper()
    tapper.handleTextChange('\\< https://example.com/a(b) >')

    expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([])
  })

  it('highlights the complete expression and commits only its destination', () => {
    const tapper = createTapper()
    const committed = jest.fn()
    tapper.on('facetCommitted', facet =>
      committed(normalizeComposerLink(facet)),
    )
    const text = `[meow](${postUrl})`
    tapper.handleTextChange(text)
    expect(tapper.nodes).toEqual([
      expect.objectContaining({
        type: 'facet',
        raw: text,
        value: postUrl,
        start: 0,
        end: text.length,
      }),
    ])
    expect(committed).toHaveBeenCalledTimes(1)
    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({type: 'url', value: postUrl}),
    )
  })

  it('gives masked links priority over facets inside their labels', () => {
    const tapper = createTapper()
    tapper.handleTextChange(
      '🌟 [@person.test #tag](example.com) https://other.test',
    )
    expect(
      tapper.nodes.filter(node => node.type === 'facet').map(node => node.raw),
    ).toEqual(['[@person.test #tag](example.com)', 'https://other.test'])
  })

  it('recognizes a link completed one character at a time', () => {
    const tapper = createTapper()
    const text = `[meow](${postUrl})`
    for (let i = 1; i <= text.length; i++)
      tapper.handleTextChange(text.slice(0, i))
    expect(tapper.nodes[0]).toMatchObject({
      type: 'facet',
      facetType: 'maskedLink',
      raw: text,
      value: postUrl,
    })
  })

  it('normalizes bare domains for embed callbacks', () => {
    expect(
      normalizeComposerLink({
        type: 'maskedLink',
        value: 'example.com',
        raw: '[label](example.com)',
        range: {start: 0, end: 20},
      }).value,
    ).toBe('https://example.com')
  })

  it('leaves an escaped masked link and its URL as plain text', () => {
    const tapper = createTapper()
    tapper.handleTextChange('\\[label](example.com)')

    expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([])
  })

  it('treats a doubled backslash as literal before a masked link', () => {
    const tapper = createTapper()
    tapper.handleTextChange('\\\\[label](example.com)')

    expect(
      tapper.nodes.filter(node => node.type === 'facet').map(node => node.raw),
    ).toEqual(['[label](example.com)'])
  })

  it('highlights a link inside angle brackets and commits its URL', () => {
    const tapper = createTapper()
    const committed = jest.fn()
    tapper.on('facetCommitted', facet =>
      committed(normalizeComposerLink(facet)),
    )
    tapper.handleTextChange('<example.com>!')

    expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([
      expect.objectContaining({raw: '<example.com>', facetType: 'angleLink'}),
    ])
    expect(committed).toHaveBeenCalledWith(
      expect.objectContaining({type: 'url', value: 'https://example.com'}),
    )
  })

  it('does not highlight an escaped angle link', () => {
    const tapper = createTapper()
    tapper.handleTextChange('\\<example.com>')

    expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([])
  })

  it('highlights enclosed hashtags and cashtags', () => {
    const tapper = createTapper()
    tapper.handleTextChange('<#topic> <$TSLA>')

    expect(
      tapper.nodes.filter(node => node.type === 'facet').map(node => node.raw),
    ).toEqual(['<#topic>', '<$TSLA>'])
  })

  it('highlights a plain cashtag', () => {
    const tapper = createTapper()
    tapper.handleTextChange('$TSLA')

    expect(
      tapper.nodes.filter(node => node.type === 'facet').map(node => node.raw),
    ).toEqual(['$TSLA'])
  })

  it('keeps escaped hashtags and cashtags plain', () => {
    const tapper = createTapper()
    tapper.handleTextChange('\\#topic \\$TSLA \\<#other> \\<$AAPL>')

    expect(tapper.nodes.filter(node => node.type === 'facet')).toEqual([])
  })
})
