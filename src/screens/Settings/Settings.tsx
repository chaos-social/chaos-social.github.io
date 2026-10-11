import {useState} from 'react'
import {Alert, LayoutAnimation, Pressable, View} from 'react-native'
import type Animated from 'react-native-reanimated'
import {useReducedMotion} from 'react-native-reanimated'
import {useAnimatedRef, useScrollViewOffset} from 'react-native-reanimated'
import {setStringAsync} from 'expo-clipboard'
import {removeNuxs} from '@bsky/sdk'
import {moderateProfile} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {HITSLOP_10} from '#/lib/constants'
import {useAccountSwitcher} from '#/lib/hooks/useAccountSwitcher'
import {useApplyPullRequestOTAUpdate} from '#/lib/hooks/useOTAUpdates'
import {
  type CommonNavigatorParams,
  type NavigationProp,
} from '#/lib/routes/types'
import {getShapeStyle} from '#/lib/shapes'
import {getAuthorPrimaryName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {userStyle} from '#/lib/userstyles'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import * as persisted from '#/state/persisted'
import {clearStorage} from '#/state/persisted'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useHideDisplayNames} from '#/state/preferences/hide-display-names'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useDeleteActorDeclaration} from '#/state/queries/messages/actor-declaration'
import {useProfileQuery, useProfilesQuery} from '#/state/queries/profile'
import {usePdsClient} from '#/state/session'
import {type SessionAccount, useSession, useSessionApi} from '#/state/session'
import {
  type AccountSortOption,
  sortAccountItems,
  useAccountSwitcherSortSettings,
} from '#/state/session/sorting'
import {useOnboardingDispatch} from '#/state/shell'
import {useThemePrefs} from '#/state/shell'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useCloseAllActiveElements} from '#/state/util'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {AppServerHeaderControl} from '#/screens/Login/components/AppServerDialog'
import {GrowthbookDialog} from '#/screens/Settings/components/GrowthbookDialog'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, platform, tokens, useBreakpoints, useTheme} from '#/alf'
import {AgeAssuranceDismissibleNotice} from '#/components/ageAssurance/AgeAssuranceDismissibleNotice'
import {AvatarStackWithFetch} from '#/components/AvatarStack'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useIsFindContactsFeatureEnabledBasedOnGeolocation} from '#/components/contacts/country-allowlist'
import {useDialogControl} from '#/components/Dialog'
import {SwitchAccountDialog} from '#/components/dialogs/SwitchAccount'
import {SortableList} from '#/components/DraggableList'
import {Accessibility_Stroke2_Corner2_Rounded as AccessibilityIcon} from '#/components/icons/Accessibility'
import {ArrowRotateClockwise_Stroke2_Corner0_Rounded as ReverseIcon} from '#/components/icons/ArrowRotate'
import {Bell_Stroke2_Corner0_Rounded as NotificationIcon} from '#/components/icons/Bell'
import {BubbleInfo_Stroke2_Corner2_Rounded as BubbleInfoIcon} from '#/components/icons/BubbleInfo'
import {ChevronTop_Stroke2_Corner0_Rounded as ChevronUpIcon} from '#/components/icons/Chevron'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {CodeBrackets_Stroke2_Corner2_Rounded as CodeBracketsIcon} from '#/components/icons/CodeBrackets'
import {Contacts_Stroke2_Corner2_Rounded as ContactsIcon} from '#/components/icons/Contacts'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsHorizontal} from '#/components/icons/DotGrid'
import {Eclipse_Stroke2_Corner0_Rounded as EclipseIcon} from '#/components/icons/Eclipse'
import {Filter_Stroke2_Corner0_Rounded as SortIcon} from '#/components/icons/Filter'
import {FloppyDisk_Stroke2_Corner0_Rounded as SaveIcon} from '#/components/icons/FloppyDisk'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {Lock_Stroke2_Corner2_Rounded as LockIcon} from '#/components/icons/Lock'
import {PaintRoller_Stroke2_Corner2_Rounded as PaintRollerIcon} from '#/components/icons/PaintRoller'
import {
  Person_Stroke2_Corner2_Rounded as PersonIcon,
  PersonGroup_Stroke2_Corner2_Rounded as PersonGroupIcon,
  PersonPlus_Stroke2_Corner2_Rounded as PersonPlusIcon,
  PersonX_Stroke2_Corner0_Rounded as PersonXIcon,
} from '#/components/icons/Person'
import {RaisingHand4Finger_Stroke2_Corner2_Rounded as HandIcon} from '#/components/icons/RaisingHand'
import {Window_Stroke2_Corner2_Rounded as WindowIcon} from '#/components/icons/Window'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Menu from '#/components/Menu'
import {ID as PolicyUpdate202508} from '#/components/PolicyUpdateOverlay/updates/202508/config'
import {ProfileBadges} from '#/components/ProfileBadges'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_INTERNAL, IS_IOS, IS_NATIVE} from '#/env'
import {useActorStatus} from '#/features/liveNow'
import {useActiveThemeUpdate} from '#/features/themes/api'
import {type app} from '#/lexicons'
import {device, useStorage} from '#/storage'
import {useActivitySubscriptionsNudged} from '#/storage/hooks/activity-subscriptions-nudged'
import {useDevMode} from '#/storage/hooks/dev-mode'
import {useHiddenAccountsElsewhere} from '#/storage/hooks/hidden-accounts-elsewhere'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Settings'>
type AccountListItem = {
  account: SessionAccount
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}

export function SettingsScreen({}: Props) {
  const ax = useAnalytics()
  const {t: l} = useLingui()
  const t = useTheme()
  const reducedMotion = useReducedMotion()
  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const scrollOffset = useScrollViewOffset(scrollRef)
  const {logoutEveryAccount, reorderAccounts} = useSessionApi()
  const {accounts, currentAccount} = useSession()
  const {activeTheme} = useThemePrefs()
  const themeUpdate = useActiveThemeUpdate(activeTheme)
  const switchAccountControl = useDialogControl()
  const signOutPromptControl = Prompt.usePromptControl()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const {data: otherProfiles} = useProfilesQuery({
    handles: accounts
      .filter(acc => acc.did !== currentAccount?.did)
      .map(acc => acc.did),
  })
  const {pendingDid, onPressSwitchAccount} = useAccountSwitcher()
  const enableSquareButtons = useEnableSquareButtons()
  const [showAccounts, setShowAccounts] = useState(false)
  const [isDraggingAccounts, setIsDraggingAccounts] = useState(false)
  const [isCustomSortEditing, setIsCustomSortEditing] = useState(false)
  const [customAccountsDraft, setCustomAccountsDraft] = useState<
    AccountListItem[]
  >([])
  const {sortBy, setSortBy, reverse, setReverse} =
    useAccountSwitcherSortSettings()
  const [, , hiddenDidsSet] = useHiddenAccountsElsewhere()
  const [showDevOptions, setShowDevOptions] = useState(false)
  const findContactsEnabled =
    useIsFindContactsFeatureEnabledBasedOnGeolocation()
  const allAccounts = accounts.map(account => ({
    account,
    profile:
      account.did === currentAccount?.did
        ? profile
        : otherProfiles?.profiles?.find(p => p.did === account.did),
  }))
  const otherAccounts = allAccounts.filter(
    item => item.account.did !== currentAccount?.did,
  )
  const displayedAccounts = isCustomSortEditing
    ? customAccountsDraft
    : sortAccountItems(otherAccounts, sortBy, reverse)

  const onSelectAccountsSort = (nextSortBy: AccountSortOption) => {
    if (nextSortBy === 'custom') {
      setCustomAccountsDraft(sortAccountItems(allAccounts, sortBy, reverse))
      setIsCustomSortEditing(true)
      return
    }
    setSortBy(nextSortBy)
    setIsCustomSortEditing(false)
    setCustomAccountsDraft([])
  }

  const onToggleReverseAccounts = () => {
    setReverse(!reverse)
    if (isCustomSortEditing) {
      setCustomAccountsDraft(prev => [...prev].reverse())
    }
  }

  const onCancelCustomSort = () => {
    setIsCustomSortEditing(false)
    setCustomAccountsDraft([])
  }

  const onSaveCustomSort = () => {
    const orderedAccounts = reverse
      ? [...customAccountsDraft].reverse()
      : customAccountsDraft
    reorderAccounts(orderedAccounts.map(item => item.account))
    setSortBy('custom')
    setIsCustomSortEditing(false)
    setCustomAccountsDraft([])
  }

  return (
    <Layout.Screen style={userStyle('wsky-screen--settings')}>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Settings</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <AppServerHeaderControl />
      </Layout.Header.Outer>
      <Layout.Content
        ref={scrollRef}
        scrollEnabled={!isDraggingAccounts}
        style={userStyle('wsky-settings')}>
        <SettingsList.Container>
          <AgeAssuranceDismissibleNotice style={[a.px_lg, a.pt_xs, a.pb_xl]} />

          <View
            style={[
              a.px_xl,
              a.pt_md,
              a.pb_md,
              a.w_full,
              a.gap_2xs,
              a.align_center,
              {minHeight: 160},
            ]}>
            {profile && <ProfilePreview profile={profile} />}
          </View>
          {accounts.length > 1 ? (
            <>
              <View style={[a.relative]}>
                <SettingsList.PressableItem
                  label={l`Switch account`}
                  accessibilityHint={l`Shows other accounts you can switch to`}
                  onPress={() => {
                    if (!reducedMotion) {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      )
                    }
                    if (showAccounts) {
                      setIsCustomSortEditing(false)
                      setCustomAccountsDraft([])
                    }
                    setShowAccounts(s => !s)
                  }}>
                  <SettingsList.ItemIcon icon={PersonGroupIcon} />
                  <SettingsList.ItemText
                    style={[showAccounts && {paddingRight: 64}]}>
                    <Trans>Switch account</Trans>
                  </SettingsList.ItemText>
                  {showAccounts ? (
                    <SettingsList.ItemIcon icon={ChevronUpIcon} size="md" />
                  ) : (
                    <AvatarStackWithFetch
                      profiles={sortAccountItems(otherAccounts, sortBy, reverse)
                        .filter(item => !hiddenDidsSet.has(item.account.did))
                        .map(item => item.account.did)
                        .slice(0, 5)}
                    />
                  )}
                </SettingsList.PressableItem>
                {showAccounts && (
                  <Menu.Root>
                    <Menu.Trigger label={l`Sort accounts`}>
                      {({props, state}) => (
                        <Pressable
                          {...props}
                          style={[
                            a.absolute,
                            {top: 10, right: 48},
                            a.p_xs,
                            getShapeStyle(
                              enableSquareButtons,
                              a.rounded_sm,
                              a.rounded_full,
                            ),
                            (state.hovered || state.pressed) &&
                              t.atoms.bg_contrast_25,
                          ]}>
                          <SortIcon size="md" style={t.atoms.text} />
                        </Pressable>
                      )}
                    </Menu.Trigger>
                    <Menu.Outer showCancel>
                      <Menu.Group>
                        <Menu.LabelText>
                          <Trans>Sort accounts</Trans>
                        </Menu.LabelText>
                        <Menu.Item
                          label={l`Alphabetical`}
                          onPress={() => onSelectAccountsSort('alphabetical')}>
                          <Menu.ItemRadio
                            selected={
                              (isCustomSortEditing ? 'custom' : sortBy) ===
                              'alphabetical'
                            }
                          />
                          <Menu.ItemText>
                            <Trans>Alphabetical</Trans>
                          </Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item
                          label={l`By date modified`}
                          onPress={() => onSelectAccountsSort('dateModified')}>
                          <Menu.ItemRadio
                            selected={
                              (isCustomSortEditing ? 'custom' : sortBy) ===
                              'dateModified'
                            }
                          />
                          <Menu.ItemText>
                            <Trans>By date modified</Trans>
                          </Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item
                          label={l`By date added`}
                          onPress={() => onSelectAccountsSort('dateAdded')}>
                          <Menu.ItemRadio
                            selected={
                              (isCustomSortEditing ? 'custom' : sortBy) ===
                              'dateAdded'
                            }
                          />
                          <Menu.ItemText>
                            <Trans>By date added</Trans>
                          </Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item
                          label={l`Custom`}
                          onPress={() => onSelectAccountsSort('custom')}>
                          <Menu.ItemRadio
                            selected={
                              (isCustomSortEditing ? 'custom' : sortBy) ===
                              'custom'
                            }
                          />
                          <Menu.ItemText>
                            <Trans>Custom</Trans>
                          </Menu.ItemText>
                        </Menu.Item>
                      </Menu.Group>
                      <Menu.Divider />
                      <Menu.Item
                        label={l`Reverse order`}
                        onPress={onToggleReverseAccounts}>
                        <Menu.ItemRadio selected={reverse} />
                        <Menu.ItemText>
                          <Trans>Reverse order</Trans>
                        </Menu.ItemText>
                        <View>
                          <Menu.ItemIcon icon={ReverseIcon} />
                        </View>
                      </Menu.Item>
                    </Menu.Outer>
                  </Menu.Root>
                )}
              </View>
              {showAccounts && (
                <>
                  <SettingsList.Divider />
                  {isCustomSortEditing ? (
                    <SortableList
                      data={customAccountsDraft}
                      keyExtractor={item => item.account.did}
                      itemHeight={48}
                      scrollRef={scrollRef}
                      scrollOffset={scrollOffset}
                      onDragStart={() => setIsDraggingAccounts(true)}
                      onDragEnd={() => setIsDraggingAccounts(false)}
                      onReorder={setCustomAccountsDraft}
                      renderItem={(item, dragHandle) => (
                        <AccountRow
                          key={item.account.did}
                          account={item.account}
                          profile={item.profile}
                          pendingDid={pendingDid}
                          disableSwitching
                          dragHandle={dragHandle}
                          onPressSwitchAccount={(account, logContext) =>
                            void onPressSwitchAccount(account, logContext)
                          }
                        />
                      )}
                    />
                  ) : (
                    displayedAccounts.map(item => (
                      <AccountRow
                        key={item.account.did}
                        account={item.account}
                        profile={item.profile}
                        pendingDid={pendingDid}
                        onPressSwitchAccount={(account, logContext) =>
                          void onPressSwitchAccount(account, logContext)
                        }
                      />
                    ))
                  )}
                  {isCustomSortEditing && (
                    <View
                      style={[a.flex_row, a.gap_sm, a.px_xl, a.pt_md, a.pb_sm]}>
                      <Button
                        label={l`Cancel`}
                        onPress={onCancelCustomSort}
                        color="secondary"
                        size="small"
                        style={[a.flex_1]}>
                        <ButtonText>
                          <Trans>Cancel</Trans>
                        </ButtonText>
                      </Button>
                      <Button
                        label={l`Save changes`}
                        onPress={onSaveCustomSort}
                        color="primary"
                        size="small"
                        style={[a.flex_1]}>
                        <ButtonIcon icon={SaveIcon} />
                        <ButtonText>
                          <Trans>Save changes</Trans>
                        </ButtonText>
                      </Button>
                    </View>
                  )}
                  <AddAccountRow />
                </>
              )}
            </>
          ) : (
            <AddAccountRow />
          )}
          <SettingsList.Divider />
          <SettingsList.LinkItem to="/settings/account" label={l`Account`}>
            <SettingsList.ItemIcon icon={PersonIcon} />
            <SettingsList.ItemText>
              <Trans>Account</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            to="/settings/privacy-and-security"
            label={l`Privacy and security`}>
            <SettingsList.ItemIcon icon={LockIcon} />
            <SettingsList.ItemText>
              <Trans>Privacy and security</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem to="/moderation" label={l`Moderation`}>
            <SettingsList.ItemIcon icon={HandIcon} />
            <SettingsList.ItemText>
              <Trans>Moderation and content filters</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            to="/settings/notifications"
            label={l`Notifications`}>
            <SettingsList.ItemIcon icon={NotificationIcon} />
            <SettingsList.ItemText>
              <Trans>Notifications</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            to="/settings/content-and-media"
            label={l`Content and media`}>
            <SettingsList.ItemIcon icon={WindowIcon} />
            <SettingsList.ItemText>
              <Trans>Content and media</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          {IS_NATIVE &&
            findContactsEnabled &&
            !ax.features.enabled(ax.features.ImportContactsSettingsDisable) && (
              <SettingsList.LinkItem
                to="/settings/find-contacts"
                label={l`Find and invite friends`}>
                <SettingsList.ItemIcon icon={ContactsIcon} />
                <SettingsList.ItemText>
                  <Trans>Find and invite friends</Trans>
                </SettingsList.ItemText>
              </SettingsList.LinkItem>
            )}
          <SettingsList.LinkItem
            to="/settings/appearance"
            label={l`Appearance`}>
            <SettingsList.ItemIcon icon={PaintRollerIcon} />
            <SettingsList.ItemText>
              <Trans>Appearance</Trans>
            </SettingsList.ItemText>
            {themeUpdate && (
              <View
                accessibilityLabel={
                  themeUpdate.mode === 'light'
                    ? l`Light theme update available`
                    : l`Dark theme update available`
                }
                accessibilityHint=""
                style={[
                  a.rounded_full,
                  {width: 9, height: 9, backgroundColor: t.palette.primary_500},
                ]}
              />
            )}
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            to="/settings/accessibility"
            label={l`Accessibility`}>
            <SettingsList.ItemIcon icon={AccessibilityIcon} />
            <SettingsList.ItemText>
              <Trans>Accessibility</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem to="/settings/language" label={l`Languages`}>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>Languages</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem to="/settings/runes" label={l`Runes`}>
            <SettingsList.ItemIcon icon={EclipseIcon} />
            <SettingsList.ItemText>
              <Trans>Runes</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem to="/settings/about" label={l`About`}>
            <SettingsList.ItemIcon icon={BubbleInfoIcon} />
            <SettingsList.ItemText>
              <Trans>About</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.Divider />
          <SettingsList.PressableItem
            destructive
            onPress={() => signOutPromptControl.open()}
            label={l`Sign out`}>
            <SettingsList.ItemText>
              <Trans>Sign out</Trans>
            </SettingsList.ItemText>
          </SettingsList.PressableItem>
          {IS_INTERNAL && (
            <>
              <SettingsList.Divider />
              <SettingsList.PressableItem
                onPress={() => {
                  if (!reducedMotion) {
                    LayoutAnimation.configureNext(
                      LayoutAnimation.Presets.easeInEaseOut,
                    )
                  }
                  setShowDevOptions(d => !d)
                }}
                label={l`Developer options`}>
                <SettingsList.ItemIcon icon={CodeBracketsIcon} />
                <SettingsList.ItemText>
                  <Trans>Developer options</Trans>
                </SettingsList.ItemText>
              </SettingsList.PressableItem>
              {showDevOptions && <DevOptions />}
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>

      <Prompt.Basic
        control={signOutPromptControl}
        title={l`Sign out?`}
        description={l`You will be signed out of all your accounts.`}
        onConfirm={() => logoutEveryAccount('Settings')}
        confirmButtonCta={l`Sign out`}
        cancelButtonCta={l`Cancel`}
        confirmButtonColor="negative"
      />

      <SwitchAccountDialog control={switchAccountControl} />
    </Layout.Screen>
  )
}

function ProfilePreview({
  profile,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const shadow = useProfileShadow(profile)
  const moderationOpts = useModerationOpts()
  const hideDisplayNames = useHideDisplayNames()
  const {isActive: live} = useActorStatus(profile)

  if (!moderationOpts) return null

  const moderation = moderateProfile(profile, moderationOpts)
  const displayName = getAuthorPrimaryName(profile, {
    hideDisplayNames,
    moderation: moderation.ui('displayName'),
  })

  return (
    <>
      <UserAvatar
        size={80}
        avatar={shadow.avatar}
        moderation={moderation.ui('avatar')}
        type={shadow.associated?.labeler ? 'labeler' : 'user'}
        live={live}
      />

      <View
        style={[
          a.flex_row,
          a.gap_xs,
          a.align_center,
          a.justify_center,
          a.w_full,
        ]}>
        <Text
          emoji
          testID="profileHeaderDisplayName"
          numberOfLines={1}
          style={[
            a.pt_sm,
            t.atoms.text,
            gtMobile ? a.text_4xl : a.text_3xl,
            a.font_bold,
          ]}>
          {displayName}
        </Text>
        <ProfileBadges
          profile={shadow}
          size="xl"
          interactive
          style={[
            {
              marginTop: platform({web: 8, ios: 8, android: 10}),
            },
          ]}
        />
      </View>
      {!hideDisplayNames && (
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          {sanitizeHandle(profile.handle, '@')}
        </Text>
      )}
    </>
  )
}

function DevOptions() {
  const {t: l} = useLingui()
  const pdsClient = usePdsClient()
  const [override, setOverride] = useStorage(device, [
    'policyUpdateDebugOverride',
  ])
  const onboardingDispatch = useOnboardingDispatch()
  const navigation = useNavigation<NavigationProp>()
  const {mutate: deleteChatDeclarationRecord} = useDeleteActorDeclaration()
  const {
    tryApplyUpdate,
    restoreDefaultChannel,
    isCurrentlyRunningPullRequestDeployment,
    currentChannel,
  } = useApplyPullRequestOTAUpdate()
  const [actyNotifNudged, setActyNotifNudged] = useActivitySubscriptionsNudged()
  const growthbookControl = useDialogControl()

  const resetOnboarding = () => {
    navigation.navigate('Home')
    onboardingDispatch({type: 'start'})
    Toast.show(l`Onboarding reset`)
  }

  const clearAllStorage = async () => {
    await clearStorage()
    Toast.show(l`Storage cleared, you need to restart the app now.`)
  }

  const onPressUnsnoozeReminder = () => {
    const lastEmailConfirm = new Date()
    // wind back 3 days
    lastEmailConfirm.setDate(lastEmailConfirm.getDate() - 3)
    void persisted.write('reminders', {
      ...persisted.get('reminders'),
      lastEmailConfirm: lastEmailConfirm.toISOString(),
    })
    Toast.show(l`You probably want to restart the app now.`)
  }

  const onPressActySubsUnNudge = () => {
    setActyNotifNudged(false)
  }

  const onPressApplyOta = () => {
    Alert.prompt(
      'Apply OTA',
      'Enter the channel for the OTA you wish to apply.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
        },
        {
          style: 'default',
          text: 'Apply',
          onPress: (channel?: string) => {
            void tryApplyUpdate(channel ?? '')
          },
        },
      ],
      'plain-text',
      isCurrentlyRunningPullRequestDeployment
        ? currentChannel
        : 'pull-request-',
    )
  }

  return (
    <>
      <SettingsList.PressableItem
        onPress={() => navigation.navigate('Log')}
        label={l`Open system log`}>
        <SettingsList.ItemText>
          <Trans>System log</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.PressableItem
        onPress={() => growthbookControl.open()}
        label={l`View GrowthBook information`}>
        <SettingsList.ItemText>
          <Trans>GrowthBook</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <GrowthbookDialog control={growthbookControl} />
      <SettingsList.PressableItem
        onPress={() => navigation.navigate('Debug')}
        label={l`Open storybook page`}>
        <SettingsList.ItemText>
          <Trans>Storybook</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.PressableItem
        onPress={() => navigation.navigate('DebugMod')}
        label={l`Open moderation debug page`}>
        <SettingsList.ItemText>
          <Trans>Debug Moderation</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.PressableItem
        onPress={() => deleteChatDeclarationRecord()}
        label={l`Delete chat declaration record`}>
        <SettingsList.ItemText>
          <Trans>Delete chat declaration record</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.PressableItem
        onPress={() => void resetOnboarding()}
        label={l`Reset onboarding state`}>
        <SettingsList.ItemText>
          <Trans>Reset onboarding state</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      <SettingsList.PressableItem
        onPress={onPressUnsnoozeReminder}
        label={l`Unsnooze email reminder`}>
        <SettingsList.ItemText>
          <Trans>Unsnooze email reminder</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      {actyNotifNudged && (
        <SettingsList.PressableItem
          onPress={onPressActySubsUnNudge}
          label={l`Reset activity subscription nudge`}>
          <SettingsList.ItemText>
            <Trans>Reset activity subscription nudge</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      )}
      <SettingsList.PressableItem
        onPress={() => void clearAllStorage()}
        label={l`Clear all storage data`}>
        <SettingsList.ItemText>
          <Trans>Clear all storage data (restart after this)</Trans>
        </SettingsList.ItemText>
      </SettingsList.PressableItem>
      {IS_IOS ? (
        <SettingsList.PressableItem
          onPress={onPressApplyOta}
          label={l`Apply Pull Request`}>
          <SettingsList.ItemText>
            <Trans>Apply Pull Request</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      ) : null}
      {IS_NATIVE && isCurrentlyRunningPullRequestDeployment ? (
        <SettingsList.PressableItem
          onPress={() => void restoreDefaultChannel()}
          label={l`Unapply Pull Request`}>
          <SettingsList.ItemText>
            <Trans>Unapply Pull Request {currentChannel}</Trans>
          </SettingsList.ItemText>
        </SettingsList.PressableItem>
      ) : null}
      <SettingsList.Divider />
      <View style={[a.p_xl, a.gap_md]}>
        <Text style={[a.text_lg, a.font_semi_bold]}>
          PolicyUpdate202508 Debug
        </Text>

        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
          <Button
            onPress={() => {
              setOverride(!override)
            }}
            label="Toggle"
            color={override ? 'primary' : 'secondary'}
            size="small"
            style={[a.flex_1]}>
            <ButtonText>
              {override ? 'Disable debug mode' : 'Enable debug mode'}
            </ButtonText>
          </Button>

          <Button
            onPress={() => {
              device.set([PolicyUpdate202508], false)
              void pdsClient.call(removeNuxs, [PolicyUpdate202508])
              Toast.show(`Done`, {
                type: 'info',
              })
            }}
            label="Reset policy update nux"
            color="secondary"
            size="small"
            disabled={!override}>
            <ButtonText>Reset state</ButtonText>
          </Button>
        </View>
      </View>
      <SettingsList.Divider />
    </>
  )
}

function AddAccountRow() {
  const {t: l} = useLingui()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const closeEverything = useCloseAllActiveElements()

  const onAddAnotherAccount = () => {
    setShowLoggedOut(true)
    closeEverything()
  }

  return (
    <SettingsList.PressableItem
      onPress={onAddAnotherAccount}
      label={l`Add another account`}>
      <SettingsList.ItemIcon icon={PersonPlusIcon} />
      <SettingsList.ItemText>
        <Trans>Add another account</Trans>
      </SettingsList.ItemText>
    </SettingsList.PressableItem>
  )
}

function AccountRow({
  profile,
  account,
  pendingDid,
  disableSwitching,
  dragHandle,
  onPressSwitchAccount,
}: {
  profile?: app.bsky.actor.defs.ProfileViewDetailed
  account: SessionAccount
  pendingDid: string | null
  disableSwitching?: boolean
  dragHandle?: React.ReactNode
  onPressSwitchAccount: (
    account: SessionAccount,
    logContext: 'Settings',
  ) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()

  const moderationOpts = useModerationOpts()
  const removePromptControl = Prompt.usePromptControl()
  const {removeAccount} = useSessionApi()
  const {isActive: live} = useActorStatus(profile)
  const [devModeEnabled] = useDevMode()
  const [hiddenAccountsElsewhere, setHiddenAccountsElsewhere, hiddenDidsSet] =
    useHiddenAccountsElsewhere()

  const enableSquareButtons = useEnableSquareButtons()
  const isHiddenElsewhere = hiddenDidsSet.has(account.did)

  const onSwitchAccount = () => {
    if (pendingDid || disableSwitching) return
    onPressSwitchAccount(account, 'Settings')
  }

  const onToggleHideElsewhere = () => {
    setHiddenAccountsElsewhere(
      isHiddenElsewhere
        ? hiddenAccountsElsewhere.filter(did => did !== account.did)
        : [...hiddenAccountsElsewhere, account.did],
    )
    Toast.show(
      isHiddenElsewhere
        ? l`Account will show in other switchers again`
        : l`Account hidden from other switchers`,
    )
  }

  const onCopyDid = () => {
    void setStringAsync(account.did)
    Toast.show(l`DID copied to clipboard`)
  }

  return (
    <View style={[a.relative, t.atoms.bg]}>
      <SettingsList.PressableItem
        onPress={onSwitchAccount}
        label={l`Switch account`}
        disabled={Boolean(disableSwitching)}
        contentContainerStyle={[
          {
            minHeight: 48,
          },
        ]}>
        {moderationOpts && profile ? (
          <UserAvatar
            size={28}
            avatar={profile.avatar}
            moderation={moderateProfile(profile, moderationOpts).ui('avatar')}
            type={profile.associated?.labeler ? 'labeler' : 'user'}
            live={live}
            hideLiveBadge
          />
        ) : (
          <View style={[{width: 28}]} />
        )}
        <SettingsList.ItemText
          numberOfLines={1}
          style={[
            a.leading_snug,
            a.self_center,
            !disableSwitching && a.pr_2xl,
          ]}>
          {sanitizeHandle(account.handle, '@')}
        </SettingsList.ItemText>
        {pendingDid === account.did && <SettingsList.ItemIcon icon={Loader} />}
        {disableSwitching ? (
          <View style={[a.self_center]}>{dragHandle}</View>
        ) : null}
      </SettingsList.PressableItem>
      {!pendingDid && !disableSwitching && (
        <Menu.Root>
          <Menu.Trigger label={l`Account options`}>
            {({props, state}) => (
              <Pressable
                {...props}
                hitSlop={HITSLOP_10}
                style={[
                  a.absolute,
                  {top: 12, right: tokens.space.lg},
                  a.p_xs,
                  getShapeStyle(
                    enableSquareButtons,
                    a.rounded_sm,
                    a.rounded_full,
                  ),
                  (state.hovered || state.pressed) && t.atoms.bg_contrast_25,
                ]}>
                <DotsHorizontal size="md" style={t.atoms.text} />
              </Pressable>
            )}
          </Menu.Trigger>
          <Menu.Outer showCancel>
            <Menu.Item
              label={
                isHiddenElsewhere ? l`Hidden elsewhere` : l`Hide elsewhere`
              }
              onPress={onToggleHideElsewhere}>
              <Menu.ItemRadio selected={isHiddenElsewhere} />
              <Menu.ItemText>
                {isHiddenElsewhere ? (
                  <Trans>Hidden elsewhere</Trans>
                ) : (
                  <Trans>Hide elsewhere</Trans>
                )}
              </Menu.ItemText>
            </Menu.Item>
            {devModeEnabled ? (
              <Menu.Item label={l`Copy DID`} onPress={onCopyDid}>
                <Menu.ItemText>
                  <Trans>Copy DID</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={ClipboardIcon} />
              </Menu.Item>
            ) : null}
            <Menu.Divider />
            <Menu.Item
              label={l`Remove account`}
              onPress={() => removePromptControl.open()}>
              <Menu.ItemText>
                <Trans>Remove account</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={PersonXIcon} />
            </Menu.Item>
          </Menu.Outer>
        </Menu.Root>
      )}

      <Prompt.Basic
        control={removePromptControl}
        title={l`Remove from quick access?`}
        description={l`This will remove @${account.handle} from the quick access list.`}
        onConfirm={() => {
          removeAccount(account)
          Toast.show(l`Account removed from quick access`)
        }}
        confirmButtonCta={l`Remove`}
        confirmButtonColor="negative"
      />
    </View>
  )
}
