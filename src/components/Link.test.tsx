import {render, renderHook} from '@testing-library/react-native'

import {Link, useLink} from '#/components/Link'
import * as env from '#/env'

const mockOpenLink = jest.fn()
const mockDispatch = jest.fn()
const mockLinkWarningOpen = jest.fn()

jest.mock('#/env', () => ({IS_WEB: true, IS_NATIVE: false, IS_IOS: false}))
jest.mock('#/alf', () => ({
  atoms: {},
  web: (value: unknown) => value,
}))
jest.mock('#/components/Button', () => ({
  Button:
    jest.requireActual<typeof import('react-native')>('react-native').View,
}))
jest.mock('#/components/Typography', () => ({Text: 'Text'}))
jest.mock('#/components/PeekMenu', () => ({}))
jest.mock('#/components/icons/ArrowShareRight', () => ({}))
jest.mock('#/components/hooks/useInteractionState', () => ({}))
jest.mock('#/lib/constants', () => ({}))
jest.mock('#/lib/hooks/useIntentHandler', () => ({
  useGroupChatJoinIntent: () => jest.fn(),
}))
jest.mock('#/lib/hooks/useNavigationDeduped', () => ({
  useNavigationDeduped: () => ({
    dispatch: mockDispatch,
    getState: () => ({routeNames: ['Profile']}),
  }),
}))
jest.mock('#/lib/hooks/useOpenLink', () => ({
  useOpenLink: () => mockOpenLink,
}))
jest.mock('#/lib/sharing', () => ({}))
jest.mock('#/lib/strings/url-helpers', () => ({
  ...jest.requireActual('#/lib/strings/url-helpers'),
}))
jest.mock('#/state/preferences', () => ({useGoLinksEnabled: () => false}))
jest.mock('#/state/preferences/in-app-browser', () => ({}))
jest.mock('#/routes', () => ({
  router: {matchPath: () => ['Profile', {name: 'example.test'}]},
}))
jest.mock('#/components/dialogs/Context', () => ({
  useGlobalDialogsControlContext: () => ({
    linkWarningDialogControl: {open: mockLinkWarningOpen},
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

it('preserves navigation markers on notification and list links', () => {
  const {getByTestId} = render(
    <Link
      to="/profile/example.test"
      label="Notification"
      testID="notification"
      dataSet={{keyboardNavigationItem: 'true'}}>
      <></>
    </Link>,
  )

  expect(getByTestId('notification').props.dataSet).toEqual({
    keyboardNavigationItem: 'true',
    noUnderline: '1',
  })
})

it.each([
  'steam://launch/3817250',
  'spotify://track/123',
  'custom+app.v2-test://open/item',
  'tel:+15551234567',
])('opens %s externally without dispatching navigation', to => {
  const {result} = renderHook(() => useLink({to, displayText: to}))
  const preventDefault = jest.fn()

  result.current.onPress({button: 0, preventDefault} as never)

  expect(preventDefault).toHaveBeenCalled()
  expect(mockOpenLink).toHaveBeenCalledWith(to, undefined, false)
  expect(mockDispatch).not.toHaveBeenCalled()
  expect(mockLinkWarningOpen).not.toHaveBeenCalled()
})

it.each(['javascript:alert(1)', 'data:text/html,test', 'vbscript:msgbox(1)'])(
  'sanitizes unsafe URI schemes: %s',
  to => {
    const {result} = renderHook(() => useLink({to, displayText: ''}))

    expect(result.current.href).toBe('about:blank')
  },
)

it('warns when an app link is disguised as a different destination', () => {
  const {result} = renderHook(() =>
    useLink({to: 'spotify://track/123', displayText: 'example.com'}),
  )

  result.current.onPress({button: 0, preventDefault: jest.fn()} as never)

  expect(mockLinkWarningOpen).toHaveBeenCalledWith({
    displayText: 'example.com',
    href: 'spotify://track/123',
  })
  expect(mockOpenLink).not.toHaveBeenCalled()
  expect(mockDispatch).not.toHaveBeenCalled()
})

it.each(
  ['witchsky.app', 'mu.social', 'blacksky.community', 'northsky.app'].flatMap(
    host => [[host, false] as const, [host, true] as const],
  ),
)('keeps %s profile links in app navigation (native=%s)', (host, native) => {
  jest.replaceProperty(env, 'IS_NATIVE', native)
  jest.replaceProperty(env, 'IS_WEB', !native)
  const {result} = renderHook(() =>
    useLink({to: `https://${host}/profile/example.test`, displayText: ''}),
  )

  expect(result.current.href).toBe('/profile/example.test')
  result.current.onPress({button: 0, preventDefault: jest.fn()} as never)

  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'PUSH',
    payload: {name: 'Profile', params: {name: 'example.test'}},
  })
  expect(mockOpenLink).not.toHaveBeenCalled()
  expect(mockLinkWarningOpen).not.toHaveBeenCalled()
})
