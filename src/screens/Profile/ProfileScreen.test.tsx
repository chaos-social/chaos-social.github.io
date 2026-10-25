import {act, render, screen} from '@testing-library/react-native'

import {useProfileQuery} from '#/state/queries/profile'
import {useAppviewClient} from '#/state/session'
import {ProfileScreen} from '#/view/screens/Profile'

jest.mock('#/state/session', () => ({
  useAppviewClient: jest.fn(),
  useSession: () => ({hasSession: false}),
}))
jest.mock('#/state/queries/profile', () => ({useProfileQuery: jest.fn()}))
jest.mock('#/state/queries/resolve-uri', () => ({
  useResolveDidQuery: () => ({data: 'did:plc:alice', isPending: false}),
}))
jest.mock('#/state/queries/labeler', () => ({useLabelerInfoQuery: () => ({})}))
jest.mock('#/state/queries/post-feed', () => ({}))
jest.mock('#/view/com/feeds/ProfileFeedgens', () => ({}))
jest.mock('#/view/com/lists/ProfileLists', () => ({}))
jest.mock('#/view/com/util/error/ErrorScreen', () => ({}))
jest.mock('#/view/com/util/fab/FAB', () => ({}))
jest.mock('#/screens/Profile/Sections/Labels', () => ({}))
jest.mock('#/components/StarterPack/ProfileStarterPacks', () => ({}))
jest.mock('#/features/themes/accentForeground', () => ({}))
jest.mock('#/Navigation', () => ({}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (profile: unknown) => profile,
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))
jest.mock('#/state/preferences/hide-display-names', () => ({
  useHideDisplayNames: () => false,
}))
jest.mock('#/state/preferences/show-standard-labeler-profile', () => ({
  useShowStandardLabelerProfile: () => false,
}))
jest.mock('#/state/events', () => ({listenSoftReset: jest.fn()}))
jest.mock('#/lib/hooks/useSetTitle', () => ({useSetTitle: jest.fn()}))
jest.mock('#/lib/hooks/useOpenComposer', () => ({useOpenComposer: () => ({})}))
jest.mock('#/lib/hooks/useRequireEmailVerification', () => ({
  useRequireEmailVerification: () => (callback: unknown) => callback,
}))
jest.mock('#/lib/strings/display-names', () => ({
  combinedDisplayName: () => 'Alice',
}))
jest.mock('#/lib/userstyles', () => ({userStyle: () => ({})}))
jest.mock('#/lib/styles', () => ({colors: {}}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({atoms: {}}),
  useBreakpoints: () => ({gtMobile: false}),
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderateProfile: () => ({ui: () => ({})}),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({}),
}))
jest.mock('@tanstack/react-query', () => ({useQueryClient: () => ({})}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: (message: {id: string}) => message.id}),
  Trans: () => null,
}))
jest.mock('react-native-scroll-forwarder', () => {
  const {View} = jest.requireActual('react-native')
  return {ScrollForwarderView: View}
})
jest.mock('#/components/Layout', () => {
  const {View} = jest.requireActual('react-native')
  return {Screen: View}
})
jest.mock('#/components/moderation/ScreenHider', () => {
  const {View} = jest.requireActual('react-native')
  return {ScreenHider: View}
})
jest.mock('#/screens/Profile/Header', () => {
  const {Text} = jest.requireActual('react-native')
  return {
    ProfileHeader: ({
      descriptionRT,
      isPlaceholderProfile,
    }: {
      descriptionRT: {text: string} | null
      isPlaceholderProfile: boolean
    }) =>
      isPlaceholderProfile ? null : (
        <Text testID="profileHeaderDescription">{descriptionRT?.text}</Text>
      ),
  }
})
jest.mock('#/screens/Profile/Sections/Feed', () => {
  const {Text} = jest.requireActual('react-native')
  return {
    ProfileFeedSection: () => <Text testID="profilePosts">Posts</Text>,
  }
})
jest.mock('#/view/com/pager/PagerWithHeader', () => {
  const {View, Text} = jest.requireActual('react-native')
  return {
    PagerWithHeader: ({
      isHeaderReady,
      renderHeader,
      children,
    }: {
      isHeaderReady: boolean
      renderHeader: (props: {setMinimumHeight: () => void}) => React.ReactNode
      children: (((props: {}) => React.ReactNode) | null)[]
    }) => (
      <View>
        {renderHeader({setMinimumHeight: () => {}})}
        {isHeaderReady && (
          <>
            <Text testID="profileTabs">Tabs</Text>
            {children.find(Boolean)?.({})}
          </>
        )}
      </View>
    ),
  }
})

const description = '@alice.test https://example.com #hello'

beforeEach(() => {
  jest.mocked(useProfileQuery).mockReturnValue({
    data: {did: 'did:plc:alice', handle: 'alice.test', description},
    isPlaceholderData: false,
    isPending: false,
  } as never)
})

function renderProfile() {
  return render(
    <ProfileScreen
      route={{params: {name: 'did:plc:alice'}} as never}
      navigation={{} as never}
    />,
  )
}

test('the bio, tabs, and posts render before bio mentions resolve', async () => {
  let resolve!: (value: {did: string}) => void
  const pending = new Promise<{did: string}>(resolvePromise => {
    resolve = resolvePromise
  })
  const call = jest.fn(() => pending)
  jest.mocked(useAppviewClient).mockReturnValue({call} as never)

  renderProfile()

  expect(call).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('profileHeaderDescription').props.children).toBe(
    description,
  )
  expect(screen.getByTestId('profileTabs')).toBeTruthy()
  expect(screen.getByTestId('profilePosts')).toBeTruthy()

  await act(async () => {
    resolve({did: 'did:plc:alice'})
    await pending
  })

  expect(screen.getByTestId('profileHeaderDescription').props.children).toBe(
    description,
  )
  expect(screen.getByTestId('profilePosts')).toBeTruthy()
})

test('an incomplete cached profile still waits for full profile data', async () => {
  jest.mocked(useProfileQuery).mockReturnValue({
    data: {did: 'did:plc:alice', handle: 'alice.test'},
    isPlaceholderData: true,
    isPending: false,
  } as never)
  jest.mocked(useAppviewClient).mockReturnValue({call: jest.fn()} as never)

  renderProfile()

  expect(screen.queryByTestId('profileHeaderDescription')).toBeNull()
  expect(screen.queryByTestId('profileTabs')).toBeNull()
  expect(screen.queryByTestId('profilePosts')).toBeNull()
  await act(async () => {})
})
