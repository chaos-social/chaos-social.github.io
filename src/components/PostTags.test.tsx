import {render, screen} from '@testing-library/react-native'

import {PostTags} from '#/components/PostTags'

jest.mock('#/lib/shapes', () => ({getShapeStyle: () => ({})}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => false,
}))
jest.mock('#/state/preferences/show-post-tags', () => ({
  useShowPostTags: () => true,
}))
jest.mock('#/alf', () => ({
  atoms: {},
  tokens: {space: {_2xs: 2}},
  useTheme: () => ({atoms: {}}),
}))
jest.mock('#/components/RichTextTag', () => {
  const {Text} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    RichTextTag: ({tag, display}: {tag: string; display: string}) => (
      <Text testID="tag" accessibilityLabel={tag} accessibilityHint="Tag target">
        {display}
      </Text>
    ),
  }
})

it('replaces displayed tag line breaks with spaces without changing the tag target', () => {
  const tag = 'one\ntwo\r\nthree\rfour\u2028five\u2029six'
  render(
    <PostTags
      post={
        {
          uri: 'at://did:plc:alice/app.bsky.feed.post/test',
          cid: 'test-cid',
          indexedAt: '2026-11-05T00:00:00Z',
          record: {$type: 'app.bsky.feed.post', tags: [tag]},
          author: {did: 'did:plc:alice', handle: 'alice.test'},
        }
      }
    />,
  )
  expect(screen.getByText('#one two three four five six')).toBeTruthy()
  expect(screen.getByTestId('tag').props.accessibilityLabel).toBe(tag)
})
