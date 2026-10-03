import {aliasToRkey} from '#/features/bluemoji/alias'

it.each([
  [':Blob_Cat.v2:', 'blob_cat.v2'],
  [':MÜNCHEN:', 'xn--mnchen-3ya'],
  [':日本語:', 'xn--wgv71a119e'],
  [':bücher:', 'xn--bcher-kva'],
])('derives the RFC 0005 record key for %s', (alias, rkey) => {
  expect(aliasToRkey(alias)).toBe(rkey)
})

it('normalizes decomposed Unicode aliases', () => {
  expect(aliasToRkey(':cafe\u0301:')).toBe(aliasToRkey(':café:'))
})

it.each([
  '::',
  'a:b',
  'has space',
  'xn--fake',
  '\u202Eblobcat',
  '-leading',
  'x'.repeat(65),
])('rejects invalid alias %s', alias => {
  expect(() => aliasToRkey(alias)).toThrow()
})
