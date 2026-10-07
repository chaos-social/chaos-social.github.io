import {Rect} from 'react-native-svg'
import {render} from '@testing-library/react-native'

import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {UserAvatar} from '#/view/com/util/UserAvatar'

jest.mock('#/state/preferences/enable-square-avatars', () => ({
  useEnableSquareAvatars: jest.fn(() => true),
}))
jest.mock('#/state/preferences/enable-square-buttons', () => ({
  useEnableSquareButtons: () => false,
}))
jest.mock('#/state/preferences/image-cdn-host', () => ({
  useImageCdnHost: () => undefined,
  applyImageTransforms: (uri: string) => uri,
}))
jest.mock('#/state/preferences/thumbnail-format', () => ({
  useThumbnailFormat: () => 'default',
}))
jest.mock('#/alf', () => ({
  atoms: {rounded_md: {borderRadius: 8}},
  useTheme: () => ({
    atoms: {},
    palette: {contrast_25: '#222', primary_500: '#f00'},
  }),
  platform: ({native}: {native: unknown}) => native,
}))
jest.mock('#/features/themes/accentForeground', () => ({
  accentForeground: () => '#fff',
}))
jest.mock('#/lib/haptics', () => ({}))
jest.mock('#/lib/hooks/usePermissions', () => ({}))
jest.mock('#/lib/media/manip', () => ({}))
jest.mock('#/lib/media/picker', () => ({}))
jest.mock('#/state/gallery', () => ({}))
jest.mock('#/state/queries/unstable-profile-cache', () => ({}))
jest.mock('#/view/com/composer/photos/EditImageDialog', () => ({}))
jest.mock('#/components/Button', () => ({}))
jest.mock('#/components/Dialog', () => ({}))
jest.mock('#/components/Dialog/sheet-wrapper', () => ({}))
jest.mock('#/components/Link', () => ({}))
jest.mock('#/components/Menu', () => ({}))
jest.mock('#/components/ProfileHoverCard', () => ({}))
jest.mock('#/analytics', () => ({}))
jest.mock('#/features/liveNow', () => ({}))
jest.mock('#/features/liveNow/components/LiveIndicator', () => ({}))
jest.mock('#/features/liveNow/components/LiveStatusDialog', () => ({}))

beforeEach(() => {
  jest.mocked(useEnableSquareAvatars).mockReturnValue(true)
})

it.each(['algo', 'list'] as const)(
  'updates %s feed avatars when sharp is selected, including explicit shape overrides',
  type => {
    const avatar = () => (
      <UserAvatar
        type={type}
        size={40}
        avatar="https://example.com/avatar.jpg"
        shape="circle"
        extraAviStyle={{borderRadius: 16, borderTopLeftRadius: 8}}
        usePlainRNImage
      />
    )
    const {getByTestId, rerender} = render(avatar())
    expect(getByTestId('userAvatarImage')).toHaveStyle({borderRadius: 16})
    jest.mocked(useEnableSquareAvatars).mockReturnValue('sharp')
    rerender(avatar())
    expect(getByTestId('userAvatarImage')).toHaveStyle({
      borderRadius: 0,
      borderTopLeftRadius: 0,
    })
  },
)

it.each(['algo', 'list'] as const)(
  'renders the %s feed fallback with sharp corners',
  type => {
    jest.mocked(useEnableSquareAvatars).mockReturnValue('sharp')
    const {UNSAFE_getByType} = render(<UserAvatar type={type} size={40} />)
    expect((UNSAFE_getByType(Rect).props as {rx: number}).rx).toBe(0)
  },
)
