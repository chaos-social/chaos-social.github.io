import {parseLinkEvent} from '#/features/bluemoji/reactions/notifications'

// Importing the real navigator pulls in the whole screen tree for one string.
jest.mock('#/Navigation', () => ({navigate: jest.fn()}))

describe('parseLinkEvent', () => {
  it('accepts a spacedust link event', () => {
    const event = {
      kind: 'link',
      origin: 'live',
      link: {
        operation: 'create',
        source: 'blue.moji.feed.reaction:subject',
        source_record: 'at://did:plc:reactor/blue.moji.feed.reaction/3mz',
        subject: 'at://did:plc:me/app.bsky.feed.post/3mw',
      },
    }
    expect(parseLinkEvent(event)).toEqual(event)
  })

  it('rejects anything without the two at-uris we act on', () => {
    // The socket is a public firehose, so a malformed or truncated message
    // must not become an AtUri throw inside the notification path.
    expect(parseLinkEvent(null)).toBeUndefined()
    expect(parseLinkEvent('link')).toBeUndefined()
    expect(parseLinkEvent({kind: 'identity'})).toBeUndefined()
    expect(
      parseLinkEvent({
        kind: 'link',
        link: {source_record: 'at://did:plc:a/blue.moji.feed.reaction/1'},
      }),
    ).toBeUndefined()
    expect(
      parseLinkEvent({
        kind: 'link',
        link: {source_record: 5, subject: 'at://x'},
      }),
    ).toBeUndefined()
  })
})
