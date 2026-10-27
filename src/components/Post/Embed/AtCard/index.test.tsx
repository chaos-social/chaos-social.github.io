import {render} from '@testing-library/react-native'

import {sanitizeHandle} from '#/lib/strings/handles'
import {AtCard} from './index'

let mockHideNames = false
const author = {
  did: 'did:plc:author',
  handle: 'author.test',
  displayName: 'Author Name',
}
jest.mock('#/state/queries/profile', () => ({
  useProfileQuery: () => ({data: author}),
}))
jest.mock('#/state/preferences/hide-display-names', () => ({
  useHideDisplayNames: () => mockHideNames,
}))
jest.mock('#/state/preferences/thumbnail-format', () => ({
  useThumbnailFormat: () => 'png',
}))
jest.mock('#/state/preferences/image-cdn-host', () => ({
  ...jest.requireActual('#/state/preferences/image-cdn-host'),
  useImageCdnHost: () => 'https://cdn.example.test',
}))
jest.mock('#/lib/haptics', () => ({useHaptics: () => ({})}))
jest.mock('#/view/com/util/UserAvatar', () => ({UserAvatar: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/components/Link', () => ({
  Link: ({children}: {children: (state: object) => React.ReactNode}) =>
    children({}),
}))
jest.mock('@lingui/react', () => ({useLingui: () => ({_: () => ''})}))
jest.mock('expo-image', () => {
  const {View} = jest.requireActual('react-native')
  return {Image: (props: object) => <View {...props} testID="thumbnail" />}
})

const props: React.ComponentProps<typeof AtCard> = {
  view: {
    uri: 'https://example.attie.site/',
    title: 'Feed',
    description: 'Description',
    thumb:
      'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:author/cid@jpeg',
  },
  authorDid: author.did,
}

it('respects hidden display names and thumbnail settings in AT cards', () => {
  mockHideNames = false
  const {getByText, queryByText, getByTestId, rerender} = render(
    <AtCard {...props} />,
  )
  expect(getByText('Author Name')).toBeTruthy()
  expect(getByTestId('thumbnail').props.source).toEqual({
    uri: 'https://cdn.example.test/img/feed_thumbnail/plain/did:plc:author/cid@png',
  })
  mockHideNames = true
  rerender(<AtCard {...props} />)
  expect(queryByText('Author Name')).toBeNull()
  expect(getByText(sanitizeHandle(author.handle))).toBeTruthy()
})
