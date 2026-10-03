import {RichText} from '@bsky/sdk/richtext'

import {
  applyFacetSyntax,
  applyMarkdownLinkFacets,
} from '#/lib/strings/rich-text-manip'
import {item} from '#/features/bluemoji/__tests__/fixtures'
import {
  applyNativeEmojiEdit,
  NATIVE_EMOJI_SLOT as slot,
  nativeToRaw,
  projectNativeEmoji,
  rawToNative,
} from '#/features/bluemoji/nativeEditor'

jest.unmock('multiformats/cid')
const items = new Map([[item.record.name, item]])
function project(text: string) {
  const rt = new RichText({text})
  rt.detectFacetsWithoutResolution()
  applyMarkdownLinkFacets(rt)
  applyFacetSyntax(rt)
  return projectNativeEmoji(rt, items)
}

describe('native emoji editing', () => {
  it('represents each verified alias as one cursor slot', () => {
    const p = project('A:blobcat:B:blobcat:C')
    expect(p.text).toBe(`A${slot}B${slot}C`)
    expect(nativeToRaw(p, 2)).toBe(10)
    expect(rawToNative(p, 10)).toBe(2)
    expect(rawToNative(p, 5)).toBe(2)
  })

  it('keeps unresolved and escaped aliases as text', () => {
    expect(project('\\:blobcat: :unknown:').tokens).toHaveLength(0)
    expect(project('[hi](https://example.com/:blobcat:)').tokens).toHaveLength(
      0,
    )
  })

  it('does not duplicate emoji on a sequence of typing and deleting', () => {
    let p = project('Hi :blobcat: there')
    let raw = applyNativeEmojiEdit(p, `Hi ${slot} there!`, {
      start: p.text.length,
      end: p.text.length,
    })
    expect(raw).toBe('Hi :blobcat: there!')
    p = project(raw)
    raw = applyNativeEmojiEdit(p, `Hi ${slot} there`, {
      start: p.text.length,
      end: p.text.length,
    })
    expect(raw).toBe('Hi :blobcat: there')
    p = project(raw)
    expect(
      applyNativeEmojiEdit(p, `Hi ${slot} `, {
        start: p.text.length,
        end: p.text.length,
      }),
    ).toBe('Hi :blobcat: ')
  })

  it('deletes an entire emoji with one backspace', () => {
    const p = project('A:blobcat:B')
    expect(applyNativeEmojiEdit(p, 'AB', {start: 2, end: 2})).toBe('AB')
  })

  it('preserves the right source when deleting adjacent identical slots', () => {
    const other = {...item, record: {...item.record, name: ':other:'}}
    const p = projectNativeEmoji(
      new RichText({text: ':blobcat::other:'}),
      new Map([...items, [':other:', other]]),
    )
    expect(applyNativeEmojiEdit(p, slot, {start: 1, end: 1})).toBe(':other:')
    expect(applyNativeEmojiEdit(p, slot, {start: 2, end: 2})).toBe(':blobcat:')
  })

  it('replaces a selection containing an emoji without reusing its slot', () => {
    const p = project('A:blobcat:B')
    expect(applyNativeEmojiEdit(p, 'AxB', {start: 1, end: 2})).toBe('AxB')
  })

  it('preserves an emoji during an autocorrect replacement earlier in the text', () => {
    const p = project('helo :blobcat: friend')
    expect(
      applyNativeEmojiEdit(p, `hello ${slot} friend`, {
        start: p.text.length,
        end: p.text.length,
      }),
    ).toBe('hello :blobcat: friend')
  })

  it('ignores duplicate native change events', () => {
    const p = project('A:blobcat:B')
    expect(applyNativeEmojiEdit(p, p.text, {start: 2, end: 2})).toBe(p.raw)
  })
})
