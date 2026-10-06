import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {searchActorsTypeahead} from '#/lib/api/search-actors-typeahead'
import {
  useActorAutocompleteFn,
  useActorAutocompleteQuery,
} from '#/state/queries/actor-autocomplete'
import {useAutocomplete} from '#/components/Autocomplete/useAutocomplete'

jest.mock('#/lib/api/search-actors-typeahead', () => ({
  searchActorsTypeahead: jest.fn(),
}))
jest.mock('#/state/session', () => ({useAppviewClient: () => ({})}))
jest.mock('#/state/queries/preferences', () => ({
  DEFAULT_LOGGED_OUT_PREFERENCES: {moderationPrefs: {}},
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/state/preferences/custom-appview-did', () => ({
  useCustomAppViewDid: () => ['did:web:api.blacksky.community'],
  useCustomAppViewUrl: () => ['https://api.blacksky.community'],
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderateProfile: () => ({ui: () => ({filter: false})}),
}))
jest.mock('#/components/Autocomplete/useAutocomplete/useEmojiSearch', () => ({
  useEmojiSearch: () => () => [],
}))

const profile = {did: 'did:plc:alice', handle: 'alice.test'} as const

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })
  jest.mocked(searchActorsTypeahead).mockResolvedValue({actors: [profile]})
  function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return {queryClient, Wrapper}
}

beforeEach(() => {
  jest.mocked(searchActorsTypeahead).mockClear()
})

it('uses the fallback helper for composer autocomplete and shares an array cache', async () => {
  const {queryClient, Wrapper} = setup()
  const {result, unmount} = renderHook(
    () => ({
      query: useActorAutocompleteQuery('alice'),
      autocomplete: useActorAutocompleteFn(),
    }),
    {wrapper: Wrapper},
  )
  await waitFor(() => expect(result.current.query.isSuccess).toBe(true))
  expect(result.current.query.data).toEqual([profile])
  await expect(result.current.autocomplete({query: 'alice'})).resolves.toEqual([
    profile,
  ])
  expect(searchActorsTypeahead).toHaveBeenCalledTimes(1)
  unmount()
  queryClient.clear()
})

it('uses the same fallback helper for search and sign-in suggestions while typing', async () => {
  const {queryClient, Wrapper} = setup()
  const {result, rerender, unmount} = renderHook(
    ({query}: {query: string}) => useAutocomplete({type: 'profile', query}),
    {wrapper: Wrapper, initialProps: {query: ''}},
  )
  for (const query of ['a', 'al', 'ali', 'alice']) {
    rerender({query})
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.items).toEqual([
      {
        key: profile.did,
        type: 'profile',
        value: '@alice.test',
        profile,
      },
    ])
    expect(searchActorsTypeahead).toHaveBeenLastCalledWith(expect.anything(), {
      q: query,
      limit: 8,
    })
  }
  unmount()
  queryClient.clear()
})
