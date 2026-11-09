import {render} from '@testing-library/react-native'

import {Embed, PostEmbedViewContext} from './index'

jest.mock('#/features/events/components/EventEmbed', () => ({
  EventEmbed: () => null,
}))
jest.mock('#/Navigation', () => ({}))
jest.mock('#/state/session', () => ({}))
jest.mock('#/state/queries/profile', () => ({}))
jest.mock('#/lib/haptics', () => ({}))
jest.mock('#/state/queries/direct-fetch-record', () => ({
  // Avoid loading the real module (and its expo deps); only LRU is used here.
  LRU: class {
    async getOrInsertWith(_key: string, fn: () => Promise<unknown>) {
      return fn()
    }
    async getOrTryInsertWith(_key: string, fn: () => Promise<unknown>) {
      return fn()
    }
  },
}))
jest.mock('#/alf', () => ({
  atoms: jest.requireActual<typeof import('@bsky.app/alf')>('@bsky.app/alf').atoms,
  platform: (value: unknown) => value,
  tokens: jest.requireActual<typeof import('#/alf/tokens')>('#/alf/tokens'),
  useScheme: () => 'light',
  useTheme: () => ({}),
}))
jest.mock('#/state/preferences/see-through-blocks', () => ({
  useSeeThroughBlocks: () => false,
}))
jest.mock('#/state/queries/see-through-blocks', () => ({
  useUnblockedPostQuery: () => ({}),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => undefined,
}))
jest.mock('#/components/moderation/ContentHider', () => ({
  ContentHider: ({children}: React.PropsWithChildren) => children,
}))
jest.mock('#/components/Post/Embed/StandardSiteEmbed', () => {
  const {View} = jest.requireActual('react-native')
  return {
    StandardSiteEmbed: (props: object) => (
      <View testID="standard-card" {...props} />
    ),
  }
})
jest.mock('#/components/Post/Embed/AtCard', () => ({}))
jest.mock('#/components/Post/Embed/AtCard/providers', () => ({
  getAtCardProvider: () => undefined,
}))
jest.mock('#/components/Post/Embed/StandardSiteEmbed/utils', () => ({
  isStandardSiteEmbed: () => true,
}))
jest.mock('#/components/Post/Embed/ThemeEmbed', () => ({}))
jest.mock('#/components/Post/Embed/ThemeEmbed/utils', () => ({
  isThemeEmbed: () => false,
}))
jest.mock('#/components/Post/Embed/GameEmbed', () => ({}))
jest.mock('#/components/Post/Embed/GameEmbed/utils', () => ({
  getGameEmbedFromRecord: () => undefined,
}))
jest.mock('#/components/images/Gallery', () => ({}))
jest.mock('#/components/moderation/PostAlerts', () => ({}))
jest.mock('#/components/PostTags', () => ({}))
jest.mock('#/components/RichText', () => ({}))
jest.mock('#/components/StarterPack/StarterPackCard', () => ({}))
jest.mock('#/view/com/util/Link', () => ({}))
jest.mock('#/view/com/util/PostMeta', () => ({}))
jest.mock('#/screens/PostThread/components/ThreadItemPostNumber', () => ({}))
jest.mock('./ChatInviteEmbed', () => ({}))
jest.mock('./ExternalEmbed', () => ({}))
jest.mock('./FeedEmbed', () => ({}))
jest.mock('./ImageEmbed', () => ({}))
jest.mock('./ListEmbed', () => ({}))
jest.mock('./PostPlaceholder', () => ({}))
jest.mock('./VideoEmbed', () => ({}))

it('keeps the carousel context when rich external cards go through their moderation wrapper', () => {
  const {getByTestId} = render(
    <Embed
      embed={{
        $type: 'app.bsky.embed.external#view',
        external: {
          uri: 'https://example.test/article',
          title: 'Article',
          description: '',
        },
      }}
      viewContext={PostEmbedViewContext.FeedCarousel}
    />,
  )
  expect(getByTestId('standard-card').props.viewContext).toBe(
    PostEmbedViewContext.FeedCarousel,
  )
})
