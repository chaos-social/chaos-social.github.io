import {moderatePost,ModerationDecision} from '@bsky/sdk/moderation'

import {
  blockCauses,
  blockCausesFromViewer,
  fetchPostAnon,
  hasBlockCause,
  isBlocked,
  withLabels,
} from '#/state/queries/see-through-blocks'
import {type com} from '#/lexicons'

const LABEL: com.atproto.label.defs.Label = {
  $type: 'com.atproto.label.defs#label',
  src: 'did:plc:labeler',
  uri: 'at://did:plc:alice/app.bsky.feed.post/1',
  val: 'porn',
  cts: '2026-01-01T00:00:00.000Z',
}

function blockedDecision() {
  const decision = new ModerationDecision()
  decision.setDid('did:plc:alice')
  decision.setIsMe(false)
  decision.addBlocking('at://did:plc:alice/app.bsky.graph.block/x')
  return decision
}

describe('blockCauses', () => {
  it('keeps only block causes', () => {
    const decision = blockedDecision()
    decision.addMuted(true)
    expect(blockCauses(decision).map(c => c.type)).toEqual(['blocking'])
  })

  it('reports a block for isBlocked', () => {
    expect(isBlocked(blockedDecision())).toBe(true)
    expect(isBlocked(new ModerationDecision())).toBe(false)
  })

  it('carries causes that would hide the content again if re-used', () => {
    /*
     * The reason these are rendered as pills rather than merged back into the
     * decision: a live block cause blurs contentList with no override.
     */
    expect(blockedDecision().ui('contentList').blurs).toHaveLength(1)
    expect(blockedDecision().ui('contentList').noOverride).toBe(true)
  })
})

describe('quoted blocks do not belong to the post showing them', () => {
  const opts = {
    userDid: 'did:plc:viewer',
    prefs: {
      labelers: [],
      labels: {},
      adultContentEnabled: false,
      mutedWords: [],
      hiddenPosts: [],
    },
    labelDefs: {},
  } as never
  const now = '2026-01-01T00:00:00.000Z'

  function postBy(did: string, extra: Record<string, unknown> = {}) {
    return {
      uri: `at://${did}/app.bsky.feed.post/1`,
      cid: 'cid',
      author: {did, handle: 'test'},
      record: {$type: 'app.bsky.feed.post', text: 'hi', createdAt: now},
      indexedAt: now,
      ...extra,
    } as never
  }

  function quoting(blockedAuthorViewer: Record<string, unknown>) {
    return postBy('did:plc:friendly', {
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewRecord',
          uri: 'at://did:plc:blocked/app.bsky.feed.post/9',
          cid: 'c2',
          author: {did: 'did:plc:blocked', handle: 'b', viewer: blockedAuthorViewer},
          value: {$type: 'app.bsky.feed.post', text: 'q', createdAt: now},
          indexedAt: now,
        },
      },
    })
  }

  it('is not this post*s block', () => {
    // decidePost downgrades the quoted decision and merges it in
    const decision = moderatePost(quoting({blocking: 'at://x'}), opts)
    expect(hasBlockCause(decision)).toBe(true)
    expect(isBlocked(decision)).toBe(false)
    expect(blockCauses(decision)).toEqual([])
  })

  it('stays a block on the post itself', () => {
    const decision = moderatePost(
      postBy('did:plc:blocked2', {
        author: {did: 'did:plc:blocked2', handle: 'x', viewer: {blocking: 'at://y'}},
      }),
      opts,
    )
    expect(hasBlockCause(decision)).toBe(true)
    expect(isBlocked(decision)).toBe(true)
    expect(blockCauses(decision).map(c => c.type)).toEqual(['blocking'])
  })
})

describe('blockCausesFromViewer', () => {
  it('rebuilds blocking and blocked-by', () => {
    const causes = blockCausesFromViewer({
      blocking: 'at://did:plc:alice/app.bsky.graph.block/x',
      blockedBy: true,
    })
    expect(causes.map(c => c.type)).toEqual(['blocking', 'blocked-by'])
  })

  it('reports a list block as a list-sourced cause', () => {
    const list = {
      uri: 'at://did:plc:alice/app.bsky.graph.list/l',
      cid: 'cid',
      purpose: 'app.bsky.graph.defs#modlist',
      name: 'L',
    } as never
    const causes = blockCausesFromViewer({
      blocking: 'at://did:plc:alice/app.bsky.graph.block/x',
      blockingByList: list,
    })
    expect(causes[0].source).toEqual({type: 'list', list})
  })

  it('is empty without a block, so mutes are untouched', () => {
    expect(blockCausesFromViewer({muted: true})).toEqual([])
    expect(blockCausesFromViewer(undefined)).toEqual([])
  })
})

describe('withLabels', () => {
  const view = (labels: typeof LABEL[], authorLabels: typeof LABEL[]) => ({
    uri: 'at://did:plc:alice/app.bsky.feed.post/1',
    labels,
    author: {did: 'did:plc:alice', labels: authorLabels},
  })

  it('keeps the labels the anonymous read dropped', () => {
    // public.api.bsky.app hydrates no third-party labeler labels at all
    expect(withLabels(view([], []), view([LABEL], [LABEL]))).toMatchObject({
      labels: [LABEL],
      author: {labels: [LABEL]},
    })
  })

  it('keeps anonymous labels when the signed-in view has none', () => {
    expect(withLabels(view([LABEL], [LABEL]), view([], []))).toMatchObject({
      labels: [LABEL],
      author: {labels: [LABEL]},
    })
  })

  it('does not mutate its input', () => {
    const anon = view([], [])
    withLabels(anon, view([LABEL], [LABEL]))
    expect(anon.labels).toEqual([])
    expect(anon.author.labels).toEqual([])
  })
})

describe('fetchPostAnon', () => {
  it('asks the appview for the post without credentials', async () => {
    const call = jest.fn().mockResolvedValue({posts: []})
    await fetchPostAnon(
      {call} as never,
      'https://slingshot.example',
      'at://did:plc:alice/app.bsky.feed.post/1',
    )
    expect(call).toHaveBeenCalledWith(expect.anything(), {
      uris: ['at://did:plc:alice/app.bsky.feed.post/1'],
    })
  })
})

describe('moderating the anonymous read', () => {
  it('finds no block, which is the whole mechanism', () => {
    const opts = {
      userDid: 'did:plc:viewer',
      prefs: {
        labelers: [],
        labels: {},
        adultContentEnabled: false,
        mutedWords: [],
        hiddenPosts: [],
      },
      labelDefs: {},
    } as never
    const view = {
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      cid: 'cid',
      author: {did: 'did:plc:alice'},
      record: {
        $type: 'app.bsky.feed.post',
        text: 'hi',
        createdAt: new Date().toISOString(),
      },
      indexedAt: new Date().toISOString(),
    } as never
    expect(isBlocked(moderatePost(view, opts))).toBe(false)
  })
})
