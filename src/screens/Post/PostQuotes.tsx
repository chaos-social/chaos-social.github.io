import {useEffect, useMemo, useState} from 'react'
import {View} from 'react-native'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useSetTitle} from '#/lib/hooks/useSetTitle'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import * as persisted from '#/state/persisted'
import {usePostQuery} from '#/state/queries/post'
import {type QuotesSort} from '#/state/queries/post-quotes'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {Pager} from '#/view/com/pager/Pager'
import {TabBar} from '#/view/com/pager/TabBar'
import {PostQuotes as PostQuotesComponent} from '#/view/com/post-thread/PostQuotes'
import {hasQuoteChain} from '#/screens/Post/QuoteChain/util'
import {atoms as a, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLink} from '#/components/icons/ChainLink'
import {
  ChevronBottomTop_Stroke2_Corner0_Rounded as ChevronIn,
  ChevronTopBottom_Stroke2_Corner0_Rounded as ChevronOut,
} from '#/components/icons/Chevron'
import * as Layout from '#/components/Layout'
import {AnalyticsContext, useAnalytics, utils} from '#/analytics'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PostQuotes'>
export const PostQuotesScreen = ({route, navigation}: Props) => {
  const {t: l} = useLingui()
  const {name, rkey} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  const {data: post} = usePostQuery(uri)

  const {data: resolvedDid} = useResolveDidQuery(name)
  const {data: profile} = useProfileQuery({did: resolvedDid})
  const [isQuotedPostExtracted, setIsQuotedPostExtracted] = useState(
    Boolean(persisted.get('extractQuotedPost')),
  )

  useEffect(() => {
    return persisted.onUpdate('extractQuotedPost', value => {
      setIsQuotedPostExtracted(Boolean(value))
    })
  }, [])

  const onToggleQuotedPost = () => {
    const nextValue = !isQuotedPostExtracted
    setIsQuotedPostExtracted(nextValue)
    void persisted.write('extractQuotedPost', nextValue)
  }

  useSetTitle(profile ? l`Post by @${profile.handle}` : undefined)

  const header = (
    <Layout.Header.Outer noBottomBorder>
      <Layout.Header.BackButton />
      <Layout.Header.Content>
        {post && (
          <>
            <Layout.Header.TitleText>
              <Trans>Quotes</Trans>
            </Layout.Header.TitleText>
            <Layout.Header.SubtitleText>
              <Plural
                value={post.quoteCount ?? 0}
                one="# quote"
                other="# quotes"
              />
            </Layout.Header.SubtitleText>
          </>
        )}
      </Layout.Header.Content>
      {hasQuoteChain(post?.embed) && (
        <Layout.Header.Slot>
          <Button
            testID="quoteChainButton"
            label={l`View quote chain`}
            size="small"
            color="secondary"
            variant="ghost"
            shape="round"
            onPress={() => navigation.push('PostQuoteChain', {name, rkey})}>
            <ButtonIcon icon={ChainLink} size="md" />
          </Button>
        </Layout.Header.Slot>
      )}
      <Layout.Header.Slot>
        {post && (
          <Button
            label={
              isQuotedPostExtracted
                ? l`Show quoted post in each quote`
                : l`Extract quoted post`
            }
            size="small"
            variant="ghost"
            color={isQuotedPostExtracted ? 'primary' : 'secondary'}
            shape="round"
            hitSlop={HITSLOP_10}
            onPress={onToggleQuotedPost}>
            <ButtonIcon
              icon={isQuotedPostExtracted ? ChevronOut : ChevronIn}
              size="md"
            />
          </Button>
        )}
      </Layout.Header.Slot>
    </Layout.Header.Outer>
  )

  return (
    <Layout.Screen>
      <SortedPostQuotes
        uri={uri}
        header={header}
        quotedPost={post}
        isQuotedPostExtracted={isQuotedPostExtracted}
      />
    </Layout.Screen>
  )
}

/**
 * Top / Latest tabs, following the hashtag screen. Each tab only fetches once
 * it has been selected.
 */
function SortedPostQuotes({
  uri,
  header,
  quotedPost,
  isQuotedPostExtracted,
}: {
  uri: string
  header: React.ReactNode
  quotedPost: React.ComponentProps<typeof PostQuotesComponent>['quotedPost']
  isQuotedPostExtracted: boolean
}) {
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const [activeTab, setActiveTab] = useState(0)

  const trackTabView = useNonReactiveCallback(() => {
    ax.metric('post:quotes:view', {
      uri,
      quoteSort: activeTab === 0 ? 'top' : 'latest',
    })
  })
  useEffect(() => {
    trackTabView()
  }, [activeTab, trackTabView, uri])

  const sections = useMemo(
    () => [
      {
        title: l`Top`,
        component: (
          <PostQuotesTab
            uri={uri}
            quoteSort="top"
            active={activeTab === 0}
            quotedPost={quotedPost}
            isQuotedPostExtracted={isQuotedPostExtracted}
          />
        ),
      },
      {
        title: l`Latest`,
        component: (
          <PostQuotesTab
            uri={uri}
            quoteSort="latest"
            quotedPost={quotedPost}
            isQuotedPostExtracted={isQuotedPostExtracted}
            active={activeTab === 1}
          />
        ),
      },
    ],
    [l, uri, activeTab, quotedPost, isQuotedPostExtracted],
  )

  return (
    <Pager
      onPageSelected={setActiveTab}
      renderTabBar={props => (
        <Layout.Center style={[a.z_10, web([a.sticky, {top: 0}])]}>
          {header}
          <TabBar items={sections.map(section => section.title)} {...props} />
        </Layout.Center>
      )}
      initialPage={0}>
      {sections.map((section, i) => (
        <View key={i}>{section.component}</View>
      ))}
    </Pager>
  )
}

function PostQuotesTab({
  uri,
  quoteSort,
  active,
  quotedPost,
  isQuotedPostExtracted,
}: {
  uri: string
  quoteSort: QuotesSort
  active: boolean
  quotedPost: React.ComponentProps<typeof PostQuotesComponent>['quotedPost']
  isQuotedPostExtracted: boolean
}) {
  const metadata = utils.useMeta({postQuotes: {uri, quoteSort}})

  return (
    <AnalyticsContext metadata={metadata}>
      <PostQuotesComponent
        uri={uri}
        quoteSort={quoteSort}
        active={active}
        quotedPost={quotedPost}
        isQuotedPostExtracted={isQuotedPostExtracted}
      />
    </AnalyticsContext>
  )
}
