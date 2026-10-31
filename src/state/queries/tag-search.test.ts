import {mergeLabels} from '#/state/queries/tag-search'
import {type com} from '#/lexicons'

const URI = 'at://did:plc:a/app.bsky.feed.post/1'
const LABELER = 'did:plc:labeler'

function label(
  src: string,
  val: string,
  extra: Partial<com.atproto.label.defs.Label> = {},
) {
  return {
    src,
    uri: URI,
    val,
    cts: '2026-01-01T00:00:00Z',
    ...extra,
  } as com.atproto.label.defs.Label
}

describe('mergeLabels', () => {
  it('replaces the labeler labels and keeps other sources', () => {
    const existing = [label(LABELER, '1girl'), label('did:plc:other', 'porn')]
    const full = [
      label(LABELER, '1girl'),
      label(LABELER, 'solo'),
      label(LABELER, 'smile'),
    ]
    expect(mergeLabels(existing, full).map(l => `${l.src}:${l.val}`)).toEqual([
      'did:plc:other:porn',
      `${LABELER}:1girl`,
      `${LABELER}:solo`,
      `${LABELER}:smile`,
    ])
  })

  it('drops negated and expired labels', () => {
    const full = [
      label(LABELER, 'solo'),
      label(LABELER, 'smile'),
      label(LABELER, 'solo', {neg: true}),
      label(LABELER, 'old', {exp: '2020-01-01T00:00:00Z'}),
    ]
    expect(mergeLabels(undefined, full).map(l => l.val)).toEqual(['smile'])
  })

  it('keeps existing labels when the labeler returned none', () => {
    const existing = [label(LABELER, '1girl')]
    expect(mergeLabels(existing, [])).toEqual(existing)
  })
})
