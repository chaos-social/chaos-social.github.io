import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {EmptyState} from '#/view/com/util/EmptyState'
import {Eye_Stroke2_Corner2_Rounded as EyeIcon} from '#/components/icons/Eye'
import * as Layout from '#/components/Layout'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'SeenPosts'>

export function SeenPostsScreen({}: Props) {
  const {t: l} = useLingui()

  return (
    <Layout.Screen testID="seenPostsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Seen Posts</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <PostFeed
        testID="seenPostsFeed"
        enabled
        feed="seen"
        disablePoll
        renderEmptyState={() => (
          <EmptyState icon={EyeIcon} message={l`No seen posts yet`} />
        )}
      />
    </Layout.Screen>
  )
}
