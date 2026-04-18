import {useCallback, useRef, useState} from 'react'
import {Pressable, View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {sanitizeUrl} from '@braintree/sanitize-url'
import {msg, plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {StackActions, useNavigationState} from '@react-navigation/native'

import {useHideBottomBarBorder} from '#/lib/hooks/useHideBottomBarBorder'
import {useMinimalShellFooterTransform} from '#/lib/hooks/useMinimalShellTransform'
import {useNavigationDeduped} from '#/lib/hooks/useNavigationDeduped'
import {
  getCurrentRoute,
  getTabState,
  isTab,
  TabState,
} from '#/lib/routes/helpers'
import {makeProfileLink} from '#/lib/routes/links'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {convertBskyAppUrlIfNeeded} from '#/lib/strings/url-helpers'
import {emitSoftReset} from '#/state/events'
import {useModalControls} from '#/state/modals'
import {useUnreadMessageCount} from '#/state/queries/messages/list-conversations'
import {useUnreadNotifications} from '#/state/queries/notifications/unread'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useCloseAllActiveElements} from '#/state/util'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {Logo} from '#/view/icons/Logo'
import {Logotype} from '#/view/icons/Logotype'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {SwitchAccountDialog} from '#/components/dialogs/SwitchAccount'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stoke2_Corner0_Rounded as Home,
} from '#/components/icons/HomeOpen'
import {
  MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as MagnifyingGlassFilled,
  MagnifyingGlass_Stroke2_Corner0_Rounded as MagnifyingGlass,
} from '#/components/icons/MagnifyingGlass'
import {
  Message_Stroke2_Corner0_Rounded as Message,
  Message_Stroke2_Corner0_Rounded_Filled as MessageFilled,
} from '#/components/icons/Message'
import {Text} from '#/components/Typography'
import {useAgeAssurance} from '#/ageAssurance'
import {IS_WEB_TOUCH_DEVICE} from '#/env'
import {router} from '#/routes'
import {styles} from './BottomBarStyles'

export function BottomBarWeb() {
  const {_} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const t = useTheme()
  const {bottom: bottomInset} = useSafeAreaInsets()
  const footerMinimalShellTransform = useMinimalShellFooterTransform()
  const {requestSwitchToAccount} = useLoggedOutViewControls()
  const closeAllActiveElements = useCloseAllActiveElements()
  const {footerHeight} = useShellLayout()
  const hideBorder = useHideBottomBarBorder()
  const accountSwitchControl = useDialogControl()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const iconWidth = 26

  const unreadMessageCount = useUnreadMessageCount()
  const notificationCountStr = useUnreadNotifications()
  const aa = useAgeAssurance()

  const showSignIn = useCallback(() => {
    closeAllActiveElements()
    requestSwitchToAccount({requestedAccount: 'none'})
  }, [requestSwitchToAccount, closeAllActiveElements])

  const showCreateAccount = useCallback(() => {
    closeAllActiveElements()
    requestSwitchToAccount({requestedAccount: 'new'})
    // setShowLoggedOut(true)
  }, [requestSwitchToAccount, closeAllActiveElements])

  const onLongPressProfile = useCallback(() => {
    accountSwitchControl.open()
  }, [accountSwitchControl])

  return (
    <>
      <SwitchAccountDialog control={accountSwitchControl} />

      <Animated.View
        role="navigation"
        style={[
          styles.bottomBar,
          styles.bottomBarWeb,
          t.atoms.bg,
          IS_WEB_TOUCH_DEVICE
            ? {paddingBottom: Math.max(bottomInset, 15)}
            : {paddingBottom: bottomInset},
          hideBorder
            ? {borderColor: t.atoms.bg.backgroundColor}
            : t.atoms.border_contrast_low,
          footerMinimalShellTransform,
        ]}
        onLayout={event => footerHeight.set(event.nativeEvent.layout.height)}>
        {hasSession ? (
          <>
            <NavItem routeName="Home" href="/">
              {({isActive}) => {
                const Icon = isActive ? HomeFilled : Home
                return (
                  <Icon
                    aria-hidden={true}
                    width={iconWidth + 1}
                    style={[styles.ctrlIcon, t.atoms.text, styles.homeIcon]}
                  />
                )
              }}
            </NavItem>
            <NavItem routeName="Search" href="/search">
              {({isActive}) => {
                const Icon = isActive ? MagnifyingGlassFilled : MagnifyingGlass
                return (
                  <Icon
                    aria-hidden={true}
                    width={iconWidth + 2}
                    style={[styles.ctrlIcon, t.atoms.text, styles.searchIcon]}
                  />
                )
              }}
            </NavItem>

            {hasSession && (
              <>
                <NavItem
                  routeName="Messages"
                  href="/messages"
                  notificationCount={
                    aa.flags.chatDisabled
                      ? undefined
                      : unreadMessageCount.numUnread
                  }
                  hasNew={
                    aa.flags.chatDisabled ? false : unreadMessageCount.hasNew
                  }>
                  {({isActive}) => {
                    const Icon = isActive ? MessageFilled : Message
                    return (
                      <Icon
                        aria-hidden={true}
                        width={iconWidth - 1}
                        style={[
                          styles.ctrlIcon,
                          t.atoms.text,
                          styles.messagesIcon,
                        ]}
                      />
                    )
                  }}
                </NavItem>
                <NavItem
                  routeName="Notifications"
                  href="/notifications"
                  notificationCount={notificationCountStr}>
                  {({isActive}) => {
                    const Icon = isActive ? BellFilled : Bell
                    return (
                      <Icon
                        aria-hidden={true}
                        width={iconWidth}
                        style={[styles.ctrlIcon, t.atoms.text, styles.bellIcon]}
                      />
                    )
                  }}
                </NavItem>
                <NavItem
                  routeName="Profile"
                  href={
                    currentAccount
                      ? makeProfileLink({
                          did: currentAccount.did,
                          handle: currentAccount.handle,
                        })
                      : '/'
                  }
                  onLongPress={onLongPressProfile}>
                  {({isActive}) => (
                    <View style={styles.ctrlIconSizingWrapper}>
                      <View
                        style={[
                          styles.ctrlIcon,
                          styles.profileIcon,
                          isActive && [
                            styles.onProfile,
                            {borderColor: t.atoms.text.color},
                          ],
                        ]}>
                        <UserAvatar
                          avatar={profile?.avatar}
                          size={iconWidth - 3}
                          type={
                            profile?.associated?.labeler ? 'labeler' : 'user'
                          }
                        />
                      </View>
                    </View>
                  )}
                </NavItem>
              </>
            )}
          </>
        ) : (
          <>
            <View
              style={[
                a.w_full,
                a.flex_row,
                a.align_center,
                a.justify_between,
                a.gap_sm,
                {
                  paddingTop: 14,
                  paddingBottom: 14,
                  paddingLeft: 14,
                  paddingRight: 6,
                },
              ]}>
              <View style={[a.flex_row, a.align_center, a.gap_md]}>
                <Logo width={32} />
                <View style={{paddingTop: 4}}>
                  <Logotype width={80} fill={t.atoms.text.color} />
                </View>
              </View>

              <View style={[a.flex_row, a.flex_wrap, a.gap_sm]}>
                <Button
                  onPress={showCreateAccount}
                  label={_(msg`Create account`)}
                  size="small"
                  variant="solid"
                  color="primary">
                  <ButtonText>
                    <Trans>Create account</Trans>
                  </ButtonText>
                </Button>
                <Button
                  onPress={showSignIn}
                  label={_(msg`Sign in`)}
                  size="small"
                  variant="solid"
                  color="secondary">
                  <ButtonText>
                    <Trans>Sign in</Trans>
                  </ButtonText>
                </Button>
              </View>
            </View>
          </>
        )}
      </Animated.View>
    </>
  )
}

const NavItem: React.FC<{
  children: (props: {isActive: boolean}) => React.ReactNode
  href: string
  routeName: string
  hasNew?: boolean
  notificationCount?: string
  onLongPress?: () => void
}> = ({children, href, routeName, hasNew, notificationCount, onLongPress}) => {
  const t = useTheme()
  const {_} = useLingui()
  const {bottom: bottomInset} = useSafeAreaInsets()
  const {currentAccount} = useSession()
  const currentRoute = useNavigationState(state => {
    if (!state) {
      return {name: 'Home'}
    }
    return getCurrentRoute(state)
  })

  // Checks whether we're on someone else's profile
  const isOnDifferentProfile =
    currentRoute.name === 'Profile' &&
    routeName === 'Profile' &&
    (currentRoute.params as CommonNavigatorParams['Profile']).name !==
      currentAccount?.handle

  const isActive =
    currentRoute.name === 'Profile'
      ? isTab(currentRoute.name, routeName) &&
        (currentRoute.params as CommonNavigatorParams['Profile']).name ===
          (routeName === 'Profile'
            ? currentAccount?.handle
            : (currentRoute.params as CommonNavigatorParams['Profile']).name)
      : isTab(currentRoute.name, routeName)

  if (IS_WEB_TOUCH_DEVICE) {
    return (
      <TouchNavItem
        href={href}
        routeName={routeName}
        isActive={isActive}
        isOnDifferentProfile={isOnDifferentProfile}
        hasNew={hasNew}
        notificationCount={notificationCount}
        onLongPress={onLongPress}>
        {children}
      </TouchNavItem>
    )
  }

  return (
    <Link
      href={href}
      style={[styles.ctrl, bottomInset === 0 && a.pb_lg]}
      navigationAction={isOnDifferentProfile ? 'push' : 'navigate'}
      aria-role="link"
      aria-label={routeName}
      accessible={true}
      onLongPress={onLongPress}>
      {children({isActive})}
      {notificationCount ? (
        <View
          style={[
            styles.notificationCount,
            styles.notificationCountWeb,
            {backgroundColor: t.palette.primary_500},
          ]}
          aria-label={_(
            msg`${plural(notificationCount, {
              one: '# unread item',
              other: '# unread items',
            })}`,
          )}>
          <Text style={styles.notificationCountLabel}>{notificationCount}</Text>
        </View>
      ) : hasNew ? (
        <View
          style={[styles.hasNewBadge, {backgroundColor: t.palette.primary_500}]}
        />
      ) : null}
    </Link>
  )
}

function TouchNavItem({
  children,
  href,
  routeName,
  isActive,
  isOnDifferentProfile,
  hasNew,
  notificationCount,
  onLongPress,
}: {
  children: (props: {isActive: boolean}) => React.ReactNode
  href: string
  routeName: string
  isActive: boolean
  isOnDifferentProfile: boolean
  hasNew?: boolean
  notificationCount?: string
  onLongPress?: () => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {bottom: bottomInset} = useSafeAreaInsets()
  const navigation = useNavigationDeduped()
  const {closeModal} = useModalControls()

  // CSS transition press animation — runs on compositor thread
  // so navigation re-renders don't cause jank
  const [pressed, setPressed] = useState(false)
  const pressInTime = useRef(0)
  const pressOutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const ANIM_MS = 100

  const handlePressIn = () => {
    if (pressOutTimer.current) {
      clearTimeout(pressOutTimer.current)
      pressOutTimer.current = undefined
    }
    pressInTime.current = Date.now()
    setPressed(true)
  }

  const handlePressOut = () => {
    const elapsed = Date.now() - pressInTime.current
    const remaining = Math.max(0, ANIM_MS - elapsed)
    // Wait for scale-down to finish before starting scale-up
    pressOutTimer.current = setTimeout(() => {
      setPressed(false)
      pressOutTimer.current = undefined
    }, remaining)
  }

  const onPress = () => {
    closeModal()

    const sanitizedHref = convertBskyAppUrlIfNeeded(sanitizeUrl(href))
    const [resolvedRouteName, params] = router.matchPath(sanitizedHref)

    if (isOnDifferentProfile) {
      // @ts-ignore we're not able to type check on this one -prf
      navigation.dispatch(StackActions.push(resolvedRouteName, params))
    } else {
      const state = navigation.getState()
      const tabState = getTabState(state, resolvedRouteName)
      if (tabState === TabState.InsideAtRoot) {
        emitSoftReset()
      } else {
        // @ts-ignore we're not able to type check on this one -prf
        navigation.navigate(resolvedRouteName, params, {pop: true})
      }
    }
  }

  return (
    <Pressable
      style={[
        styles.ctrl,
        bottomInset === 0 && a.pb_lg,
        {
          transition: `transform ${ANIM_MS}ms`,
          transform: [{scale: pressed ? 0.8 : 1}],
        } as any,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      unstable_pressDelay={0}
      accessibilityRole="link"
      accessibilityLabel={routeName}
      accessibilityHint="">
      {children({isActive})}
      {notificationCount ? (
        <View
          style={[
            styles.notificationCount,
            styles.notificationCountWeb,
            {backgroundColor: t.palette.primary_500},
          ]}
          aria-label={_(
            msg`${plural(notificationCount, {
              one: '# unread item',
              other: '# unread items',
            })}`,
          )}>
          <Text style={styles.notificationCountLabel}>{notificationCount}</Text>
        </View>
      ) : hasNew ? (
        <View style={styles.hasNewBadge} />
      ) : null}
    </Pressable>
  )
}
