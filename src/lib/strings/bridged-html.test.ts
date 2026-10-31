import {getBridgedHtml, htmlToSegments, segmentsToText} from './bridged-html'

describe('htmlToSegments', () => {
  it('renders a typical Mastodon post', () => {
    const html =
      '<p>Hello <span class="h-card" translate="no"><a href="https://example.social/@alice" class="u-url mention">@<span>alice</span></a></span>!</p>' +
      '<p>Read <a href="https://www.example.com/some/very/long/path" rel="nofollow noopener" target="_blank"><span class="invisible">https://www.</span><span class="ellipsis">example.com/some/very</span><span class="invisible">/long/path</span></a> ' +
      '<a href="https://example.social/tags/cats" class="mention hashtag" rel="tag">#<span>cats</span></a></p>'

    expect(htmlToSegments(html)).toEqual([
      {text: 'Hello '},
      {
        text: '@alice',
        link: 'https://example.social/@alice',
        mention: true,
        did: undefined,
      },
      {text: '!\n\nRead '},
      {
        text: 'example.com/some/very…',
        link: 'https://www.example.com/some/very/long/path',
      },
      {text: ' '},
      {text: '#cats', tag: 'cats'},
    ])
  })

  it('takes the DID from Bridgy Fed mention links', () => {
    const record = {
      text: 'Also: @pds.dad',
      fullText:
        '<p>Also: <span class="h-card" translate="no"><a href="https://bsky.brid.gy/ap/did:plc:rnpkyqnmsw4ipey6eotbdnnf" class="u-url mention">@<span>pds.dad</span></a></span></p>',
    }
    expect(htmlToSegments(getBridgedHtml(record)!)).toEqual([
      {text: 'Also: '},
      {
        text: '@pds.dad',
        link: 'https://bsky.brid.gy/ap/did:plc:rnpkyqnmsw4ipey6eotbdnnf',
        mention: true,
        did: 'did:plc:rnpkyqnmsw4ipey6eotbdnnf',
      },
    ])
  })

  it('turns unsafe or relative links into plain text', () => {
    expect(
      htmlToSegments(
        '<p><a href="javascript:alert(1)">click</a> <a href="/about">about</a></p>',
      ),
    ).toEqual([{text: 'click about'}])
  })

  it('drops scripts and styles', () => {
    expect(
      htmlToSegments('<p>hi<script>alert(1)</script><style>p{}</style></p>'),
    ).toEqual([{text: 'hi'}])
  })

  it('handles line breaks, entities and whitespace', () => {
    expect(
      segmentsToText(
        htmlToSegments('<p>a &amp; b<br>c<br><br>d  \n e</p><p>f</p>'),
      ),
    ).toBe('a & b\nc\n\nd e\n\nf')
  })

  it('renders list markers', () => {
    expect(
      segmentsToText(
        htmlToSegments(
          '<p>x</p><ol start="3"><li>three</li><li>four</li></ol><ul><li>dot</li></ul>',
        ),
      ),
    ).toBe('x\n\n3. three\n4. four\n\n• dot')
  })

  it('applies inline styles', () => {
    expect(
      htmlToSegments(
        '<p><strong>b</strong><em>i</em><del>s</del><code>c</code></p><blockquote><p>q<br>r</p></blockquote>',
      ),
    ).toEqual([
      {text: 'b', bold: true},
      {text: 'i', italic: true},
      {text: 's', strike: true},
      {text: 'c', code: true},
      {text: '\n\n'},
      {text: '▎ q', quote: true},
      {text: '\n'},
      {text: '▎ r', quote: true},
    ])
  })

  it('keeps whitespace in pre blocks', () => {
    expect(htmlToSegments('<pre><code>a\n  b\n</code></pre>')).toEqual([
      {text: 'a\n  b', code: true},
    ])
  })

  it('converts TeX math to Unicode', () => {
    expect(
      segmentsToText(
        htmlToSegments(
          '<p><math><semantics><mrow><msup><mi>x</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">x^2 + \\alpha</annotation></semantics></math></p>',
        ),
      ),
    ).toBe('x² + α')
  })
})

describe('getBridgedHtml', () => {
  it('prefers bridgyOriginalText over fullText', () => {
    expect(
      getBridgedHtml({bridgyOriginalText: '<p>a</p>', fullText: 'b'}),
    ).toBe('<p>a</p>')
    expect(getBridgedHtml({bridgyOriginalText: ' ', fullText: 'b'})).toBe('b')
    expect(getBridgedHtml({text: 'plain'})).toBeUndefined()
    expect(getBridgedHtml(undefined)).toBeUndefined()
  })
})
