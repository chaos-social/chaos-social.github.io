import {
  decodePollDraft,
  DEFAULT_POLL_DURATION,
  getOptionIssue,
  getOptionIssues,
  isPollDraftPublishable,
  isPollDuration,
  POLL_MAX_OPTIONS,
  POLL_OPTION_MAX_CHARS,
  pollEndsAt,
  pollOptionsForPublish,
  pollTopicFromText,
} from '#/lib/api/poll'

describe('getOptionIssue', () => {
  it('accepts ordinary text', () => {
    expect(getOptionIssue('Fund the library')).toBeNull()
  })

  it('treats blank text as empty', () => {
    expect(getOptionIssue('')).toBe('empty')
    expect(getOptionIssue('   \n ')).toBe('empty')
  })

  it('stops at the length TOKIMEKI accepts', () => {
    expect(getOptionIssue('a'.repeat(POLL_OPTION_MAX_CHARS))).toBeNull()
    expect(getOptionIssue('a'.repeat(POLL_OPTION_MAX_CHARS + 1))).toBe(
      'too_long',
    )
  })

  it('rejects text that cannot be stored', () => {
    expect(getOptionIssue('a\u0000b')).toBe('invalid')
    expect(getOptionIssue('a\ud800b')).toBe('invalid')
  })
})

describe('getOptionIssues', () => {
  it('reports each choice on its own', () => {
    expect(getOptionIssues(['One', 'Two', ''])).toEqual([null, null, 'empty'])
  })
})

describe('isPollDraftPublishable', () => {
  it('needs two to four filled choices', () => {
    expect(
      isPollDraftPublishable({options: ['One'], duration: '1d'}),
    ).toBe(false)
    expect(
      isPollDraftPublishable({options: ['One', 'Two'], duration: '1d'}),
    ).toBe(true)
    expect(
      isPollDraftPublishable({
        options: ['One', 'Two', 'Three', 'Four'],
        duration: '1d',
      }),
    ).toBe(true)
    expect(
      isPollDraftPublishable({
        options: ['One', 'Two', 'Three', 'Four', 'Five'],
        duration: '1d',
      }),
    ).toBe(false)
  })

  it('refuses a blank choice', () => {
    expect(
      isPollDraftPublishable({options: ['One', ''], duration: '1d'}),
    ).toBe(false)
  })
})

describe('pollOptionsForPublish', () => {
  it('trims each choice in order', () => {
    expect(
      pollOptionsForPublish({options: ['  First ', 'Second'], duration: '1d'}),
    ).toEqual(['First', 'Second'])
  })
})

describe('pollEndsAt', () => {
  const now = new Date('2026-11-07T12:00:00.000Z')

  it.each([
    ['1h', '2026-11-07T13:00:00.000Z'],
    ['6h', '2026-11-07T18:00:00.000Z'],
    ['12h', '2026-11-08T00:00:00.000Z'],
    ['1d', '2026-11-08T12:00:00.000Z'],
    ['3d', '2026-11-10T12:00:00.000Z'],
    ['7d', '2026-11-14T12:00:00.000Z'],
  ])('closes a %s poll at %s', (duration, expected) => {
    expect(pollEndsAt(duration as '1d', now)).toBe(expected)
  })
})

describe('pollTopicFromText', () => {
  it('collapses whitespace', () => {
    expect(pollTopicFromText('  What should we\n\nbuild   next?  ')).toBe(
      'What should we build next?',
    )
  })
})

describe('decodePollDraft', () => {
  it('keeps unfinished choices as typed', () => {
    expect(decodePollDraft({options: ['', ' a '], duration: '3d'})).toEqual({
      options: ['', ' a '],
      duration: '3d',
    })
  })

  it('falls back to the default duration', () => {
    expect(decodePollDraft({options: ['a', 'b']})).toEqual({
      options: ['a', 'b'],
      duration: DEFAULT_POLL_DURATION,
    })
    expect(decodePollDraft({options: ['a', 'b'], duration: '2h'})).toEqual({
      options: ['a', 'b'],
      duration: DEFAULT_POLL_DURATION,
    })
  })

  it('reads the statements of a draft saved before the switch', () => {
    expect(
      decodePollDraft({
        statements: ['first', 'second', 'third'],
        assembly: {rkey: '3k'},
      }),
    ).toEqual({
      options: ['first', 'second', 'third'],
      duration: DEFAULT_POLL_DURATION,
    })
  })

  it('rejects anything that is not a short list of strings', () => {
    expect(decodePollDraft(undefined)).toBeUndefined()
    expect(decodePollDraft({options: []})).toBeUndefined()
    expect(decodePollDraft({options: ['a', 1]})).toBeUndefined()
    expect(decodePollDraft({options: 'a'})).toBeUndefined()
    expect(
      decodePollDraft({
        options: Array.from(Array(POLL_MAX_OPTIONS + 1).keys(), String),
      }),
    ).toBeUndefined()
  })
})

describe('isPollDuration', () => {
  it('accepts only the offered durations', () => {
    expect(isPollDuration('1d')).toBe(true)
    expect(isPollDuration('2h')).toBe(false)
    expect(isPollDuration(undefined)).toBe(false)
  })
})
