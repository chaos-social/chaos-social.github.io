import {
  expandPostTextRich,
  getPreviewMedia,
  renderEmbedMeta,
} from './post-embed'

const author = {
  did: 'did:plc:alice',
  displayName: 'Alice',
  handle: 'alice.test',
}

describe('expandPostTextRich', () => {
  it('expands shortened links using UTF-8 facet offsets', () => {
    const text = 'Emoji 👋 example.com/long... done'
    const segment = 'example.com/long...'
    const byteStart = new TextEncoder().encode(
      text.slice(0, text.indexOf(segment)),
    ).length
    const byteEnd = byteStart + new TextEncoder().encode(segment).length

    expect(
      expandPostTextRich({
        $type: 'app.bsky.feed.defs#threadViewPost',
        post: {
          author,
          indexedAt: '2026-08-08T00:00:00.000Z',
          record: {
            text,
            facets: [
              {
                index: {byteStart, byteEnd},
                features: [
                  {
                    $type: 'app.bsky.richtext.facet#link',
                    uri: 'https://example.com/longer-destination',
                  },
                ],
              },
            ],
          },
        },
      }),
    ).toBe('Emoji 👋 https://example.com/longer-destination done')
  })

  it('includes reply and quoted-post context', () => {
    expect(
      expandPostTextRich({
        $type: 'app.bsky.feed.defs#threadViewPost',
        parent: {
          $type: 'app.bsky.feed.defs#threadViewPost',
          post: {
            author: {...author, displayName: 'Parent'},
            indexedAt: '2026-08-08T00:00:00.000Z',
          },
        },
        post: {
          author,
          embed: {
            $type: 'app.bsky.embed.record#view',
            record: {
              $type: 'app.bsky.embed.record#viewRecord',
              author: {...author, displayName: 'Quoted'},
              value: {text: 'quoted text'},
            },
          },
          indexedAt: '2026-08-08T00:00:00.000Z',
          record: {text: 'reply text'},
        },
      }),
    ).toBe(
      '↩️ reply to Parent (@alice.test):\n\nreply text\n\n↘️ quoting Quoted (@alice.test):\n\nquoted text',
    )
  })

  it('quotes through recordWithMedia', () => {
    expect(
      expandPostTextRich({
        $type: 'app.bsky.feed.defs#threadViewPost',
        post: {
          author,
          embed: {
            $type: 'app.bsky.embed.recordWithMedia#view',
            media: {$type: 'app.bsky.embed.images#view', images: []},
            record: {
              $type: 'app.bsky.embed.record#view',
              record: {
                $type: 'app.bsky.embed.record#viewRecord',
                author: {...author, displayName: 'Quoted'},
                value: {text: 'quoted text'},
              },
            },
          },
          indexedAt: '2026-08-08T00:00:00.000Z',
          record: {text: 'reply text'},
        },
      }),
    ).toBe('reply text\n\n↘️ quoting Quoted (@alice.test):\n\nquoted text')
  })

  it('falls back to a placeholder when the quoted post is unavailable', () => {
    for (const $type of [
      'app.bsky.embed.record#viewNotFound',
      'app.bsky.embed.record#viewBlocked',
    ]) {
      expect(
        expandPostTextRich({
          $type: 'app.bsky.feed.defs#threadViewPost',
          post: {
            author,
            embed: {
              $type: 'app.bsky.embed.record#view',
              record: {$type, uri: 'at://did:plc:gone/app.bsky.feed.post/1'},
            },
            indexedAt: '2026-08-08T00:00:00.000Z',
            record: {text: 'reply text'},
          },
        }),
      ).toBe('reply text\n\n[quote/embed]')
    }
  })
})

function threadWith(embed: any) {
  return {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post: {
      author,
      embed,
      indexedAt: '2026-08-08T00:00:00.000Z',
      record: {text: 'post text'},
    },
  }
}

const videoEmbed = {
  $type: 'app.bsky.embed.video#view',
  cid: 'bafyvideo',
  playlist: 'https://video.bsky.app/watch/did%3Aplc%3Aalice/playlist.m3u8',
  thumbnail: 'https://video.bsky.app/thumb.jpg',
  aspectRatio: {height: 1920, width: 1080},
}

describe('getPreviewMedia', () => {
  it('uses the post own video', () => {
    expect(getPreviewMedia(threadWith(videoEmbed))).toEqual({
      kind: 'video',
      cid: 'bafyvideo',
      did: author.did,
      thumbnail: 'https://video.bsky.app/thumb.jpg',
      aspectRatio: {height: 1920, width: 1080},
    })
  })

  it('borrows the quoted post media when the post has none', () => {
    const media = getPreviewMedia(
      threadWith({
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewRecord',
          author,
          value: {text: 'quoted text'},
          embeds: [videoEmbed],
        },
      }),
    )

    expect(media).toMatchObject({kind: 'video', cid: 'bafyvideo'})
  })

  it('uses the media half of recordWithMedia', () => {
    const media = getPreviewMedia(
      threadWith({
        $type: 'app.bsky.embed.recordWithMedia#view',
        media: {
          $type: 'app.bsky.embed.images#view',
          images: [{thumb: 'a.jpg'}, {thumb: 'b.jpg'}],
        },
        record: {
          $type: 'app.bsky.embed.record#view',
          record: {$type: 'app.bsky.embed.record#viewRecord', author},
        },
      }),
    )

    expect(media).toEqual({kind: 'images', urls: ['a.jpg', 'b.jpg']})
  })

  it('returns nothing for a text-only post', () => {
    expect(getPreviewMedia(threadWith(undefined))).toBeUndefined()
  })
})

describe('renderEmbedMeta', () => {
  const tags = async (media: any) => (await renderEmbedMeta(media)).toString()

  it('emits a player card for video', async () => {
    const out = await tags({
      kind: 'video',
      cid: 'bafyvideo',
      did: 'did:plc:alice',
      thumbnail: 'thumb.jpg',
      aspectRatio: {height: 1920, width: 1080},
    })

    for (const snippet of [
      'name="twitter:card" content="player"',
      'property="og:video"',
      'property="og:video:secure_url"',
      'property="og:video:type" content="video/mp4"',
      'property="og:video:width" content="1080"',
      'property="og:video:height" content="1920"',
      'name="twitter:player:stream"',
      'name="twitter:player:stream:content_type" content="video/mp4"',
      'name="twitter:player:width" content="1080"',
      'name="twitter:player:height" content="1920"',
      'property="og:image" content="thumb.jpg"',
    ]) {
      expect(out).toContain(snippet)
    }
  })

  it('caps images at four', async () => {
    const out = await tags({
      kind: 'images',
      urls: ['1.jpg', '2.jpg', '3.jpg', '4.jpg'],
    })

    expect(out.match(/property="og:image"/g)).toHaveLength(4)
    expect(out).toContain('summary_large_image')
  })

  it('falls back to a summary card', async () => {
    expect(await tags(undefined)).toContain('content="summary"')
  })
})
