import {memo, useMemo, useState} from 'react'
import {Pressable, View} from 'react-native'
import {
  moderateProfile,
  type ModerationDecision,
  type ModerationOpts,
} from '@bsky/sdk/moderation'
import {type RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {isFollowedByMetricHidden} from '#/lib/metrics-display'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {formatJoinDate, niceDate} from '#/lib/strings/time'
import {logger} from '#/logger'
import {type Shadow, useProfileShadow} from '#/state/cache/profile-shadow'
import {useShowGermDmButton} from '#/state/preferences'
import {useConfirmFollow} from '#/state/preferences/confirm-follow'
import {useHideScaryFollowButtons} from '#/state/preferences/hide-scary-follow-buttons'
import {useFollowedByMetricsDisplay} from '#/state/preferences/metrics-display-preference'
import {useShowFollowedByOnOwnProfile} from '#/state/preferences/show-followed-by-on-own-profile'
import {
  useProfileBlockMutationQueue,
  useProfileFollowMutationQueue,
} from '#/state/queries/profile'
import {type SessionAccount, useRequireAuth, useSession} from '#/state/session'
import {ProfileMenu} from '#/view/com/profile/ProfileMenu'
import {atoms as a, native, platform, tokens, useTheme, web} from '#/alf'
import {SubscribeProfileButton} from '#/components/activity-notifications/SubscribeProfileButton'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {DebugFieldDisplay} from '#/components/DebugFieldDisplay'
import {useDialogControl} from '#/components/Dialog'
import {FollowConfirmationDialog} from '#/components/dialogs/FollowConfirmationDialog'
import {MessageProfileButton} from '#/components/dms/MessageProfileButton'
import {EphemeralAccountSwitcher} from '#/components/EphemeralAccountSwitcher'
import {
  useEphemeralFollowAction,
  useEphemeralFollowIntent,
} from '#/components/hooks/useEphemeralFollowAction'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ArrowShareRight} from '#/components/icons/ArrowShareRight'
import {CalendarDays_Stroke2_Corner0_Rounded as CalendarDays} from '#/components/icons/CalendarDays'
import {
  Check_Stroke2_Corner0_Rounded as Check,
  DoubleCheck_Stroke2_Corner0_Rounded as DoubleCheck,
} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {
  KnownFollowers,
  shouldShowKnownFollowers,
} from '#/components/KnownFollowers'
import * as Prompt from '#/components/Prompt'
import {PronounPill} from '#/components/PronounPill'
import {RichText} from '#/components/RichText'
import * as Toast from '#/components/Toast'
import * as Tooltip from '#/components/Tooltip'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_IOS, IS_NATIVE} from '#/env'
import {InviteFriendsDialog} from '#/features/inviteFriends'
import {useActorStatus} from '#/features/liveNow'
import {ProfileHeaderLinks} from '#/features/profileLinks'
import {type app} from '#/lexicons'
import {GermButton, isGermButtonShown} from '../components/GermButton'
import {ProfileHeaderDisplayName} from './DisplayName'
import {EditProfileDialog} from './EditProfileDialog'
import {ProfileHeaderHandle} from './Handle'
import {ProfileHeaderMetrics} from './Metrics'
import {
  LabelerLikeSection,
  LabelerSubscribeButton,
} from './ProfileHeaderLabeler'
import {ProfileHeaderShell} from './Shell'
import {ProfileHeaderSuggestedFollows} from './SuggestedFollows'
interface Props {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  descriptionRT: RichTextAPI | null
  moderationOpts: ModerationOpts
  hideBackButton?: boolean
  isPlaceholderProfile?: boolean
  labeler?: app.bsky.labeler.defs.LabelerViewDetailed
}

let ProfileHeaderStandard = ({
  profile: profileUnshadowed,
  labeler,
  descriptionRT,
  moderationOpts,
  hideBackButton = false,
  isPlaceholderProfile,
}: Props): React.ReactNode => {
  const t = useTheme()
  const profile =
    useProfileShadow<app.bsky.actor.defs.ProfileViewDetailed>(profileUnshadowed)
  const {currentAccount} = useSession()
  const {_, i18n} = useLingui()
  const showGermDmButton = useShowGermDmButton()
  const moderation = useMemo(
    () => moderateProfile(profile, moderationOpts),
    [profile, moderationOpts],
  )
  const [, queueUnblock] = useProfileBlockMutationQueue(profile)
  const unblockPromptControl = Prompt.usePromptControl()
  const [showSuggestedFollows, setShowSuggestedFollows] = useState(false)
  const [hasSeenAllSuggestedFollows, setHasSeenAllSuggestedFollows] =
    useState(false)
  const [joinDateTooltipVisible, setJoinDateTooltipVisible] = useState(false)
  const isBlockedUser =
    profile.viewer?.blocking ||
    profile.viewer?.blockedBy ||
    profile.viewer?.blockingByList

  const dateJoined = useMemo(() => {
    if (!profile.createdAt) return ''
    return formatJoinDate(profile.createdAt)
  }, [profile.createdAt])

  const dateJoinedExact = useMemo(() => {
    if (!profile.createdAt) return ''

    const createdAt = new Date(profile.createdAt)
    if (Number.isNaN(createdAt.getTime())) return ''

    return niceDate(i18n, createdAt)
  }, [i18n, profile.createdAt])

  const unblockAccount = async () => {
    try {
      await queueUnblock()
      Toast.show(_(msg({message: 'Account unblocked', context: 'toast'})))
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        logger.error('Failed to unblock account', {message: e})
        Toast.show(_(msg`There was an issue! ${e.toString()}`), {type: 'error'})
      }
    }
  }

  const onRequestHide = () => {
    setHasSeenAllSuggestedFollows(true)
    setShowSuggestedFollows(false)
  }

  const isMe = currentAccount?.did === profile.did

  const {isActive: live} = useActorStatus(profile)

  // disable metrics
  const followedByMetricsDisplay = useFollowedByMetricsDisplay()
  const showFollowedByOnOwnProfile = useShowFollowedByOnOwnProfile()
  const showKnownFollowers =
    (!isMe || showFollowedByOnOwnProfile) &&
    !isFollowedByMetricHidden(followedByMetricsDisplay) &&
    shouldShowKnownFollowers(profile.viewer?.knownFollowers)

  return (
    <>
      <ProfileHeaderShell
        profile={profile}
        moderation={moderation}
        hideBackButton={hideBackButton}
        isPlaceholderProfile={isPlaceholderProfile}>
        <View
          style={[a.px_lg, a.pt_md, a.pb_sm, web({zIndex: 10})]}
          pointerEvents={IS_IOS ? 'auto' : 'box-none'}>
          <View
            style={[native(a.overflow_hidden), web({overflowX: 'clip'})]}
            pointerEvents={IS_IOS ? 'auto' : 'box-none'}>
            <View
              style={[
                {paddingLeft: 90},
                a.flex_row,
                a.align_center,
                a.justify_end,
                a.gap_xs,
                a.pb_sm,
                a.flex_wrap,
              ]}
              pointerEvents={IS_IOS ? 'auto' : 'box-none'}>
              <HeaderStandardButtons
                profile={profile}
                moderation={moderation}
                moderationOpts={moderationOpts}
                onFollow={() => setShowSuggestedFollows(true)}
                onUnfollow={() => setShowSuggestedFollows(false)}
              />
            </View>
            <View
              style={[
                a.flex_col,
                a.gap_xs,
                a.pb_sm,
                live ? a.pt_sm : a.pt_2xs,
              ]}>
              <ProfileHeaderDisplayName
                profile={profile}
                moderation={moderation}
              />
              <ProfileHeaderHandle
                profile={profile}
                showPronouns={false}
                verticalPadding={2}
              />
            </View>
            {!isPlaceholderProfile && !isBlockedUser && (
              <View style={a.gap_md}>
                <ProfileHeaderMetrics profile={profile} />
                {descriptionRT && !moderation.ui('profileView').blur ? (
                  <View pointerEvents="auto">
                    <RichText
                      testID="profileHeaderDescription"
                      style={[a.text_md]}
                      numberOfLines={15}
                      selectable={platform({android: false, default: true})}
                      value={descriptionRT}
                      enableTags
                      authorHandle={profile.handle}
                      shouldProxyLinks={true}
                    />
                  </View>
                ) : undefined}

                <ProfileHeaderLinks
                  profile={profile}
                  hidden={!!moderation.ui('profileView').blur}
                  germButton={
                    showGermDmButton &&
                    isGermButtonShown(
                      profile.associated?.germ,
                      profile,
                      currentAccount?.did,
                    ) ? (
                      <GermButton
                        germ={profile.associated.germ}
                        profile={profile}
                      />
                    ) : undefined
                  }
                />
              </View>
            )}
          </View>

          <View
            style={[
              a.flex_row,
              a.flex_wrap,
              a.align_center,
              {gap: 10},
              a.pt_md,
              // Keep above Followed by / tabs so the join-date tooltip paints correctly
              web({position: 'relative', zIndex: 2}),
            ]}>
            <PronounPill pronouns={profile.pronouns} showLabel />

            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <CalendarDays
                width={tokens.space.lg}
                style={{color: t.atoms.text_contrast_medium.color}}
              />
              {IS_NATIVE && dateJoinedExact ? (
                <Tooltip.Outer
                  color="primary"
                  visible={joinDateTooltipVisible}
                  onVisibleChange={setJoinDateTooltipVisible}>
                  <Tooltip.Target>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={_(msg`Joined ${dateJoinedExact}`)}
                      accessibilityHint=""
                      onPress={() =>
                        setJoinDateTooltipVisible(visible => !visible)
                      }>
                      <Text style={[t.atoms.text_contrast_medium]}>
                        <Trans>Joined {dateJoined}</Trans>
                      </Text>
                    </Pressable>
                  </Tooltip.Target>
                  <Tooltip.BubbleText label={_(msg`Joined ${dateJoinedExact}`)}>
                    <Trans>Joined {dateJoinedExact}</Trans>
                  </Tooltip.BubbleText>
                </Tooltip.Outer>
              ) : (
                /* Position above so the sticky profile tab bar does not cover it */
                <Text
                  style={[t.atoms.text_contrast_medium]}
                  title={dateJoinedExact}
                  dataSet={web({tooltipPos: 'top'})}>
                  <Trans>Joined {dateJoined}</Trans>
                </Text>
              )}
            </View>
          </View>

          {!isPlaceholderProfile &&
            !isBlockedUser &&
            (showKnownFollowers || !!labeler) && (
              <View style={[a.gap_md, a.pt_md]}>
                {showKnownFollowers && (
                  <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                    <KnownFollowers
                      profile={profile}
                      moderationOpts={moderationOpts}
                      followedByDisplay={followedByMetricsDisplay}
                    />
                  </View>
                )}

                {labeler && (
                  <LabelerLikeSection labeler={labeler} profile={profile} />
                )}
              </View>
            )}

          <DebugFieldDisplay subject={profile} />
        </View>

        <Prompt.Basic
          control={unblockPromptControl}
          title={_(msg`Unblock Account?`)}
          description={_(
            msg`The account will be able to interact with you after unblocking.`,
          )}
          onConfirm={() => {
            void unblockAccount()
          }}
          confirmButtonCta={
            profile.viewer?.blocking ? _(msg`Unblock`) : _(msg`Block`)
          }
          confirmButtonColor="negative"
        />
      </ProfileHeaderShell>

      <ProfileHeaderSuggestedFollows
        isExpanded={!hasSeenAllSuggestedFollows && showSuggestedFollows}
        actorDid={profile.did}
        onRequestHide={onRequestHide}
      />
    </>
  )
}

ProfileHeaderStandard = memo(ProfileHeaderStandard)
export {ProfileHeaderStandard}

export function HeaderStandardButtons({
  profile,
  moderation,
  moderationOpts,
  onFollow,
  onUnfollow,
  minimal,
}: {
  profile: Shadow<app.bsky.actor.defs.ProfileViewDetailed>
  moderation: ModerationDecision
  moderationOpts: ModerationOpts
  onFollow?: () => void
  onUnfollow?: () => void
  minimal?: boolean
}) {
  const {_} = useLingui()
  const ax = useAnalytics()
  const {accounts, hasSession, currentAccount} = useSession()
  const playHaptic = useHaptics()
  const requireAuth = useRequireAuth()
  const [queueFollow, queueUnfollow] = useProfileFollowMutationQueue(
    profile,
    'ProfileHeader',
  )
  const [, queueUnblock] = useProfileBlockMutationQueue(profile)
  const editProfileControl = useDialogControl()
  const inviteFriendsControl = useDialogControl()
  const unblockPromptControl = Prompt.usePromptControl()
  const hideScaryFollowButtons = useHideScaryFollowButtons()
  const confirmFollow = useConfirmFollow()
  const followPromptControl = Prompt.usePromptControl()
  const [confirmationAction, setConfirmationAction] = useState<
    'follow' | 'unfollow'
  >('follow')
  const [pendingEphemeralAccount, setPendingEphemeralAccount] =
    useState<SessionAccount | null>(null)

  const onSelectEphemeralAccount = useEphemeralFollowAction({
    profile,
    logContext: 'ProfileHeader',
    onFollow,
    onUnfollow,
  })
  const getEphemeralFollowAction = useEphemeralFollowIntent({
    profile,
    onAuthenticated: onSelectEphemeralAccount,
  })
  const hasAlternateAccounts = accounts.some(
    account => account.did !== currentAccount?.did,
  )

  const isMe = currentAccount?.did === profile.did

  const executeFollow = async () => {
    try {
      await queueFollow()
      onFollow?.()
      Toast.show(
        _(
          msg`Following ${sanitizeDisplayName(
            profile.displayName || profile.handle,
            moderation.ui('displayName'),
          )}`,
        ),
      )
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        logger.error('Failed to follow', {message: String(e)})
        Toast.show(_(msg`There was an issue! ${e.toString()}`), {
          type: 'error',
        })
      }
    }
  }

  const executeUnfollow = async () => {
    try {
      await queueUnfollow()
      onUnfollow?.()
      Toast.show(
        _(
          msg`No longer following ${sanitizeDisplayName(
            profile.displayName || profile.handle,
            moderation.ui('displayName'),
          )}`,
        ),
        {type: 'default'},
      )
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        logger.error('Failed to unfollow', {message: String(e)})
        Toast.show(_(msg`There was an issue! ${e.toString()}`), {
          type: 'error',
        })
      }
    }
  }

  const onPressFollow = () => {
    playHaptic.confirm()
    requireAuth(() => {
      if (confirmFollow) {
        setConfirmationAction('follow')
        followPromptControl.open()
      } else {
        void executeFollow()
      }
    })
  }

  const onPressUnfollow = () => {
    playHaptic.confirm()
    setConfirmationAction('unfollow')
    followPromptControl.open()
  }

  const onConfirmFollowAction = () => {
    if (pendingEphemeralAccount) {
      void onSelectEphemeralAccount(pendingEphemeralAccount)
      setPendingEphemeralAccount(null)
    } else if (confirmationAction === 'follow') {
      void executeFollow()
    } else {
      void executeUnfollow()
    }
  }

  const unblockAccount = async () => {
    try {
      await queueUnblock()
      Toast.show(_(msg({message: 'Account unblocked', context: 'toast'})))
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        logger.error('Failed to unblock account', {message: e})
        Toast.show(_(msg`There was an issue! ${e.toString()}`), {type: 'error'})
      }
    }
  }

  const subscriptionsAllowed = useMemo(() => {
    switch (profile.associated?.activitySubscription?.allowSubscriptions) {
      case 'followers':
      case undefined:
        return !!profile.viewer?.following
      case 'mutuals':
        return !!profile.viewer?.following && !!profile.viewer.followedBy
      case 'none':
      default:
        return false
    }
  }, [profile])

  return (
    <>
      {isMe ? (
        <>
          <Button
            testID="profileHeaderEditProfileButton"
            size="small"
            color="secondary"
            onPress={() => {
              playHaptic.tap()
              editProfileControl.open()
            }}
            label={_(msg`Edit profile`)}>
            <ButtonText>
              <Trans>Edit Profile</Trans>
            </ButtonText>
          </Button>
          {/* Invite friends is a native-only share sheet (the dialog is a
              no-op on web), so gate the entry point to avoid a dead button. */}
          {IS_NATIVE && (
            <Button
              testID="profileHeaderShareButton"
              size="small"
              color="secondary"
              shape="round"
              // expand the 33pt button toward a 44pt touch target, capped
              // horizontally at half the 4pt row gap so the target cannot
              // overlap the neighboring buttons' own targets
              hitSlop={{top: 6, bottom: 6, left: 2, right: 2}}
              onPress={() => {
                playHaptic.tap()
                ax.metric('invite:dialog:open', {logContext: 'ProfileHeader'})
                inviteFriendsControl.open()
              }}
              label={_(msg`Invite friends`)}>
              <ButtonIcon icon={ArrowShareRight} />
            </Button>
          )}
          <EditProfileDialog profile={profile} control={editProfileControl} />
          {IS_NATIVE && <InviteFriendsDialog control={inviteFriendsControl} />}
        </>
      ) : (
        <>
          {profile.viewer?.blocking && !profile.viewer?.blockingByList ? (
            <Button
              testID="unblockBtn"
              size="small"
              color="secondary"
              label={_(msg`Unblock`)}
              disabled={!hasSession}
              onPress={() => unblockPromptControl.open()}>
              <ButtonText>
                <Trans context="action">Unblock</Trans>
              </ButtonText>
            </Button>
          ) : null}

          {hasSession &&
            !profile.viewer?.blocking &&
            !profile.viewer?.blockedBy &&
            (!minimal || profile.viewer?.following) && (
              <>
                {subscriptionsAllowed && (
                  <SubscribeProfileButton
                    profile={profile}
                    moderationOpts={moderationOpts}
                    disableHint={minimal}
                  />
                )}

                <MessageProfileButton profile={profile} />
              </>
            )}

          {!!profile.associated?.labeler && !minimal && (
            <LabelerSubscribeButton profile={profile} />
          )}

          {!profile.associated?.labeler &&
            (!minimal || !profile.viewer?.following) &&
            !(minimal && hideScaryFollowButtons) &&
            (currentAccount && hasAlternateAccounts ? (
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
                      followPromptControl.open()
                    } else {
                      void onSelectEphemeralAccount(account)
                    }
                  })()
                }}
                renderTrigger={({triggerProps}) => (
                  <Button
                    testID={
                      profile.viewer?.following ? 'unfollowBtn' : 'followBtn'
                    }
                    size="small"
                    color={profile.viewer?.following ? 'secondary' : 'primary'}
                    label={
                      profile.viewer?.following
                        ? _(msg`Unfollow ${profile.handle}`)
                        : _(msg`Follow ${profile.handle}`)
                    }
                    onLongPress={triggerProps.onLongPress}
                    onPress={
                      profile.viewer?.following
                        ? onPressUnfollow
                        : onPressFollow
                    }>
                    {profile.viewer?.following && profile.viewer?.followedBy ? (
                      <ButtonIcon icon={DoubleCheck} />
                    ) : !profile.viewer?.following ? (
                      <ButtonIcon icon={Plus} />
                    ) : (
                      <ButtonIcon icon={Check} />
                    )}
                    <ButtonText>
                      {profile.viewer?.following ? (
                        profile.viewer?.followedBy ? (
                          <Trans>Mutuals</Trans>
                        ) : (
                          <Trans>Following</Trans>
                        )
                      ) : profile.viewer?.followedBy ? (
                        <Trans>Follow back</Trans>
                      ) : (
                        <Trans>Follow</Trans>
                      )}
                    </ButtonText>
                  </Button>
                )}
              />
            ) : (
              <Button
                testID={profile.viewer?.following ? 'unfollowBtn' : 'followBtn'}
                size="small"
                color={profile.viewer?.following ? 'secondary' : 'primary'}
                label={
                  profile.viewer?.following
                    ? _(msg`Unfollow ${profile.handle}`)
                    : _(msg`Follow ${profile.handle}`)
                }
                onPress={
                  profile.viewer?.following ? onPressUnfollow : onPressFollow
                }>
                {profile.viewer?.following && profile.viewer?.followedBy ? (
                  <ButtonIcon icon={DoubleCheck} />
                ) : !profile.viewer?.following ? (
                  <ButtonIcon icon={Plus} />
                ) : (
                  <ButtonIcon icon={Check} />
                )}
                <ButtonText>
                  {profile.viewer?.following ? (
                    profile.viewer?.followedBy ? (
                      <Trans>Mutuals</Trans>
                    ) : (
                      <Trans>Following</Trans>
                    )
                  ) : profile.viewer?.followedBy ? (
                    <Trans>Follow back</Trans>
                  ) : (
                    <Trans>Follow</Trans>
                  )}
                </ButtonText>
              </Button>
            ))}
        </>
      )}
      <ProfileMenu profile={profile} />

      <Prompt.Basic
        control={unblockPromptControl}
        title={_(msg`Unblock Account?`)}
        description={_(
          msg`The account will be able to interact with you after unblocking.`,
        )}
        onConfirm={() => {
          void unblockAccount()
        }}
        confirmButtonCta={_(msg`Unblock`)}
        confirmButtonColor="negative"
      />
      <FollowConfirmationDialog
        control={followPromptControl}
        displayName={sanitizeDisplayName(
          profile.displayName || profile.handle,
          moderation.ui('displayName'),
        )}
        handle={profile.handle}
        actionType={confirmationAction}
        onConfirm={onConfirmFollowAction}
      />
    </>
  )
}
