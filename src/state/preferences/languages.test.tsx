import {act, renderHook} from '@testing-library/react-native'

import * as persisted from '#/state/persisted'
import {defaults} from '#/state/persisted/schema'
import {Provider, useLanguagePrefs, useLanguagePrefsApi} from './languages'

jest.mock('#/state/persisted', () => ({
  defaults: jest.requireActual<typeof import('#/state/persisted/schema')>(
    '#/state/persisted/schema',
  ).defaults,
  get: jest.fn(),
  write: jest.fn(),
  onUpdate: jest.fn(() => () => {}),
}))
jest.mock('#/analytics', () => ({
  AnalyticsContext: ({children}: {children: React.ReactNode}) => children,
  utils: {useMeta: () => ({})},
}))

beforeEach(() => {
  jest.mocked(persisted.get).mockReturnValue({
    ...defaults.languagePrefs,
    primaryLanguage: 'fr',
    postLanguage: 'en,fil',
  })
  jest.mocked(persisted.write).mockImplementation((key, value) => {
    if (key === 'languagePrefs') {
      jest.mocked(persisted.get).mockReturnValue(value)
    }
    return Promise.resolve()
  })
})

function usePreferences() {
  return {prefs: useLanguagePrefs(), api: useLanguagePrefsApi()}
}

it('keeps the multilingual post default when the translation language changes', () => {
  const {result} = renderHook(usePreferences, {wrapper: Provider})

  act(() => result.current.api.setPrimaryLanguage('ja'))

  expect(result.current.prefs.primaryLanguage).toBe('ja')
  expect(result.current.prefs.postLanguage).toBe('en,fil')
})

it('saves an explicit post default independently and restores it on remount', () => {
  const {result, unmount} = renderHook(usePreferences, {wrapper: Provider})

  act(() => result.current.api.setPostLanguage('en,fil,ja'))

  expect(result.current.prefs.primaryLanguage).toBe('fr')
  expect(result.current.prefs.postLanguage).toBe('en,fil,ja')
  unmount()

  const restored = renderHook(usePreferences, {wrapper: Provider})
  expect(restored.result.current.prefs.postLanguage).toBe('en,fil,ja')
})

it('remembers a published post in history without replacing the saved default', () => {
  const {result} = renderHook(usePreferences, {wrapper: Provider})

  act(() => result.current.api.savePostLanguageToHistory('ja'))

  expect(result.current.prefs.postLanguageHistory[0]).toBe('ja')
  expect(result.current.prefs.postLanguage).toBe('en,fil')
  expect(result.current.prefs.primaryLanguage).toBe('fr')
})
