import {useCallback, useEffect, useMemo, useState} from 'react'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {getShapeStyle} from '#/lib/shapes'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {logger} from '#/logger'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useConfirmFollow} from '#/state/preferences/confirm-follow'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  useProfileFollowMutationQueue,
  useProfileQuery,
} from '#/state/queries/profile'
import {type SessionAccount, useRequireAuth, useSession} from '#/state/session'
import {atoms as a, useBreakpoints} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FollowConfirmationDialog} from '#/components/dialogs/FollowConfirmationDialog'
import {EphemeralAccountSwitcher} from '#/components/EphemeralAccountSwitcher'
import {
  useEphemeralFollowAction,
  useEphemeralFollowIntent,
} from '#/components/hooks/useEphemeralFollowAction'
import {
  Check_Stroke2_Corner0_Rounded as CheckIcon,
  DoubleCheck_Stroke2_Corner0_Rounded as DoubleCheckIcon,
} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {IS_IOS} from '#/env'
import {type app} from '#/lexicons'
import {GrowthHack} from './GrowthHack'

export function ThreadItemAnchorFollowButton({
  did,
  enabled = true,
}: {
  did: string
  enabled?: boolean
}) {
  if (IS_IOS) {
    return (
      <GrowthHack>
        <ThreadItemAnchorFollowButtonInner did={did} enabled={enabled} />
      </GrowthHack>
    )
  }

  return <ThreadItemAnchorFollowButtonInner did={did} enabled={enabled} />
}

export function ThreadItemAnchorFollowButtonInner({
  did,
  enabled = true,
}: {
  did: string
  enabled?: boolean
}) {
  const {data: profile, isLoading} = useProfileQuery({did})

  // We will never hit this - the profile will always be cached or loaded above
  // but it keeps the typechecker happy
  if (!enabled || isLoading || !profile) return null

  return <PostThreadFollowBtnLoaded profile={profile} />
}

function PostThreadFollowBtnLoaded({
  profile: profileUnshadowed,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const navigation = useNavigation()
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const profile = useProfileShadow(profileUnshadowed)
  const {accounts, currentAccount} = useSession()
  const [queueFollow, queueUnfollow] = useProfileFollowMutationQueue(
    profile,
    'PostThreadItem',
  )
  const requireAuth = useRequireAuth()
  const onSelectEphemeralAccount = useEphemeralFollowAction({
    profile,
    logContext: 'PostThreadItem',
  })
  const getEphemeralFollowAction = useEphemeralFollowIntent({
    profile,
    onAuthenticated: onSelectEphemeralAccount,
  })
  const confirmFollow = useConfirmFollow()
  const promptControl = Prompt.usePromptControl()
  const [confirmationAction, setConfirmationAction] = useState<
    'follow' | 'unfollow'
  >('follow')
  const [pendingEphemeralAccount, setPendingEphemeralAccount] =
    useState<SessionAccount | null>(null)

  const isFollowing = !!profile.viewer?.following
  const isFollowedBy = !!profile.viewer?.followedBy
  const [wasFollowing, setWasFollowing] = useState<boolean>(isFollowing)

  const enableSquareButtons = useEnableSquareButtons()
  const hasAlternateAccounts = accounts.some(
    account => account.did !== currentAccount?.did,
  )

  // This prevents the button from disappearing as soon as we follow.
  const showFollowBtn = useMemo(
    () => !isFollowing || !wasFollowing,
    [isFollowing, wasFollowing],
  )

  /**
   * We want this button to stay visible even after following, so that the user can unfollow if they want.
   * However, we need it to disappear after we push to a screen and then come back. We also need it to
   * show up if we view the post while following, go to the profile and unfollow, then come back to the
   * post.
   *
   * We want to update wasFollowing both on blur and on focus so that we hit all these cases. On native,
   * we could do this only on focus because the transition animation gives us time to not notice the
   * sudden rendering of the button. However, on web if we do this, there's an obvious flicker once the
   * button renders. So, we update the state in both cases.
   */
  useEffect(() => {
    const updateWasFollowing = () => {
      if (wasFollowing !== isFollowing) {
        setWasFollowing(isFollowing)
      }
    }

    const unsubscribeFocus = navigation.addListener('focus', updateWasFollowing)
    const unsubscribeBlur = navigation.addListener('blur', updateWasFollowing)

    return () => {
      unsubscribeFocus()
      unsubscribeBlur()
    }
  }, [isFollowing, wasFollowing, navigation])

  const executeFollow = useCallback(async () => {
    try {
      await queueFollow()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        logger.error('Failed to follow', {message: String(e)})
        Toast.show(_(msg`There was an issue! ${e.toString()}`), {
          type: 'error',
        })
      }
    }
  }, [queueFollow, _])

  const executeUnfollow = useCallback(async () => {
    try {
      await queueUnfollow()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        logger.error('Failed to unfollow', {message: String(e)})
        Toast.show(_(msg`There was an issue! ${e.toString()}`), {
          type: 'error',
        })
      }
    }
  }, [queueUnfollow, _])

  const onConfirm = useCallback(() => {
    if (pendingEphemeralAccount) {
      void onSelectEphemeralAccount(pendingEphemeralAccount)
      setPendingEphemeralAccount(null)
    } else if (confirmationAction === 'follow') {
      void executeFollow()
    } else {
      void executeUnfollow()
    }
  }, [
    confirmationAction,
    executeFollow,
    executeUnfollow,
    pendingEphemeralAccount,
    onSelectEphemeralAccount,
  ])

  const onPress = useCallback(() => {
    if (!isFollowing) {
      requireAuth(() => {
        if (confirmFollow) {
          setConfirmationAction('follow')
          promptControl.open()
        } else {
          void executeFollow()
        }
      })
    } else {
      requireAuth(() => {
        setConfirmationAction('unfollow')
        promptControl.open()
      })
    }
  }, [
    isFollowing,
    requireAuth,
    confirmFollow,
    executeFollow,
    executeUnfollow,
    promptControl,
  ])

  if (!showFollowBtn) return null

  const renderFollowButton = (onLongPress?: () => void) => (
    <Button
      testID="followBtn"
      label={_(msg`Follow ${profile.handle}`)}
      onLongPress={onLongPress}
      onPress={onPress}
      size="small"
      color={isFollowing ? 'secondary' : 'secondary_inverted'}
      style={getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full)}>
      {gtMobile && (
        <ButtonIcon
          icon={
            isFollowing && isFollowedBy
              ? DoubleCheckIcon
              : isFollowing
                ? CheckIcon
                : PlusIcon
          }
          size="sm"
        />
      )}
      <ButtonText maxFontSizeMultiplier={2}>
        {!isFollowing ? (
          isFollowedBy ? (
            <Trans>Follow back</Trans>
          ) : (
            <Trans>Follow</Trans>
          )
        ) : isFollowedBy ? (
          <Trans>Mutuals</Trans>
        ) : (
          <Trans>Following</Trans>
        )}
      </ButtonText>
    </Button>
  )

  return (
    <>
      {currentAccount && hasAlternateAccounts ? (
        <EphemeralAccountSwitcher
          selectedDid={currentAccount.did}
          title={_(msg`Follow as`)}
          triggerBehavior="longPress"
          onSelectAccount={account => {
            void (async () => {
              const action = await getEphemeralFollowAction(account)
              if (!action) return
              if (action === 'unfollow' || confirmFollow) {
                setPendingEphemeralAccount(account)
                setConfirmationAction(action)
                promptControl.open()
              } else {
                void onSelectEphemeralAccount(account)
              }
            })()
          }}
          renderTrigger={({triggerProps}) =>
            renderFollowButton(triggerProps.onLongPress)
          }
        />
      ) : (
        renderFollowButton()
      )}
      <FollowConfirmationDialog
        control={promptControl}
        displayName={sanitizeDisplayName(profile.displayName || profile.handle)}
        handle={profile.handle}
        actionType={confirmationAction}
        onConfirm={onConfirm}
      />
    </>
  )
}
