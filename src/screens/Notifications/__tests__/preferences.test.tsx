import {act, fireEvent, render, renderHook} from '@testing-library/react-native'

import {sanitizeHandle} from '#/lib/strings/handles'
import {type app} from '#/lexicons'
import {InlineImages} from '../components/NotificationItem/Item/media'
import {FollowButton} from '../components/NotificationItem/Item/profile'
import {useDisplayName} from '../components/NotificationItem/Item/text'

let mockHideNames = false
let mockConfirmFollow = true
let mockFollowing = false
let mockFormat = 'png'
let mockCdnHost = 'https://cdn.example.test'
const mockFollow = jest.fn()
const mockUnfollow = jest.fn()
const mockOpen = jest.fn()
let mockConfirm: (() => void) | undefined

jest.mock('expo-image', () => {
  const {View} = jest.requireActual('react-native')
  return {Image: (props: object) => <View {...props} testID="thumbnail" />}
})
jest.mock('#/state/preferences/hide-display-names', () => ({
  useHideDisplayNames: () => mockHideNames,
}))
jest.mock('#/state/preferences/confirm-follow', () => ({
  useConfirmFollow: () => mockConfirmFollow,
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/state/preferences/thumbnail-format', () => ({
  useThumbnailFormat: () => mockFormat,
}))
jest.mock('#/state/preferences/image-cdn-host', () => ({
  ...jest.requireActual('#/state/preferences/image-cdn-host'),
  useImageCdnHost: () => mockCdnHost,
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: true, currentAccount: {did: 'did:plc:me'}}),
}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (profile: object) => ({
    ...profile,
    viewer: {following: mockFollowing ? 'at://follow' : undefined},
  }),
}))
jest.mock('#/state/queries/profile', () => ({
  useProfileFollowMutationQueue: () => [mockFollow, mockUnfollow],
}))
jest.mock('#/components/Prompt', () => ({
  usePromptControl: () => ({open: mockOpen}),
}))
jest.mock('#/components/dialogs/FollowConfirmationDialog', () => ({
  FollowConfirmationDialog: ({onConfirm}: {onConfirm: () => void}) => {
    mockConfirm = onConfirm
    return null
  },
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: (message: {message?: string} | string) =>
      typeof message === 'string' ? message : message.message,
  }),
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = jest.requireActual('react-native')
  return {
    Button: ({label, onPress}: {label: string; onPress: () => void}) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint=""
        onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  }
})
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/AvatarStack', () => ({}))
jest.mock('#/components/Link', () => ({}))
jest.mock('#/components/ProfileHoverCard', () => ({}))
jest.mock('#/components/StarterPack/StarterPackCard', () => ({}))
jest.mock('#/components/ProfileBadges', () => ({}))
jest.mock('#/view/com/util/UserAvatar', () => ({}))
jest.mock('#/analytics', () => ({}))

const profile = {
  did: 'did:plc:author',
  handle: 'author.test',
  displayName: 'Author Name',
} as app.bsky.actor.defs.ProfileView
const pressEvent = {preventDefault: jest.fn(), stopPropagation: jest.fn()}

beforeEach(() => {
  jest.clearAllMocks()
  mockHideNames = false
  mockConfirmFollow = true
  mockFollowing = false
  mockFollow.mockResolvedValue(undefined)
  mockUnfollow.mockResolvedValue(undefined)
  mockConfirm = undefined
})

it('uses handles throughout notification text when display names are hidden', () => {
  const {result, rerender} = renderHook(() => useDisplayName(profile))
  expect(result.current).toBe('Author Name')
  mockHideNames = true
  rerender({})
  expect(result.current).toBe(sanitizeHandle('author.test'))
  mockHideNames = false
  rerender({})
  expect(result.current).toBe('Author Name')
})

it('waits for confirmation before following when requested', () => {
  const {getByRole} = render(
    <FollowButton profile={profile} logContext="NotificationFollowRow" />,
  )
  fireEvent.press(getByRole('button'), pressEvent)
  expect(mockOpen).toHaveBeenCalledTimes(1)
  expect(mockFollow).not.toHaveBeenCalled()
  act(() => mockConfirm?.())
  expect(mockFollow).toHaveBeenCalledTimes(1)
})

it('follows directly when follow confirmation is disabled', () => {
  mockConfirmFollow = false
  const {getByRole} = render(
    <FollowButton profile={profile} logContext="NotificationFollowRow" />,
  )
  act(() => fireEvent.press(getByRole('button'), pressEvent))
  expect(mockOpen).not.toHaveBeenCalled()
  expect(mockFollow).toHaveBeenCalledTimes(1)
})

it('always confirms an unfollow, even when follow confirmation is disabled', () => {
  mockConfirmFollow = false
  mockFollowing = true
  const {getByRole} = render(
    <FollowButton profile={profile} logContext="NotificationFollowRow" />,
  )
  fireEvent.press(getByRole('button'), pressEvent)
  expect(mockUnfollow).not.toHaveBeenCalled()
  expect(mockOpen).toHaveBeenCalledTimes(1)
  act(() => mockConfirm?.())
  expect(mockUnfollow).toHaveBeenCalledTimes(1)
})

it('applies thumbnail format and CDN preferences to notification previews', () => {
  const {getByTestId} = render(
    <InlineImages
      size={60}
      embed={{
        $type: 'app.bsky.embed.images#view',
        images: [
          {
            thumb:
              'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:author/cid@jpeg',
            fullsize:
              'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:author/cid@jpeg',
            alt: 'Image',
          },
        ],
      }}
    />,
  )
  expect(getByTestId('thumbnail').props.source).toEqual({
    uri: 'https://cdn.example.test/img/feed_thumbnail/plain/did:plc:author/cid@png',
  })
})
