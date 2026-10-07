import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {View} from 'react-native'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from '@floating-ui/react-dom'
import {msg, plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {
  isFollowedByMetricHidden,
  shouldShowProfileCountsMetric,
} from '#/lib/metrics-display'
import {getModerationCauseKey} from '#/lib/moderation'
import {makeProfileLink} from '#/lib/routes/links'
import {type NavigationProp} from '#/lib/routes/types'
import {getShapeStyle} from '#/lib/shapes'
import {getAuthorPrimaryName} from '#/lib/strings/display-names'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useConfirmFollow} from '#/state/preferences/confirm-follow'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useHideDisplayNames} from '#/state/preferences/hide-display-names'
import {
  useFollowedByMetricsDisplay,
  useFollowersMetricsDisplay,
  useFollowingMetricsDisplay,
} from '#/state/preferences/metrics-display-preference'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useShowFollowedByOnOwnProfile} from '#/state/preferences/show-followed-by-on-own-profile'
import {usePrefetchProfileQuery, useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {ProfileHeaderHandle} from '#/screens/Profile/Header/Handle'
import {ProfileCountLink} from '#/screens/Profile/Header/Metrics'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  type FollowActionType,
  FollowConfirmationDialog,
} from '#/components/dialogs/FollowConfirmationDialog'
import {useFollowMethods} from '#/components/hooks/useFollowMethods'
import {useRichText} from '#/components/hooks/useRichText'
import {
  Check_Stroke2_Corner0_Rounded as Check,
  DoubleCheck_Stroke2_Corner0_Rounded as DoubleCheck,
} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {
  KnownFollowers,
  shouldShowKnownFollowers,
} from '#/components/KnownFollowers'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Pills from '#/components/Pills'
import {Portal} from '#/components/Portal'
import {ProfileBadges} from '#/components/ProfileBadges'
import * as Prompt from '#/components/Prompt'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {IS_WEB_TOUCH_DEVICE} from '#/env'
import {useActorStatus} from '#/features/liveNow'
import {LiveStatus} from '#/features/liveNow/components/LiveStatusDialog'
import {type app} from '#/lexicons'
import {type ProfileHoverCardProps} from './types'

const floatingMiddlewares = [
  offset(4),
  flip({padding: 16}),
  shift({padding: 16}),
  size({
    padding: 16,
    apply({availableWidth, availableHeight, elements}) {
      Object.assign(elements.floating.style, {
        maxWidth: `${availableWidth}px`,
        maxHeight: `${availableHeight}px`,
      })
    },
  }),
]

export function ProfileHoverCard(props: ProfileHoverCardProps) {
  const prefetchProfileQuery = usePrefetchProfileQuery()
  const prefetchedProfile = useRef(false)
  const onPointerMove = () => {
    if (!prefetchedProfile.current) {
      prefetchedProfile.current = true
      void prefetchProfileQuery(props.did)
    }
  }

  if (props.disable || IS_WEB_TOUCH_DEVICE) {
    return props.children
  } else {
    return (
      <View
        onPointerMove={onPointerMove}
        style={[a.flex_shrink, props.inline && a.inline, props.style]}>
        <ProfileHoverCardInner {...props} />
      </View>
    )
  }
}

type State =
  | {
      stage: 'hidden' | 'might-hide' | 'hiding'
      effect?: () => () => any
    }
  | {
      stage: 'might-show' | 'showing'
      effect?: () => () => any
      reason: 'hovered-target' | 'hovered-card'
    }

type Action =
  | 'pressed'
  | 'scrolled-while-showing'
  | 'hovered-target'
  | 'unhovered-target'
  | 'hovered-card'
  | 'unhovered-card'
  | 'hovered-long-enough'
  | 'unhovered-long-enough'
  | 'finished-animating-hide'

const SHOW_DELAY = 500
const SHOW_DURATION = 300
const HIDE_DELAY = 150
const HIDE_DURATION = 200

export function ProfileHoverCardInner(props: ProfileHoverCardProps) {
  const navigation = useNavigation<NavigationProp>()

  const followPromptControl = Prompt.usePromptControl()
  const [followConfirmState, setFollowConfirmState] = useState<{
    actionType: FollowActionType
    onConfirm: () => void
    displayName: string
    handle: string
  } | null>(null)

  const [currentState, dispatch] = useReducer(
    // Tip: console.log(state, action) when debugging.
    (state: State, action: Action): State => {
      // Pressing within a card should always hide it.
      // No matter which stage we're in.
      if (action === 'pressed') {
        return hidden()
      }

      // --- Hidden ---
      // In the beginning, the card is not displayed.
      function hidden(): State {
        return {stage: 'hidden'}
      }
      if (state.stage === 'hidden') {
        // The user can kick things off by hovering a target.
        if (action === 'hovered-target') {
          return mightShow({
            reason: action,
          })
        }
      }

      // --- Might Show ---
      // The card is not visible yet but we're considering showing it.
      function mightShow({
        waitMs = SHOW_DELAY,
        reason,
      }: {
        waitMs?: number
        reason: 'hovered-target' | 'hovered-card'
      }): State {
        return {
          stage: 'might-show',
          reason,
          effect() {
            const id = setTimeout(() => dispatch('hovered-long-enough'), waitMs)
            return () => {
              clearTimeout(id)
            }
          },
        }
      }
      if (state.stage === 'might-show') {
        // We'll make a decision at the end of a grace period timeout.
        if (action === 'unhovered-target' || action === 'unhovered-card') {
          return hidden()
        }
        if (action === 'hovered-long-enough') {
          return showing({
            reason: state.reason,
          })
        }
      }

      // --- Showing ---
      // The card is beginning to show up and then will remain visible.
      function showing({
        reason,
      }: {
        reason: 'hovered-target' | 'hovered-card'
      }): State {
        return {
          stage: 'showing',
          reason,
          effect() {
            function onScroll() {
              dispatch('scrolled-while-showing')
            }
            window.addEventListener('scroll', onScroll)
            return () => window.removeEventListener('scroll', onScroll)
          },
        }
      }
      if (state.stage === 'showing') {
        // If the user moves the pointer away, we'll begin to consider hiding it.
        if (action === 'unhovered-target' || action === 'unhovered-card') {
          return mightHide()
        }
        // Scrolling away if the hover is on the target instantly hides without a delay.
        // If the hover is already on the card, we won't this.
        if (
          state.reason === 'hovered-target' &&
          action === 'scrolled-while-showing'
        ) {
          return hiding()
        }
      }

      // --- Might Hide ---
      // The user has moved hover away from a visible card.
      function mightHide({waitMs = HIDE_DELAY}: {waitMs?: number} = {}): State {
        return {
          stage: 'might-hide',
          effect() {
            const id = setTimeout(
              () => dispatch('unhovered-long-enough'),
              waitMs,
            )
            return () => clearTimeout(id)
          },
        }
      }
      if (state.stage === 'might-hide') {
        // We'll make a decision based on whether it received hover again in time.
        if (action === 'hovered-target' || action === 'hovered-card') {
          return showing({
            reason: action,
          })
        }
        if (action === 'unhovered-long-enough') {
          return hiding()
        }
      }

      // --- Hiding ---
      // The user waited enough outside that we're hiding the card.
      function hiding({
        animationDurationMs = HIDE_DURATION,
      }: {
        animationDurationMs?: number
      } = {}): State {
        return {
          stage: 'hiding',
          effect() {
            const id = setTimeout(
              () => dispatch('finished-animating-hide'),
              animationDurationMs,
            )
            return () => clearTimeout(id)
          },
        }
      }
      if (state.stage === 'hiding') {
        // While hiding, we don't want to be interrupted by anything else.
        // When the animation finishes, we loop back to the initial hidden state.
        if (action === 'finished-animating-hide') {
          return hidden()
        }
      }

      return state
    },
    {stage: 'hidden'},
  )

  useEffect(() => {
    if (currentState.effect) {
      const effect = currentState.effect
      return effect()
    }
  }, [currentState])

  const prefetchProfileQuery = usePrefetchProfileQuery()
  const prefetchedProfile = useRef(false)

  const prefetchIfNeeded = useCallback(() => {
    if (!prefetchedProfile.current) {
      prefetchedProfile.current = true
      void prefetchProfileQuery(props.did)
    }
  }, [prefetchProfileQuery, props.did])

  const didFireHover = useRef(false)
  const onPointerMoveTarget = useCallback(() => {
    void prefetchIfNeeded()
    // Conceptually we want something like onPointerEnter,
    // but we want to ignore entering only due to scrolling.
    // So instead we hover on the first onPointerMove.
    if (!didFireHover.current) {
      didFireHover.current = true
      dispatch('hovered-target')
    }
  }, [prefetchIfNeeded, dispatch])

  const onPointerLeaveTarget = useCallback(() => {
    didFireHover.current = false
    dispatch('unhovered-target')
  }, [dispatch])

  const onPointerEnterCard = useCallback(() => {
    dispatch('hovered-card')
  }, [dispatch])

  const onPointerLeaveCard = useCallback(() => {
    dispatch('unhovered-card')
  }, [dispatch])

  const onPress = useCallback(() => {
    dispatch('pressed')
  }, [dispatch])

  const isVisible =
    currentState.stage === 'showing' ||
    currentState.stage === 'might-hide' ||
    currentState.stage === 'hiding'

  const {refs, floatingStyles, isPositioned} = useFloating({
    open: isVisible,
    placement: props.align === 'start' ? 'bottom-start' : 'bottom',
    middleware: floatingMiddlewares,
    whileElementsMounted: autoUpdate,
  })

  const animationStyle = {
    animation:
      currentState.stage === 'hiding'
        ? `fadeOut ${HIDE_DURATION}ms both`
        : `fadeIn ${SHOW_DURATION}ms both`,
  }

  return (
    <View
      ref={refs.setReference}
      onPointerMove={onPointerMoveTarget}
      onPointerLeave={onPointerLeaveTarget}
      // @ts-expect-error web only prop
      onMouseUp={onPress}
      style={[a.flex_shrink, props.inline && a.inline]}>
      {props.children}
      {isVisible && (
        <Portal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              // Before positioning, the card sits at (0, 0) and can steal hover
              // from avatars near the top of the feed, immediately closing it.
              visibility: isPositioned ? 'visible' : 'hidden',
            }}
            onPointerEnter={onPointerEnterCard}
            onPointerLeave={onPointerLeaveCard}>
            <div style={{willChange: 'transform', ...animationStyle}}>
              <Card
                did={props.did}
                hide={onPress}
                navigation={navigation}
                onRequestFollowConfirmation={params => {
                  setFollowConfirmState(params)
                  followPromptControl.open()
                }}
              />
            </div>
          </div>
        </Portal>
      )}
      <FollowConfirmationDialog
        control={followPromptControl}
        displayName={followConfirmState?.displayName ?? ''}
        handle={followConfirmState?.handle ?? ''}
        actionType={followConfirmState?.actionType ?? 'follow'}
        onConfirm={() => {
          followConfirmState?.onConfirm()
          setFollowConfirmState(null)
        }}
      />
    </View>
  )
}

let Card = ({
  did,
  hide,
  navigation,
  onRequestFollowConfirmation,
}: {
  did: string
  hide: () => void
  navigation: NavigationProp
  onRequestFollowConfirmation?: (params: {
    actionType: FollowActionType
    onConfirm: () => void
    displayName: string
    handle: string
  }) => void
}): React.ReactNode => {
  const t = useTheme()

  const profile = useProfileQuery({did})
  const cornerShape = useEnableSquareButtons()
  const moderationOpts = useModerationOpts()

  const data = profile.data

  const status = useActorStatus(data)

  const onPressOpenProfile = useCallback(() => {
    if (!status.isActive || !data) return
    hide()
    navigation.push('Profile', {
      name: data.handle,
    })
  }, [hide, navigation, status, data])

  return (
    <View
      style={[
        !status.isActive && a.p_lg,
        a.border,
        getShapeStyle(cornerShape, a.rounded_md, a.rounded_md),
        a.overflow_hidden,
        t.atoms.bg,
        t.atoms.border_contrast_low,
        t.atoms.shadow_lg,
        {width: status.isActive ? 350 : 300},
        a.max_w_full,
      ]}>
      {data && moderationOpts ? (
        status.isActive ? (
          <LiveStatus
            status={status}
            profile={data}
            embed={status.embed}
            padding="lg"
            onPressOpenProfile={onPressOpenProfile}
          />
        ) : (
          <Inner
            profile={data}
            moderationOpts={moderationOpts}
            hide={hide}
            onRequestFollowConfirmation={onRequestFollowConfirmation}
          />
        )
      ) : (
        <View
          style={[
            a.justify_center,
            a.align_center,
            {minHeight: 200},
            a.w_full,
          ]}>
          <Loader size="xl" />
        </View>
      )}
    </View>
  )
}
Card = memo(Card)

function Inner({
  profile,
  moderationOpts,
  hide,
  onRequestFollowConfirmation,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  moderationOpts: ModerationOpts
  hide: () => void
  onRequestFollowConfirmation?: (params: {
    actionType: FollowActionType
    onConfirm: () => void
    displayName: string
    handle: string
  }) => void
}) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const moderation = useMemo(
    () => moderateProfile(profile, moderationOpts),
    [profile, moderationOpts],
  )
  const [descriptionRT] = useRichText(profile.description ?? '')
  const profileShadow = useProfileShadow(profile)
  const {follow, unfollow} = useFollowMethods({
    profile: profileShadow,
    logContext: 'ProfileHoverCard',
  })
  const confirmFollow = useConfirmFollow()
  const hideDisplayNames = useHideDisplayNames()
  const authorPrimaryName = getAuthorPrimaryName(profile, {
    hideDisplayNames,
    moderation: moderation.ui('displayName'),
  })
  const isBlockedUser =
    profile.viewer?.blocking ||
    profile.viewer?.blockedBy ||
    profile.viewer?.blockingByList
  const followersMetricsDisplay = useFollowersMetricsDisplay()
  const followingMetricsDisplay = useFollowingMetricsDisplay()
  const followedByMetricsDisplay = useFollowedByMetricsDisplay()
  const showFollowedByOnOwnProfile = useShowFollowedByOnOwnProfile()
  const followersCount = profile.followersCount || 0
  const followingCount = profile.followsCount || 0
  const pluralizedFollowers = plural(profile.followersCount || 0, {
    one: 'follower',
    other: 'followers',
  })
  const pluralizedFollowings = plural(profile.followsCount || 0, {
    one: 'following',
    other: 'following',
  })
  const profileURL = makeProfileLink({
    did: profile.did,
    handle: profile.handle,
  })
  const isMe = useMemo(
    () => currentAccount?.did === profile.did,
    [currentAccount, profile],
  )
  const isLabeler = profile.associated?.labeler

  const enableSquareButtons = useEnableSquareButtons()

  const handleFollow = () => {
    if (confirmFollow && onRequestFollowConfirmation) {
      onRequestFollowConfirmation({
        actionType: 'follow',
        onConfirm: follow,
        displayName: authorPrimaryName,
        handle: profile.handle,
      })
    } else {
      follow()
    }
  }

  const handleUnfollow = useCallback(() => {
    if (onRequestFollowConfirmation) {
      onRequestFollowConfirmation({
        actionType: 'unfollow',
        onConfirm: unfollow,
        displayName: authorPrimaryName,
        handle: profile.handle,
      })
    } else {
      unfollow()
    }
  }, [
    confirmFollow,
    unfollow,
    onRequestFollowConfirmation,
    authorPrimaryName,
    profile.handle,
  ])

  return (
    <View>
      <View style={[a.flex_row, a.justify_between, a.align_start]}>
        <Link to={profileURL} label={_(msg`View profile`)} onPress={hide}>
          <UserAvatar
            size={64}
            avatar={profile.avatar}
            type={isLabeler ? 'labeler' : 'user'}
            moderation={moderation.ui('avatar')}
          />
        </Link>

        {!isMe &&
          !isLabeler &&
          (isBlockedUser ? (
            <Link
              to={profileURL}
              label={_(msg`View blocked user's profile`)}
              onPress={hide}
              size="small"
              color="secondary"
              variant="solid"
              style={getShapeStyle(
                enableSquareButtons,
                a.rounded_sm,
                a.rounded_full,
              )}>
              <ButtonText>{_(msg`View profile`)}</ButtonText>
            </Link>
          ) : (
            <Button
              size="small"
              color={profileShadow.viewer?.following ? 'secondary' : 'primary'}
              variant="solid"
              label={
                profileShadow.viewer?.following
                  ? profileShadow.viewer?.followedBy
                    ? _(msg`Mutuals`)
                    : _(msg`Following`)
                  : profileShadow.viewer?.followedBy
                    ? _(msg`Follow back`)
                    : _(msg`Follow`)
              }
              style={getShapeStyle(
                enableSquareButtons,
                a.rounded_sm,
                a.rounded_full,
              )}
              onPress={
                profileShadow.viewer?.following ? handleUnfollow : handleFollow
              }>
              <ButtonIcon
                position="left"
                icon={
                  profileShadow.viewer?.following &&
                  profileShadow.viewer?.followedBy
                    ? DoubleCheck
                    : profileShadow.viewer?.following
                      ? Check
                      : Plus
                }
              />
              <ButtonText>
                {profileShadow.viewer?.following
                  ? profileShadow.viewer?.followedBy
                    ? _(msg`Mutuals`)
                    : _(msg`Following`)
                  : profileShadow.viewer?.followedBy
                    ? _(msg`Follow back`)
                    : _(msg`Follow`)}
              </ButtonText>
            </Button>
          ))}
      </View>

      <View style={[a.pb_sm, a.flex_1]}>
        <Link to={profileURL} label={_(msg`View profile`)} onPress={hide}>
          <View
            style={[a.flex_row, a.flex_1, a.align_center, a.pt_md, a.pb_xs]}>
            <Text
              numberOfLines={1}
              style={[
                a.flex_shrink,
                a.text_lg,
                a.leading_snug,
                a.font_semi_bold,
                a.self_start,
              ]}>
              {authorPrimaryName}
            </Text>
            <ProfileBadges
              profile={profile}
              size="md"
              pdsInteractive={false}
              style={[
                a.pl_xs,
                {
                  marginTop: -1,
                },
              ]}
            />
          </View>
        </Link>

        <ProfileHeaderHandle
          profile={profileShadow}
          truncate
          disableAuxiliaryTaps
          onLinkPress={hide}
        />
      </View>

      {isBlockedUser && (
        <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
          {moderation.ui('profileView').alerts.map(cause => (
            <Pills.Label
              key={getModerationCauseKey(cause)}
              size="lg"
              cause={cause}
              disableDetailsDialog
            />
          ))}
        </View>
      )}

      {!isBlockedUser && (
        <>
          {!shouldShowProfileCountsMetric(
            followersMetricsDisplay,
            followersCount,
          ) &&
          !shouldShowProfileCountsMetric(
            followingMetricsDisplay,
            followingCount,
          ) ? null : (
            <View style={[a.flex_row, a.flex_wrap, a.gap_md, a.pt_xs]}>
              {shouldShowProfileCountsMetric(
                followersMetricsDisplay,
                followersCount,
              ) ? (
                <ProfileCountLink
                  testID="profileHoverCardFollowersButton"
                  to={makeProfileLink(profile, 'followers')}
                  label={`${followersCount} ${pluralizedFollowers}`}
                  display={followersMetricsDisplay}
                  count={followersCount}
                  labelText={pluralizedFollowers}
                  onPress={hide}
                />
              ) : null}
              {shouldShowProfileCountsMetric(
                followingMetricsDisplay,
                followingCount,
              ) ? (
                <ProfileCountLink
                  testID="profileHoverCardFollowsButton"
                  to={makeProfileLink(profile, 'follows')}
                  label={_(msg`${followingCount} following`)}
                  display={followingMetricsDisplay}
                  count={followingCount}
                  labelText={pluralizedFollowings}
                  onPress={hide}
                />
              ) : null}
            </View>
          )}

          {profile.description?.trim() && !moderation.ui('profileView').blur ? (
            <View style={[a.pt_md]}>
              <RichText
                numberOfLines={8}
                value={descriptionRT}
                onLinkPress={hide}
              />
            </View>
          ) : undefined}

          {(!isMe || showFollowedByOnOwnProfile) &&
            !isFollowedByMetricHidden(followedByMetricsDisplay) &&
            shouldShowKnownFollowers(profile.viewer?.knownFollowers) && (
              <View style={[a.flex_row, a.align_center, a.gap_sm, a.pt_md]}>
                <KnownFollowers
                  profile={profile}
                  moderationOpts={moderationOpts}
                  onLinkPress={hide}
                  followedByDisplay={followedByMetricsDisplay}
                />
              </View>
            )}
        </>
      )}
    </View>
  )
}
