import {maskPastedLink} from '../masked-link-paste'

describe('maskPastedLink', () => {
  it('keeps a selected label when replaced by a URL', () => {
    expect(
      maskPastedLink('See this site!', 'See https://example.com!', {
        start: 4,
        end: 13,
      }),
    ).toBe('See [this site](https://example.com)!')
  })

  it('handles a URL shorter than a Unicode label', () => {
    const label = '🌟 a very long selected label'
    expect(
      maskPastedLink(label, 'example.com', {start: 0, end: label.length}),
    ).toBe(`[${label}](example.com)`)
  })

  it.each([
    'steam://launch/3817250',
    'STEAM://launch/3817250',
    'custom+app.v2-test://open/item',
    'mailto:hello@example.com',
    'tel:+15551234567',
  ])('keeps a selected label when replaced by an app URI: %s', uri => {
    expect(maskPastedLink('here', uri, {start: 0, end: 4})).toBe(
      `[here](${uri})`,
    )
  })

  it.each([
    'replacement text',
    '',
    'javascript://example.com',
    'JaVaScRiPt:alert(1)',
    'data:text/html,test',
    'vbscript:msgbox(1)',
    '<https://example.com>',
  ])('leaves ordinary or unsupported replacements alone: %s', next => {
    expect(maskPastedLink('label', next, {start: 0, end: 5})).toBe(next)
  })

  it.each([
    'https://breezewiki.com/starwars/wiki/67_(disambiguation)',
    'https://example.com/a(b(c)d',
  ])('protects a pasted URL containing parentheses: %s', uri => {
    expect(maskPastedLink('page', uri, {start: 0, end: 4})).toBe(
      `[page](<${uri}>)`,
    )
  })

  it('leaves insertion without a selection alone', () => {
    expect(maskPastedLink('', 'https://example.com', {start: 0, end: 0})).toBe(
      'https://example.com',
    )
  })
})
