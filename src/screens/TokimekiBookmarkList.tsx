import {useCallback, useMemo, useState} from 'react'
import {Pressable} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useInitialNumToRender} from '#/lib/hooks/useInitialNumToRender'
import {usePostViewTracking} from '#/lib/hooks/usePostViewTracking'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useDisableInfiniteScroll} from '#/state/preferences/disable-infinite-scroll'
import {Post} from '#/view/com/post/Post'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import {SettingsGear2_Stroke2_Corner0_Rounded as GearIcon} from '#/components/icons/SettingsGear2'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import * as Menu from '#/components/Menu'
import {usePaginatedList} from '#/components/Pagination'
import {PostFeedSkeleton} from '#/components/PostFeedSkeleton'
import * as Prompt from '#/components/Prompt'
import {IS_IOS} from '#/env'
import {useBookmarkListMutation} from '#/features/tokimeki/bookmarkListMutations'
import {
  useTokimekiBookmarkFeedQuery,
  useTokimekiBookmarkListsQuery,
} from '#/features/tokimeki/bookmarkLists'
import {CreateOrEditBookmarkListDialog} from '#/features/tokimeki/components/CreateOrEditBookmarkListDialog'
import {type app} from '#/lexicons'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'TokimekiBookmarkList'
>

export function TokimekiBookmarkListScreen({route, navigation}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const listId = route.params.listId
  const {data: listsData} = useTokimekiBookmarkListsQuery()
  const list = listsData?.bookmarks.find(item => String(item.id) === listId)
  const editControl = useDialogControl()
  const deleteControl = useDialogControl()
  const {mutate} = useBookmarkListMutation()

  return (
    <Layout.Screen testID="tokimekiBookmarkListScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {list?.name || l`Private list`}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot>
          {list ? (
            <Menu.Root>
              <Menu.Trigger label={l`List options`}>
                {({props}) => (
                  <Pressable {...props} style={[a.p_sm]}>
                    <GearIcon size="sm" fill={t.palette.contrast_500} />
                  </Pressable>
                )}
              </Menu.Trigger>
              <Menu.Outer>
                <Menu.Group>
                  <Menu.Item
                    label={l`Rename`}
                    onPress={() => editControl.open()}>
                    <Menu.ItemText>{l`Rename`}</Menu.ItemText>
                  </Menu.Item>
                  <Menu.Item
                    destructive
                    label={l`Delete list`}
                    onPress={() => deleteControl.open()}>
                    <Menu.ItemText>{l`Delete list`}</Menu.ItemText>
                    <Menu.ItemIcon icon={TrashIcon} position="right" />
                  </Menu.Item>
                </Menu.Group>
              </Menu.Outer>
            </Menu.Root>
          ) : null}
        </Layout.Header.Slot>
      </Layout.Header.Outer>
      {/* Layout.Screen does not constrain a bare list, so center the column here. */}
      <Layout.Center style={[a.flex_1]}>
        <Feed listId={listId} />
      </Layout.Center>
      {list ? (
        <>
          <Prompt.Basic
            control={deleteControl}
            title={l`Delete “${list.name}”?`}
            description={l`The posts saved in this list are removed with it. This cannot be undone.`}
            confirmButtonCta={l`Delete`}
            confirmButtonColor="negative"
            onConfirm={() => {
              mutate(
                {action: 'deleteList', id: list.id},
                {onSuccess: () => navigation.goBack()},
              )
            }}
          />
          <CreateOrEditBookmarkListDialog control={editControl} list={list} />
        </>
      ) : null}
    </Layout.Screen>
  )
}

function Feed({listId}: {listId: string}) {
  const {t: l} = useLingui()
  const initialNumToRender = useInitialNumToRender()
  const [isPTRing, setIsPTRing] = useState(false)
  const trackPostView = usePostViewTracking('Bookmarks')
  const paginated = useDisableInfiniteScroll()
  const resultQuery = useTokimekiBookmarkFeedQuery({listId, paginated})
  const pagination = usePaginatedList(resultQuery, paginated)
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = resultQuery
  const refetch = pagination.refresh

  const posts = useMemo(
    () => data?.pages.flatMap(page => page.posts) ?? [],
    [data],
  )

  const onRefresh = useCallback(async () => {
    setIsPTRing(true)
    try {
      await refetch()
    } finally {
      setIsPTRing(false)
    }
  }, [refetch])

  const onEndReached = useCallback(async () => {
    if (isFetchingNextPage || !hasNextPage || error) return
    try {
      await fetchNextPage()
    } catch {}
  }, [isFetchingNextPage, hasNextPage, error, fetchNextPage])

  if (isLoading) {
    return <PostFeedSkeleton />
  }

  if (posts.length === 0 && !error) {
    return (
      <EmptyState
        icon={LockIcon}
        message={l`Nothing saved in this list yet`}
        style={[a.pt_3xl]}
      />
    )
  }

  return (
    <List
      key={pagination.key}
      ref={pagination.ref}
      ListHeaderComponent={pagination.header}
      data={posts}
      renderItem={({item}) => <Post post={item} />}
      keyExtractor={(item: app.bsky.feed.defs.PostView) => item.uri}
      refreshing={isPTRing}
      onRefresh={() => void onRefresh()}
      onEndReached={paginated ? undefined : () => void onEndReached()}
      onEndReachedThreshold={4}
      onItemSeen={trackPostView}
      ListFooterComponent={
        pagination.footer ?? (
          <ListFooter
            isFetchingNextPage={isFetchingNextPage}
            error={cleanError(error)}
            onRetry={fetchNextPage}
            style={[posts.length === 0 && a.border_t_0]}
          />
        )
      }
      initialNumToRender={initialNumToRender}
      windowSize={9}
      maxToRenderPerBatch={IS_IOS ? 5 : 1}
      updateCellsBatchingPeriod={40}
      sideBorders={false}
    />
  )
}
