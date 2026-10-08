import {parseSearchLink} from '#/lib/routes/searchLink'

const name = 'alice.bsky.social'
const rkey = '3abcdef'

it.each([
  'bsky.app',
  'witchsky.app',
  'mu.social',
  'blacksky.community',
  'northsky.app',
  'reddwarf.app',
  'other.example',
])('opens content from %s', host => {
  for (const [path, screen] of [
    [`profile/${name}`, 'Profile'],
    [`profile/${name}/post/${rkey}`, 'PostThread'],
    [`profile/${name}/theme/${rkey}`, 'Theme'],
    [`profile/${name}/feed/${rkey}`, 'CustomFeed'],
    [`profile/${name}/lists/${rkey}`, 'ProfileList'],
    [`start/${name}/${rkey}`, 'StarterPack'],
    [`starter-pack/${name}/${rkey}`, 'StarterPack'],
  ]) {
    expect(
      parseSearchLink(` https://${host}/${path}/?ref=share#fragment `),
    ).toEqual({
      screen,
      params: screen === 'Profile' ? {name} : {name, rkey},
    })
  }
})

it.each([
  ['app.bsky.feed.post', 'PostThread'],
  ['app.witchsky.theme.colors', 'Theme'],
  ['app.bsky.feed.generator', 'CustomFeed'],
  ['app.bsky.graph.list', 'ProfileList'],
  ['app.bsky.graph.starterpack', 'StarterPack'],
])('opens %s records and PDSls links', (collection, screen) => {
  const uri = `at://${name}/${collection}/${rkey}`
  for (const input of [
    uri,
    `https://pds.ls/${uri}`,
    `https://pds.ls/at/${name}/${collection}/${rkey}`,
  ]) {
    expect(parseSearchLink(input)).toEqual({screen, params: {name, rkey}})
  }
})

it('opens repository, profile record, encoded DID, and short starter pack links', () => {
  for (const input of [
    `at://${name}`,
    `at://${name}/app.bsky.actor.profile/self`,
    `https://pds.ls/at/${name}`,
  ]) {
    expect(parseSearchLink(input)).toEqual({screen: 'Profile', params: {name}})
  }
  expect(parseSearchLink('https://bsky.app/profile/did%3Aplc%3Aabc')).toEqual({
    screen: 'Profile',
    params: {name: 'did:plc:abc'},
  })
  expect(parseSearchLink('https://go.bsky.app/AbC123')).toEqual({
    screen: 'StarterPackShort',
    params: {code: 'AbC123'},
  })
})

it.each([
  'ordinary search',
  'from:alice.bsky.social cats',
  'https://example.com/article',
  'https://example.com/settings',
  `https://bsky.app/profile/${name}/post`,
  `https://bsky.app/profile/${name}/post/${rkey}/extra`,
  'https://bsky.app/profile/%ZZ',
  'https://bsky.app/profile/not-a-handle',
  `ftp://bsky.app/profile/${name}`,
  `https://user:pass@bsky.app/profile/${name}`,
  `at://${name}/app.bsky.feed.like/${rkey}`,
  `at://${name}/app.bsky.feed.post`,
  `at://${name}/app.bsky.feed.post/${rkey}?bad`,
  `look at https://bsky.app/profile/${name}`,
  '',
])('keeps unsupported or malformed input as a search: %s', input => {
  expect(parseSearchLink(input)).toBeUndefined()
})
