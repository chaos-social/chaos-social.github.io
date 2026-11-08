import {memo, useMemo, useState} from 'react'
import {type Insets} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {useCleanError} from '#/lib/hooks/useCleanError'
import {type NavigationProp} from '#/lib/routes/types'
import {type Shadow} from '#/state/cache/post-shadow'
import {useFeedFeedbackContext} from '#/state/feed-feedback'
import {useBookmarkMutation} from '#/state/queries/bookmarks/useBookmarkMutation'
import {useRequireAuth, useSession} from '#/state/session'
import {EventStopper} from '#/view/com/util/EventStopper'
import {useTheme} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {
  Bookmark_Filled_Corner0_Rounded as BookmarkFilled,
  Bookmark_Stroke2_Corner0_Rounded as Bookmark,
} from '#/components/icons/Bookmark'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PlusSmall_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {SettingsGear2_Stroke2_Corner0_Rounded as GearIcon} from '#/components/icons/SettingsGear2'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import {useMenuControl} from '#/components/Menu'
import * as toast from '#/components/Toast'
import {useAnalytics} from '#/analytics'
import {useBookmarkListMutation} from '#/features/tokimeki/bookmarkListMutations'
import {
  useTokimekiBookmarkListsQuery,
  useTokimekiRelatedBookmarksQuery,
} from '#/features/tokimeki/bookmarkLists'
import {CreateOrEditBookmarkListDialog} from '#/features/tokimeki/components/CreateOrEditBookmarkListDialog'
import {type app} from '#/lexicons'
import {PostControlButton, PostControlButtonIcon} from './PostControlButton'

export const BookmarkButton = memo(function BookmarkButton({
  post,
  big,
  logContext,
  hitSlop,
  onLongPress,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  big?: boolean
  logContext: 'FeedItem' | 'PostThreadItem' | 'Post' | 'ImmersiveVideo'
  hitSlop?: Insets
  onLongPress?: () => void
}): React.ReactNode {
  const t = useTheme()
  const {t: l} = useLingui()
  const {hasSession} = useSession()
  const requireAuth = useRequireAuth()
  const {isBookmarked} = usePostBookmark({post, logContext})
  const menuControl = useMenuControl()
  const [hasBeenOpen, setHasBeenOpen] = useState(false)
  const lazyMenuControl = useMemo(
    () => ({
      ...menuControl,
      open(options?: Parameters<typeof menuControl.open>[0]) {
        setHasBeenOpen(true)
        // The menu body must be mounted before open() runs; RN lacks flushSync.
        setTimeout(() => menuControl.open(options))
      },
    }),
    [menuControl],
  )

  if (!hasSession) {
    return (
      <PostControlButton
        testID="postBookmarkBtn"
        big={big}
        active={isBookmarked}
        activeColor={t.palette.primary_500}
        label={l`Add to saved posts`}
        onPress={() => requireAuth(() => {})}
        onLongPress={onLongPress}
        hitSlop={hitSlop}>
        <PostControlButtonIcon
          icon={isBookmarked ? BookmarkFilled : Bookmark}
        />
      </PostControlButton>
    )
  }

  return (
    <EventStopper onKeyDown={false}>
      <Menu.Root control={lazyMenuControl}>
        <Menu.Trigger label={l`Save post`}>
          {({props}) => (
            <PostControlButton
              testID="postBookmarkBtn"
              big={big}
              active={isBookmarked}
              activeColor={t.palette.primary_500}
              label={props.accessibilityLabel}
              {...props}
              onLongPress={onLongPress}
              hitSlop={hitSlop}>
              <PostControlButtonIcon
                icon={isBookmarked ? BookmarkFilled : Bookmark}
              />
            </PostControlButton>
          )}
        </Menu.Trigger>
        {/*
         * Lazily mounted: the private-list queries must not run for every post
         * in a feed. Once opened it stays mounted, like PostMenuButton.
         */}
        {hasBeenOpen && <BookmarkMenu post={post} logContext={logContext} />}
      </Menu.Root>
    </EventStopper>
  )
})

function BookmarkMenu({
  post,
  logContext,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  logContext: 'FeedItem' | 'PostThreadItem' | 'Post' | 'ImmersiveVideo'
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {isBookmarked, toggleBookmark} = usePostBookmark({post, logContext})
  const {isPending, variables, mutate} = useBookmarkListMutation()
  const {
    data: listsData,
    isError: listsError,
    isLoading: listsLoading,
  } = useTokimekiBookmarkListsQuery()
  const {data: related} = useTokimekiRelatedBookmarksQuery(post.cid)
  const createDialogControl = useDialogControl()

  const lists = listsData?.bookmarks ?? []
  const relatedIds = related ?? []
  const inList = (id: number | string) => relatedIds.includes(String(id))
  const savingTo =
    isPending && variables?.action === 'addItem' ? variables.listId : null
  const removingFrom =
    isPending && variables?.action === 'removeItem' ? variables.listId : null

  return (
    <>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item
            testID="postBookmarkSaveBtn"
            label={
              isBookmarked ? l`Remove from saved posts` : l`Add to saved posts`
            }
            onPress={() => void toggleBookmark()}>
            <Menu.ItemText>
              {isBookmarked
                ? l`Remove from saved posts`
                : l`Add to saved posts`}
            </Menu.ItemText>
            <Menu.ItemIcon
              icon={isBookmarked ? BookmarkFilled : Bookmark}
              position="right"
            />
          </Menu.Item>
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          {listsError ? (
            <Menu.Item label={l`Private lists unavailable`} onPress={() => {}}>
              <Menu.ItemText>{l`Private lists unavailable`}</Menu.ItemText>
            </Menu.Item>
          ) : listsLoading ? (
            <Menu.Item
              disabled
              label={l`Loading private lists`}
              onPress={() => {}}>
              <Menu.ItemText>{l`Loading private lists…`}</Menu.ItemText>
              <Menu.ItemIcon icon={Loader} position="right" />
            </Menu.Item>
          ) : (
            lists.map(list => {
              const saved = inList(list.id)
              const busy = savingTo === list.id || removingFrom === list.id
              return (
                <Menu.Item
                  key={list.id}
                  testID={`postBookmarkListBtn-${list.id}`}
                  label={list.name}
                  disabled={isPending}
                  onPress={() =>
                    mutate(
                      saved
                        ? {action: 'removeItem', listId: list.id, cid: post.cid}
                        : {action: 'addItem', listId: list.id, post},
                    )
                  }>
                  <Menu.ItemText>{list.name}</Menu.ItemText>
                  <Menu.ItemIcon
                    icon={busy ? Loader : saved ? CheckIcon : PlusIcon}
                    position="right"
                  />
                </Menu.Item>
              )
            })
          )}
          <Menu.Item
            testID="postBookmarkNewListBtn"
            label={l`New private list`}
            onPress={() => createDialogControl.open()}>
            <Menu.ItemText>{l`New private list`}</Menu.ItemText>
            <Menu.ItemIcon icon={PlusIcon} position="right" />
          </Menu.Item>
          <Menu.Item
            testID="postBookmarkManageListsBtn"
            label={l`Manage private lists`}
            onPress={() => navigation.navigate('TokimekiBookmarkLists')}>
            <Menu.ItemText>{l`Manage private lists`}</Menu.ItemText>
            <Menu.ItemIcon icon={GearIcon} position="right" />
          </Menu.Item>
        </Menu.Group>
      </Menu.Outer>
      <CreateOrEditBookmarkListDialog control={createDialogControl} />
    </>
  )
}

/**
 * Saves a post to the viewer's saved posts, or removes it, with the bookmark
 * button's metrics and toasts. Removing offers an undo.
 */
export function usePostBookmark({
  post,
  logContext,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  logContext: 'FeedItem' | 'PostThreadItem' | 'Post' | 'ImmersiveVideo'
}) {
  const ax = useAnalytics()
  const {t: l} = useLingui()
  const {mutateAsync: bookmark} = useBookmarkMutation()
  const cleanError = useCleanError()
  const {feedDescriptor} = useFeedFeedbackContext()

  const isBookmarked = !!post.viewer?.bookmarked

  const undoLabel = l({
    message: `Undo`,
    context: `Button label to undo saving/removing a post from saved posts.`,
  })

  const save = async () => {
    try {
      await bookmark({
        action: 'create',
        post,
      })

      ax.metric('post:bookmark', {
        uri: post.uri,
        authorDid: post.author.did,
        logContext,
        feedDescriptor,
      })
      return true
    } catch (e: any) {
      const {raw, clean} = cleanError(e)
      toast.show(clean || raw || e, {
        type: 'error',
      })
      return false
    }
  }

  const remove = async () => {
    try {
      await bookmark({
        action: 'delete',
        uri: post.uri,
      })

      ax.metric('post:unbookmark', {
        uri: post.uri,
        authorDid: post.author.did,
        logContext,
        feedDescriptor,
      })

      toast.show(
        <toast.Outer>
          <toast.Icon icon={TrashIcon} />
          <toast.Text>
            <Trans>Removed from saved posts</Trans>
          </toast.Text>
          <toast.Action label={undoLabel} onPress={() => save()}>
            {undoLabel}
          </toast.Action>
        </toast.Outer>,
      )
    } catch (e: any) {
      const {raw, clean} = cleanError(e)
      toast.show(clean || raw || e, {
        type: 'error',
      })
    }
  }

  /**
   * Resolves with `'saved'` once a save succeeds, for callers that confirm it
   * themselves. Removing confirms with its own toast.
   */
  const toggleBookmark = async (): Promise<'saved' | undefined> => {
    if (isBookmarked) {
      await remove()
    } else if (await save()) {
      return 'saved'
    }
  }

  return {isBookmarked, toggleBookmark}
}
