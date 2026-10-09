import {Linking} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import {renderHook} from '@testing-library/react-native'

import {useOpenLink} from '#/lib/hooks/useOpenLink'

const mockConsentOpen = jest.fn()
const mockBrowserPreference = jest.fn<boolean | undefined, []>()

jest.mock('#/env', () => ({IS_NATIVE: true}))
jest.mock('#/analytics', () => ({useAnalytics: () => ({metric: jest.fn()})}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/alf', () => ({
  useTheme: () => ({atoms: {bg: {}}, palette: {}}),
}))
jest.mock('#/components/Dialog', () => ({
  useDialogContext: () => ({isWithinDialog: false}),
}))
jest.mock('#/components/dialogs/Context', () => ({
  useGlobalDialogsControlContext: () => ({
    inAppBrowserConsentControl: {open: mockConsentOpen},
  }),
}))
jest.mock('#/state/preferences/in-app-browser', () => ({
  useInAppBrowser: () => mockBrowserPreference(),
}))
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue(undefined),
  WebBrowserPresentationStyle: {FULL_SCREEN: 'fullScreen'},
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
})

it.each([true, false, undefined])(
  'hands app URLs to the system with browser preference %s',
  preference => {
    mockBrowserPreference.mockReturnValue(preference)
    const {result} = renderHook(useOpenLink)

    for (const url of [
      'steam://launch/3817250',
      'spotify://track/123',
      'SPOTIFY://track/123',
      'custom+app.v2-test://open/item',
      'mailto:hello@example.com',
      'tel:+15551234567',
    ]) {
      result.current(url, undefined, true)
      expect(Linking.openURL).toHaveBeenLastCalledWith(url)
    }

    result.current('spotify://track/123', true)
    expect(Linking.openURL).toHaveBeenLastCalledWith('spotify://track/123')
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled()
    expect(mockConsentOpen).not.toHaveBeenCalled()
  },
)

it('continues to ask for consent for web URLs', () => {
  mockBrowserPreference.mockReturnValue(undefined)
  const {result} = renderHook(useOpenLink)

  result.current('https://example.com')

  expect(mockConsentOpen).toHaveBeenCalledWith('https://example.com')
  expect(Linking.openURL).not.toHaveBeenCalled()
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled()
})

it('continues to open web URLs in the in-app browser when enabled', () => {
  mockBrowserPreference.mockReturnValue(true)
  const {result} = renderHook(useOpenLink)

  result.current('https://example.com')

  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
    'https://example.com',
    expect.any(Object),
  )
  expect(Linking.openURL).not.toHaveBeenCalled()
  expect(mockConsentOpen).not.toHaveBeenCalled()
})
