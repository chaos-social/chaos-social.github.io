import {ModerationDecision, moderatePost} from '@bsky/sdk/moderation'

const opts = {
  userDid: 'did:plc:viewer',
  prefs: {labelers: [], labels: {}, adultContentEnabled: false, mutedWords: [], hiddenPosts: []},
  labelDefs: {},
}

const now = new Date().toISOString()
const post = (did, text) => ({
  uri: `at://${did}/app.bsky.feed.post/1`,
  cid: 'cid',
  record: {$type: 'app.bsky.feed.post', text, createdAt: now},
  indexedAt: now,
})

// Top post by an unblocked author, quoting a blocked author
const blockedAuthor = {did: 'did:plc:blocked', handle: 'b.test', viewer: {blocking: 'at://did:plc:viewer/app.bsky.graph.block/1'}}
const top = {
  ...post('did:plc:friendly', 'look at this'),
  author: {did: 'did:plc:friendly', handle: 'f.test'},
  embed: {
    $type: 'app.bsky.embed.record#view',
    record: {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: 'at://did:plc:blocked/app.bsky.feed.post/9',
      cid: 'c2',
      author: blockedAuthor,
      value: {$type: 'app.bsky.feed.post', text: 'quoted', createdAt: now},
      indexedAt: now,
    },
  },
}

const d = moderatePost(top, opts)
const blocks = d.causes.filter(c => ['blocking','blocked-by','block-other'].includes(c.type))
console.log('block causes on TOP post decision:', blocks.map(c => ({type: c.type, downgraded: !!c.downgraded})))
console.log('blockCause (used by isBlocked):', d.blockCause && {type: d.blockCause.type, downgraded: !!d.blockCause.downgraded})
console.log('ui(contentList) blurs:', d.ui('contentList').blurs.length, 'alerts:', d.ui('contentList').alerts.length)
