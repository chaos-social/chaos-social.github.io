import {act, fireEvent, render, renderHook} from '@testing-library/react-native'

import {copyUrl, shareUrl} from '#/lib/sharing'
import * as Menu from '#/components/Menu'
import {PostMenuButton} from '#/components/PostControls/PostMenu'
import {ShareMenuButton} from '#/components/PostControls/ShareMenu'
import {device} from '#/storage'
import {useCopyShareLinks} from '#/storage/hooks/copy-share-links'

jest.mock('#/components/Menu', () => {
  const {View} = require('react-native')
  const open = jest.fn()
  let currentControl:
    {open: (options: {sourceViewTag: number}) => void} | undefined

  return {
    __testOpen: open,
    Root: ({
      children,
      control,
    }: {
      children: React.ReactNode
      control: unknown
    }) => {
      currentControl = control as typeof currentControl
      return <View>{children}</View>
    },
    Trigger: ({
      children,
    }: {
      children: (args: {
        props: {accessibilityLabel: string; onPress: () => void}
      }) => React.ReactNode
    }) => {
      if (!currentControl) throw new Error('Menu root has not rendered')
      return children({
        props: {
          accessibilityLabel: 'Open menu',
          onPress: () => currentControl?.open({sourceViewTag: 42}),
        },
      })
    },
    useMenuControl: () => ({open}),
  }
})

jest.mock('#/components/PostControls/PostControlButton', () => {
  const {Pressable} = require('react-native')

  return {
    PostControlButton: ({
      children,
      label,
      onPress,
      onLongPress,
      testID,
    }: React.PropsWithChildren<{
      label?: string
      onPress?: () => void
      onLongPress?: () => void
      testID?: string
    }>) => (
      <Pressable
        accessibilityLabel={label}
        accessibilityHint=""
        onPress={onPress}
        onLongPress={onLongPress}
        testID={testID}>
        {children}
      </Pressable>
    ),
    PostControlButtonIcon: () => null,
  }
})

jest.mock('#/components/PostControls/PostMenu/PostMenuItems', () => {
  const {View} = require('react-native')
  return {PostMenuItems: () => <View testID="lazy-post-menu-items" />}
})
jest.mock('#/components/PostControls/ShareMenu/ShareMenuItems', () => {
  const {View} = require('react-native')
  return {ShareMenuItems: () => <View testID="lazy-share-menu-items" />}
})
jest.mock('#/view/com/util/EventStopper', () => ({
  EventStopper: ({children}: React.PropsWithChildren) => children,
}))
jest.mock('#/components/icons/DotGrid', () => ({
  DotGrid3x1_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/icons/ArrowShareRight', () => ({
  ArrowShareRight_Stroke2_Corner2_Rounded: () => null,
}))
jest.mock('#/components/PostControls/util', () => ({
  useFormatPostStatCount: () => String,
}))
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: jest.fn()}),
}))
jest.mock('#/state/feed-feedback', () => ({
  useFeedFeedbackContext: () => ({feedDescriptor: undefined}),
}))
jest.mock('#/lib/routes/links', () => ({
  makeProfileLink: () => '/profile/test/post/test',
}))
jest.mock('#/lib/sharing', () => ({
  copyUrl: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  shareUrl: jest
    .fn<Promise<undefined>, [string]>()
    .mockResolvedValue(undefined),
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/lib/strings/url-helpers', () => ({
  toShareUrl: () => 'https://witchsky.app/profile/test/post/test',
}))
jest.mock('#/alf', () => ({native: (callback: () => void) => callback}))
jest.mock('@lingui/react/macro', () => ({
  useLingui: () => ({t: (message: TemplateStringsArray) => message[0]}),
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: () => 'Open share menu'}),
}))

const mockMenuOpen = (Menu as unknown as {__testOpen: jest.Mock}).__testOpen

const post = {
  uri: 'at://did:plc:test/app.bsky.feed.post/test',
  author: {did: 'did:plc:test'},
}

afterEach(() => {
  device.remove(['copyShareLinks'])
  jest.clearAllMocks()
  jest.useRealTimers()
})

describe('lazy post menu anchoring', () => {
  it('forwards the trigger source tag after mounting post menu items', () => {
    jest.useFakeTimers()
    const screen = render(
      <PostMenuButton
        testID="post"
        post={post as never}
        postFeedContext={undefined}
        postReqId={undefined}
        record={{} as never}
        richText={{} as never}
        timestamp="2026-09-27T00:00:00.000Z"
        logContext="Post"
        forceGoogleTranslate={false}
      />,
    )

    fireEvent.press(screen.getByTestId('postDropdownBtn'))

    expect(screen.getByTestId('lazy-post-menu-items')).toBeTruthy()
    expect(mockMenuOpen).not.toHaveBeenCalled()

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(mockMenuOpen).toHaveBeenCalledWith({sourceViewTag: 42})
  })

  it('forwards the trigger source tag after mounting share menu items', () => {
    jest.useFakeTimers()
    const screen = render(
      <ShareMenuButton
        testID="post"
        post={post as never}
        record={{} as never}
        richText={{} as never}
        timestamp="2026-09-27T00:00:00.000Z"
        onShare={jest.fn()}
        logContext="Post"
      />,
    )

    fireEvent.press(screen.getByTestId('postShareBtn'))

    expect(screen.getByTestId('lazy-share-menu-items')).toBeTruthy()
    expect(mockMenuOpen).not.toHaveBeenCalled()

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(mockMenuOpen).toHaveBeenCalledWith({sourceViewTag: 42})
  })
})

it.each([false, true])(
  'remembers copy mode %s after remount and uses it on long press',
  async enabled => {
    const preference = renderHook(() => useCopyShareLinks())
    act(() => preference.result.current[1](enabled))
    preference.unmount()

    const restored = renderHook(() => useCopyShareLinks())
    expect(restored.result.current[0]).toBe(enabled)
    const onShare = jest.fn()
    const screen = render(
      <ShareMenuButton
        testID="post"
        post={post as never}
        record={{} as never}
        richText={{} as never}
        timestamp="2026-09-27T00:00:00.000Z"
        onShare={onShare}
        logContext="Post"
      />,
    )
    await act(async () => {
      fireEvent(screen.getByTestId('postShareBtn'), 'longPress')
      await Promise.resolve()
    })
    expect(enabled ? copyUrl : shareUrl).toHaveBeenCalledWith(
      'https://witchsky.app/profile/test/post/test',
    )
    expect(enabled ? shareUrl : copyUrl).not.toHaveBeenCalled()
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('lazy-share-menu-items')).toBeNull()
  },
)
