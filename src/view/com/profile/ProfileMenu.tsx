import {memo, useCallback, useMemo} from 'react'
import {useRef, useState} from 'react'
import * as ExpoClipboard from 'expo-clipboard'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {useHaptics} from '#/lib/haptics'
import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {makeProfileLink} from '#/lib/routes/links'
import {type NavigationProp} from '#/lib/routes/types'
import {shareUrl, simpleShareText} from '#/lib/sharing'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {toShareUrl, toShareUrlBsky} from '#/lib/strings/url-helpers'
import {type Shadow} from '#/state/cache/types'
import {
  toAtprotoExplorerUrl,
  useAtprotoExplorer,
} from '#/state/preferences/atproto-explorer'
import {useConfirmFollow} from '#/state/preferences/confirm-follow'
import {
  useDeerVerificationEnabled,
  useDeerVerificationTrusted,
  useSetDeerVerificationTrust,
} from '#/state/preferences/deer-verification'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useShowBiteButton} from '#/state/preferences/show-bite-button'
import {useDeerVerificationProfileOverlay} from '#/state/queries/deer-verification'
import {
  RQKEY as profileQueryKey,
  useProfileBlockMutationQueue,
  useProfileFollowMutationQueue,
  useProfileMuteMutationQueue,
  useProfileMuteRepostsMutationQueue,
} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {EventStopper} from '#/view/com/util/EventStopper'
import {Button, ButtonIcon} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {FollowConfirmationDialog} from '#/components/dialogs/FollowConfirmationDialog'
import {UserAddRemoveListsDialog} from '#/components/dialogs/lists/UserAddRemoveListsDialog'
import {StarterPackDialog} from '#/components/dialogs/StarterPackDialog'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {CircleCheck_Stroke2_Corner0_Rounded as CircleCheckIcon} from '#/components/icons/CircleCheck'
import {CircleX_Stroke2_Corner0_Rounded as CircleXIcon} from '#/components/icons/CircleX'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {Bite as BiteIcon} from '#/components/icons/Cookie'
import {DotGrid3x1_Stroke2_Corner0_Rounded as EllipsisIcon} from '#/components/icons/DotGrid'
import {Flag_Stroke2_Corner0_Rounded as FlagIcon} from '#/components/icons/Flag'
import {ListSparkle_Stroke2_Corner0_Rounded as ListIcon} from '#/components/icons/ListSparkle'
import {Live_Stroke2_Corner0_Rounded as LiveIcon} from '#/components/icons/Live'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {Mute_Stroke2_Corner0_Rounded as MuteIcon} from '#/components/icons/Mute'
import {PeopleRemove2_Stroke2_Corner0_Rounded as UserMinusIcon} from '#/components/icons/PeopleRemove2'
import {
  PersonCheck_Stroke2_Corner0_Rounded as PersonCheckIcon,
  PersonX_Stroke2_Corner0_Rounded as PersonXIcon,
} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {
  Repost_Stroke2_Corner0_Rounded as RepostIcon,
  RepostStrike_Stroke2_Corner0_Rounded as RepostStrikeIcon,
} from '#/components/icons/Repost'
import {BlueskyIcon} from '#/components/icons/services/Bluesky'
import {PDSlsIcon} from '#/components/icons/services/PDSls'
import {SkyTraceIcon} from '#/components/icons/services/SkyTrace'
import {SpeakerVolumeFull_Stroke2_Corner0_Rounded as UnmuteIcon} from '#/components/icons/Speaker'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import {StarterPack_Stroke2_Corner0_Rounded as StarterPackIcon} from '#/components/icons/StarterPack'
import * as Menu from '#/components/Menu'
import {CheckboxItemText} from '#/components/Menu/CheckboxItem'
import {BlockDialog} from '#/components/moderation/BlockDialog'
import {
  ReportDialog,
  useReportDialogControl,
} from '#/components/moderation/ReportDialog'
import {useBiteMutation} from '#/components/PostControls/PostMenu/useBiteMutation'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {useFullVerificationState} from '#/components/verification'
import {VerificationCreatePrompt} from '#/components/verification/VerificationCreatePrompt'
import {VerificationRemovePrompt} from '#/components/verification/VerificationRemovePrompt'
import {useAnalytics} from '#/analytics'
import {IS_IOS, IS_WEB} from '#/env'
import {useActorStatus, useLiveNowConfig} from '#/features/liveNow'
import {EditLiveDialog} from '#/features/liveNow/components/EditLiveDialog'
import {GoLiveDialog} from '#/features/liveNow/components/GoLiveDialog'
import {GoLiveDisabledDialog} from '#/features/liveNow/components/GoLiveDisabledDialog'
import {
  ReportLinkDialog,
  useReportableProfileLinks,
} from '#/features/profileLinks'
import {type app} from '#/lexicons'
import {useDevMode} from '#/storage/hooks/dev-mode'

let ProfileMenu = ({
  profile,
}: {
  profile: Shadow<app.bsky.actor.defs.ProfileViewDetailed>
}): React.ReactNode => {
  const ax = useAnalytics()
  const {t: l} = useLingui()
  const {currentAccount, hasSession} = useSession()
  const reportDialogControl = useReportDialogControl()
  const queryClient = useQueryClient()
  const navigation = useNavigation<NavigationProp>()
  const isSelf = currentAccount?.did === profile.did
  const isFollowedBy = profile.viewer?.followedBy
  const isFollowing = profile.viewer?.following
  const isBlocked = profile.viewer?.blocking || profile.viewer?.blockedBy
  const isFollowingBlockedAccount = isFollowing && isBlocked
  const isLabeler = !!profile.associated?.labeler
  const [devModeEnabled] = useDevMode()
  const copyLinksRef = useRef(false)
  const profileWithDeerVerification = useDeerVerificationProfileOverlay(profile)
  const verification = useFullVerificationState({
    profile: profileWithDeerVerification,
  })
  const {canGoLive} = useLiveNowConfig()
  const status = useActorStatus(profile)
  const haptics = useHaptics()
  const showBiteButton = useShowBiteButton()
  const {mutateAsync: bite, isPending: isBitePending} = useBiteMutation(
    `at://${profile.did}`,
  )
  /*
   * Keyed by did: this menu stays mounted while navigating between profiles,
   * so a bare flag would make every profile look bitten.
   */
  const [bittenDid, setBittenDid] = useState<string>()
  const hasBitten = bittenDid === profile.did

  const deerVerificationEnabled = useDeerVerificationEnabled()
  const deerVerificationTrusted = useDeerVerificationTrusted().has(profile.did)
  const setDeerVerificationTrust = useSetDeerVerificationTrust()

  const [queueMute, queueUnmute] = useProfileMuteMutationQueue(profile)
  const [queueMuteReposts, queueUnmuteReposts] =
    useProfileMuteRepostsMutationQueue(profile)
  const [queueBlock, queueUnblock] = useProfileBlockMutationQueue(profile)
  const [queueFollow, queueUnfollow] = useProfileFollowMutationQueue(
    profile,
    'ProfileMenu',
  )

  const blockPromptControl = Prompt.usePromptControl()
  const loggedOutWarningPromptControl = Prompt.usePromptControl()
  const goLiveDialogControl = useDialogControl()
  const goLiveDisabledDialogControl = useDialogControl()
  const addToStarterPacksDialogControl = useDialogControl()
  const addToListsDialogControl = useDialogControl()
  const pendingShareAction = useRef<() => void>(() => {})
  const reportLinkDialogControl = useDialogControl()
  const reportableLinks = useReportableProfileLinks(profile)

  const atprotoExplorer = useAtprotoExplorer()
  const openLink = useOpenLink()

  const atprotoExplorerRepositoryUrl = toAtprotoExplorerUrl(
    atprotoExplorer,
    `at://${profile.did}`,
  )
  const showLoggedOutWarning = useMemo(() => {
    return (
      profile.did !== currentAccount?.did &&
      !!profile.labels?.find(label => label.val === '!no-unauthenticated')
    )
  }, [currentAccount, profile])

  const invalidateProfileQuery = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: profileQueryKey(profile.did),
    })
  }, [queryClient, profile.did])

  const onPressAddToStarterPacks = useCallback(() => {
    ax.metric('profile:addToStarterPack', {})
    addToStarterPacksDialogControl.open()
  }, [addToStarterPacksDialogControl, ax])

  const onPressShareBsky = useCallback(() => {
    void shareUrl(toShareUrlBsky(makeProfileLink(profile)))
  }, [profile])

  const onPressCopy = useCallback(async () => {
    const url = toShareUrl(makeProfileLink(profile))
    if (IS_IOS) {
      await ExpoClipboard.setUrlAsync(url)
    } else {
      await ExpoClipboard.setStringAsync(url)
    }
    Toast.show(l`Copied to clipboard`, {type: 'success'})
  }, [l, profile])

  const onPressCopyBsky = useCallback(async () => {
    const url = toShareUrlBsky(makeProfileLink(profile))
    if (IS_IOS) {
      await ExpoClipboard.setUrlAsync(url)
    } else {
      await ExpoClipboard.setStringAsync(url)
    }
    Toast.show(l`Copied to clipboard`, {type: 'success'})
  }, [l, profile])

  const onPressCopyAtprotoExplorer = useCallback(
    async (url: string) => {
      if (IS_IOS) {
        await ExpoClipboard.setUrlAsync(url)
      } else {
        await ExpoClipboard.setStringAsync(url)
      }
      Toast.show(l`Copied to clipboard`, {type: 'success'})
    },
    [l],
  )

  const shareOrWarn = useCallback(
    (action: () => void) => {
      if (showLoggedOutWarning) {
        pendingShareAction.current = action
        loggedOutWarningPromptControl.open()
      } else {
        action()
      }
    },
    [loggedOutWarningPromptControl, showLoggedOutWarning],
  )

  const onPressAddRemoveLists = useCallback(() => {
    addToListsDialogControl.open()
  }, [addToListsDialogControl])

  const onPressMuteAccount = useCallback(async () => {
    if (profile.viewer?.muted) {
      try {
        await queueUnmute()
        Toast.show(l({message: 'Account unmuted', context: 'toast'}))
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          ax.logger.error('Failed to unmute account', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
    } else {
      try {
        await queueMute()
        Toast.show(l({message: 'Account muted', context: 'toast'}))
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          ax.logger.error('Failed to mute account', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
    }
  }, [ax, profile.viewer?.muted, queueUnmute, l, queueMute])

  const onPressMuteReposts = useCallback(async () => {
    if (profile.viewer?.mutedOnlyReposts) {
      try {
        await queueUnmuteReposts()
        Toast.show(
          l({message: 'Reposts will be shown in feeds', context: 'toast'}),
        )
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          ax.logger.error('Failed to show reposts', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
    } else {
      try {
        await queueMuteReposts()
        Toast.show(
          l({message: 'Reposts will be hidden in feeds', context: 'toast'}),
        )
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          ax.logger.error('Failed to hide reposts', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
    }
  }, [ax, profile.viewer, queueUnmuteReposts, l, queueMuteReposts])

  const blockAccount = useCallback(async () => {
    if (profile.viewer?.blocking) {
      try {
        await queueUnblock()
        Toast.show(l({message: 'Account unblocked', context: 'toast'}))
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          ax.logger.error('Failed to unblock account', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
    } else {
      try {
        await queueBlock()
        Toast.show(l({message: 'Account blocked', context: 'toast'}))
      } catch (err) {
        const e = err as Error
        if (e?.name !== 'AbortError') {
          ax.logger.error('Failed to block account', {message: e})
          Toast.show(l`There was an issue! ${e.toString()}`, {
            type: 'error',
          })
        }
      }
    }
  }, [ax, profile.viewer?.blocking, l, queueUnblock, queueBlock])

  const confirmFollow = useConfirmFollow()
  const followPromptControl = Prompt.usePromptControl()
  const [confirmationAction, setConfirmationAction] = useState<
    'follow' | 'unfollow'
  >('follow')

  const executeFollow = useCallback(async () => {
    try {
      await queueFollow()
      Toast.show(l({message: 'Account followed', context: 'toast'}))
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        ax.logger.error('Failed to follow account', {message: e})
        Toast.show(l`There was an issue! ${e.toString()}`, {
          type: 'error',
        })
      }
    }
  }, [l, ax, queueFollow])

  const executeUnfollow = useCallback(async () => {
    try {
      await queueUnfollow()
      Toast.show(l({message: 'Account unfollowed', context: 'toast'}))
    } catch (err) {
      const e = err as Error
      if (e?.name !== 'AbortError') {
        ax.logger.error('Failed to unfollow account', {message: e})
        Toast.show(l`There was an issue! ${e.toString()}`, {
          type: 'error',
        })
      }
    }
  }, [l, ax, queueUnfollow])

  const onPressFollowAccount = useCallback(() => {
    if (confirmFollow) {
      setConfirmationAction('follow')
      followPromptControl.open()
    } else {
      void executeFollow()
    }
  }, [confirmFollow, executeFollow, followPromptControl])

  const onPressUnfollowAccount = useCallback(() => {
    setConfirmationAction('unfollow')
    followPromptControl.open()
  }, [confirmFollow, executeUnfollow, followPromptControl])

  const onConfirmFollowAction = useCallback(() => {
    if (confirmationAction === 'follow') {
      void executeFollow()
    } else {
      void executeUnfollow()
    }
  }, [confirmationAction, executeFollow, executeUnfollow])

  const onPressReportAccount = useCallback(() => {
    reportDialogControl.open()
  }, [reportDialogControl])

  const onPressBite = useCallback(async () => {
    haptics.confirm()
    try {
      await bite()
      setBittenDid(profile.did)
      Toast.show(l({message: 'Bitten', comment: 'Wafrn bite action'}), {
        type: 'success',
      })
    } catch (e) {
      ax.logger.error('Failed to bite account', {safeMessage: e})
      Toast.show(l`Could not bite this account`, {type: 'error'})
    }
  }, [ax, bite, haptics, l, profile.did])

  const biteLabel = hasBitten
    ? l({message: 'Bitten', comment: 'Account already bitten on wafrn'})
    : l({
        message: 'Bite',
        comment: 'Bite an account, like a like, as on wafrn',
      })

  const onPressShareATUri = useCallback(() => {
    void simpleShareText(`at://${profile.did}`)
  }, [profile.did])

  const onPressShareDID = useCallback(() => {
    void simpleShareText(profile.did)
  }, [profile.did])

  const onPressSearch = useCallback(() => {
    navigation.navigate('ProfileSearch', {name: profile.handle})
  }, [navigation, profile.handle])

  const onOpenProfileInAtprotoExplorer = () => {
    openLink(
      toAtprotoExplorerUrl(
        atprotoExplorer,
        `at://${profile.did}/app.bsky.actor.profile/self`,
      ),
    )
  }

  const onOpenRepoInAtprotoExplorer = () => {
    openLink(toAtprotoExplorerUrl(atprotoExplorer, `at://${profile.did}`))
  }

  const onOpenProfileInSkyTrace = () => {
    openLink(`https://skytrace.aly.town/profile/${profile.did}`)
  }

  const verificationCreatePromptControl = Prompt.usePromptControl()
  const verificationRemovePromptControl = Prompt.usePromptControl()
  const currentAccountVerifications =
    profile.verification?.verifications?.filter(v => {
      return v.issuer === currentAccount?.did
    }) ?? []

  return (
    <EventStopper onKeyDown={false}>
      <Menu.Root>
        <Menu.Trigger label={l`More options`}>
          {({props}) => {
            return (
              <Button
                {...props}
                testID="profileHeaderDropdownBtn"
                label={l`More options`}
                // hitSlop reaches outside parent views on iOS, so the
                // left inset must stay within half of the 4pt row gap or
                // it steals taps from the adjacent header button
                hitSlop={{top: 6, bottom: 6, left: 2, right: 12}}
                variant="solid"
                color="secondary"
                size="small"
                shape="round">
                <ButtonIcon icon={EllipsisIcon} size="sm" />
              </Button>
            )
          }}
        </Menu.Trigger>

        <Menu.Outer>
          <Menu.Group>
            <Menu.Item
              testID="profileHeaderDropdownCopyLinkBtn"
              label={l`Copy link to profile`}
              onPress={() => {
                shareOrWarn(() => {
                  void onPressCopy()
                })
              }}>
              <Menu.ItemText>
                <Trans>Copy link to profile</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={ChainLinkIcon} position="right" />
            </Menu.Item>

            <Menu.Submenu
              label={l`Share link`}
              trigger={
                <>
                  <Menu.ItemIcon icon={ShareIcon} />
                  <Menu.ItemText>
                    <Trans>Share link</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ChevronRightIcon} position="right" />
                </>
              }>
              <Menu.Group>
                <Menu.Item
                  testID="profileHeaderDropdownShareBlueskyBtn"
                  label={l`Bluesky`}
                  onPress={() => {
                    shareOrWarn(() => {
                      if (!IS_WEB && copyLinksRef.current) {
                        void onPressCopyBsky()
                      } else {
                        onPressShareBsky()
                      }
                    })
                  }}>
                  <Menu.ItemText>
                    <Trans>Bluesky</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={BlueskyIcon} position="right" />
                </Menu.Item>
                <Menu.Item
                  testID="profileHeaderDropdownShareAtprotoExplorerRepositoryBtn"
                  label={l`Repository`}
                  onPress={() => {
                    shareOrWarn(() => {
                      if (IS_WEB || copyLinksRef.current) {
                        void onPressCopyAtprotoExplorer(
                          atprotoExplorerRepositoryUrl,
                        )
                      } else {
                        void shareUrl(atprotoExplorerRepositoryUrl)
                      }
                    })
                  }}>
                  <Menu.ItemText>
                    <Trans>Repository</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon
                    icon={
                      atprotoExplorer.name === 'PDSls'
                        ? PDSlsIcon
                        : ChainLinkIcon
                    }
                    position="right"
                  />
                </Menu.Item>
                {!IS_WEB && (
                  <Menu.ContainerItem>
                    <CheckboxItemText
                      label={l`Copy instead of opening the share sheet`}
                      initialValue={copyLinksRef.current}
                      onChange={value => {
                        copyLinksRef.current = value
                      }}>
                      <Trans>Copy</Trans>
                    </CheckboxItemText>
                  </Menu.ContainerItem>
                )}
              </Menu.Group>
            </Menu.Submenu>
            <Menu.Submenu
              label={l`Open with`}
              trigger={
                <>
                  <Menu.ItemIcon icon={ExternalIcon} />
                  <Menu.ItemText>
                    <Trans>Open with</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ChevronRightIcon} position="right" />
                </>
              }>
              <Menu.Group>
                <Menu.Item
                  testID="profileDropdownOpenRepoInAtprotoExplorer"
                  label={l`Repository`}
                  onPress={onOpenRepoInAtprotoExplorer}>
                  <Menu.ItemText>
                    <Trans>Repository</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon
                    icon={
                      atprotoExplorer.name === 'PDSls'
                        ? PDSlsIcon
                        : ChainLinkIcon
                    }
                    position="right"
                  />
                </Menu.Item>
                <Menu.Item
                  testID="profileDropdownOpenProfileInAtprotoExplorer"
                  label={l`Profile`}
                  onPress={onOpenProfileInAtprotoExplorer}>
                  <Menu.ItemText>
                    <Trans>Profile</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon
                    icon={
                      atprotoExplorer.name === 'PDSls'
                        ? PDSlsIcon
                        : ChainLinkIcon
                    }
                    position="right"
                  />
                </Menu.Item>
                <Menu.Item
                  testID="profileDropdownOpenInSkyTrace"
                  label={l`SkyTrace`}
                  onPress={onOpenProfileInSkyTrace}>
                  <Menu.ItemText>
                    <Trans>SkyTrace</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={SkyTraceIcon} position="right" />
                </Menu.Item>
              </Menu.Group>
            </Menu.Submenu>
            <Menu.Item
              testID="profileHeaderDropdownSearchBtn"
              label={l`Search posts`}
              onPress={onPressSearch}>
              <Menu.ItemText>
                <Trans>Search posts</Trans>
              </Menu.ItemText>
              <Menu.ItemIcon icon={SearchIcon} />
            </Menu.Item>
          </Menu.Group>

          {hasSession && (
            <>
              <Menu.Divider />
              <Menu.Group>
                {!isSelf && (
                  <>
                    {(isLabeler || isFollowingBlockedAccount) && (
                      <Menu.Item
                        testID="profileHeaderDropdownFollowBtn"
                        label={
                          isFollowing
                            ? isFollowedBy
                              ? l`Divorce mutual`
                              : l`Unfollow account`
                            : l`Follow account`
                        }
                        onPress={
                          isFollowing
                            ? () => void onPressUnfollowAccount()
                            : () => void onPressFollowAccount()
                        }>
                        <Menu.ItemText>
                          {isFollowing ? (
                            isFollowedBy ? (
                              <Trans>Divorce mutual</Trans>
                            ) : (
                              <Trans>Unfollow account</Trans>
                            )
                          ) : (
                            <Trans>Follow account</Trans>
                          )}
                        </Menu.ItemText>
                        <Menu.ItemIcon
                          icon={isFollowing ? UserMinusIcon : PlusIcon}
                        />
                      </Menu.Item>
                    )}
                  </>
                )}
                <Menu.Item
                  testID="profileHeaderDropdownStarterPackAddRemoveBtn"
                  label={l`Add to Starter Packs`}
                  onPress={onPressAddToStarterPacks}>
                  <Menu.ItemText>
                    <Trans>Add to Starter Packs</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={StarterPackIcon} />
                </Menu.Item>
                <Menu.Item
                  testID="profileHeaderDropdownListAddRemoveBtn"
                  label={l`Add to lists`}
                  onPress={onPressAddRemoveLists}>
                  <Menu.ItemText>
                    <Trans>Add to lists</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ListIcon} />
                </Menu.Item>
                {!isSelf &&
                  deerVerificationEnabled &&
                  (deerVerificationTrusted ? (
                    <Menu.Item
                      testID="profileHeaderDropdownVerificationTrustRemoveButton"
                      label={l`Remove trust`}
                      onPress={() =>
                        setDeerVerificationTrust.remove(profile.did)
                      }>
                      <Menu.ItemText>
                        <Trans>Remove trust</Trans>
                      </Menu.ItemText>
                      <Menu.ItemIcon icon={CircleXIcon} />
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      testID="profileHeaderDropdownVerificationTrustAddButton"
                      label={l`Trust verifier`}
                      onPress={() => setDeerVerificationTrust.add(profile.did)}>
                      <Menu.ItemText>
                        <Trans>Trust verifier</Trans>
                      </Menu.ItemText>
                      <Menu.ItemIcon icon={CircleCheckIcon} />
                    </Menu.Item>
                  ))}
                {isSelf && canGoLive && (
                  <Menu.Item
                    testID="profileHeaderDropdownListAddRemoveBtn"
                    label={
                      status.isDisabled
                        ? l`Go live (disabled)`
                        : status.isActive
                          ? l`Edit live status`
                          : l`Go live`
                    }
                    onPress={() => {
                      if (status.isDisabled) {
                        goLiveDisabledDialogControl.open()
                      } else {
                        goLiveDialogControl.open()
                      }
                    }}>
                    <Menu.ItemText>
                      {status.isDisabled ? (
                        <Trans>Go live (disabled)</Trans>
                      ) : status.isActive ? (
                        <Trans>Edit live status</Trans>
                      ) : (
                        <Trans>Go live</Trans>
                      )}
                    </Menu.ItemText>
                    <Menu.ItemIcon icon={LiveIcon} />
                  </Menu.Item>
                )}
                {verification.viewer.role === 'verifier' &&
                  !verification.profile.isViewer &&
                  (verification.viewer.hasIssuedVerification ? (
                    <Menu.Item
                      testID="profileHeaderDropdownVerificationRemoveButton"
                      label={l`Remove verification`}
                      onPress={() => verificationRemovePromptControl.open()}>
                      <Menu.ItemText>
                        <Trans>Remove verification</Trans>
                      </Menu.ItemText>
                      <Menu.ItemIcon icon={CircleXIcon} />
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      testID="profileHeaderDropdownVerificationCreateButton"
                      label={l`Verify account`}
                      onPress={() => verificationCreatePromptControl.open()}>
                      <Menu.ItemText>
                        <Trans>Verify account</Trans>
                      </Menu.ItemText>
                      <Menu.ItemIcon icon={CircleCheckIcon} />
                    </Menu.Item>
                  ))}
                {!isSelf && (
                  <>
                    {showBiteButton && !profile.viewer?.blocking && (
                      <Menu.Item
                        testID="profileHeaderDropdownBiteBtn"
                        disabled={hasBitten || isBitePending}
                        label={biteLabel}
                        onPress={() => void onPressBite()}>
                        <Menu.ItemText>{biteLabel}</Menu.ItemText>
                        <Menu.ItemIcon icon={BiteIcon} />
                      </Menu.Item>
                    )}
                    {!profile.viewer?.blocking &&
                      !profile.viewer?.mutedByList && (
                        <>
                          {!profile.viewer?.muted && (
                            <Menu.Item
                              testID="profileHeaderDropdownMuteRepostsBtn"
                              label={
                                profile.viewer?.mutedOnlyReposts
                                  ? l`Show reposts in feeds`
                                  : l`Hide reposts in feeds`
                              }
                              onPress={() => void onPressMuteReposts()}>
                              <Menu.ItemText>
                                {profile.viewer?.mutedOnlyReposts ? (
                                  <Trans>Show reposts in feeds</Trans>
                                ) : (
                                  <Trans>Hide reposts in feeds</Trans>
                                )}
                              </Menu.ItemText>
                              <Menu.ItemIcon
                                icon={
                                  profile.viewer?.mutedOnlyReposts
                                    ? RepostIcon
                                    : RepostStrikeIcon
                                }
                              />
                            </Menu.Item>
                          )}
                          <Menu.Item
                            testID="profileHeaderDropdownMuteBtn"
                            label={
                              profile.viewer?.muted
                                ? l`Unmute account`
                                : l`Mute account`
                            }
                            onPress={() => void onPressMuteAccount()}>
                            <Menu.ItemText>
                              {profile.viewer?.muted ? (
                                <Trans>Unmute account</Trans>
                              ) : (
                                <Trans>Mute account</Trans>
                              )}
                            </Menu.ItemText>
                            <Menu.ItemIcon
                              icon={
                                profile.viewer?.muted ? UnmuteIcon : MuteIcon
                              }
                            />
                          </Menu.Item>
                        </>
                      )}
                    {!profile.viewer?.blockingByList && (
                      <Menu.Item
                        testID="profileHeaderDropdownBlockBtn"
                        label={
                          profile.viewer?.blocking
                            ? l`Unblock account`
                            : l`Block account`
                        }
                        onPress={() => blockPromptControl.open()}>
                        <Menu.ItemText>
                          {profile.viewer?.blocking ? (
                            <Trans>Unblock account</Trans>
                          ) : (
                            <Trans>Block account</Trans>
                          )}
                        </Menu.ItemText>
                        <Menu.ItemIcon
                          icon={
                            profile.viewer?.blocking
                              ? PersonCheckIcon
                              : PersonXIcon
                          }
                        />
                      </Menu.Item>
                    )}
                    <Menu.Item
                      testID="profileHeaderDropdownReportBtn"
                      label={l`Report account`}
                      onPress={onPressReportAccount}>
                      <Menu.ItemText>
                        <Trans>Report account</Trans>
                      </Menu.ItemText>
                      <Menu.ItemIcon icon={FlagIcon} />
                    </Menu.Item>
                    {reportableLinks.length > 0 && (
                      <Menu.Item
                        testID="profileHeaderDropdownReportLinkBtn"
                        label={l`Report a link`}
                        onPress={() => reportLinkDialogControl.open()}>
                        <Menu.ItemText>
                          <Trans>Report a link</Trans>
                        </Menu.ItemText>
                        <Menu.ItemIcon icon={FlagIcon} />
                      </Menu.Item>
                    )}
                  </>
                )}
              </Menu.Group>
            </>
          )}
          {devModeEnabled ? (
            <>
              <Menu.Divider />
              <Menu.Group>
                <Menu.Item
                  testID="profileHeaderDropdownShareATURIBtn"
                  label={l`Copy at:// URI`}
                  onPress={onPressShareATUri}>
                  <Menu.ItemText>
                    <Trans>Copy at:// URI</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ClipboardIcon} />
                </Menu.Item>
                <Menu.Item
                  testID="profileHeaderDropdownShareDIDBtn"
                  label={l`Copy DID`}
                  onPress={onPressShareDID}>
                  <Menu.ItemText>
                    <Trans>Copy DID</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={ClipboardIcon} />
                </Menu.Item>
              </Menu.Group>
            </>
          ) : null}
        </Menu.Outer>
      </Menu.Root>
      <StarterPackDialog
        control={addToStarterPacksDialogControl}
        targetDid={profile.did}
      />
      <UserAddRemoveListsDialog
        control={addToListsDialogControl}
        profile={profile}
        onAdd={invalidateProfileQuery}
        onRemove={invalidateProfileQuery}
      />
      <ReportDialog
        control={reportDialogControl}
        subject={{
          ...profile,
          $type: 'app.bsky.actor.defs#profileViewDetailed',
        }}
      />
      {reportableLinks.length > 0 && (
        <ReportLinkDialog
          control={reportLinkDialogControl}
          links={reportableLinks}
        />
      )}
      <BlockDialog
        control={blockPromptControl}
        profile={profile}
        onBlock={blockAccount}
      />

      <FollowConfirmationDialog
        control={followPromptControl}
        displayName={sanitizeDisplayName(profile.displayName || profile.handle)}
        handle={profile.handle}
        actionType={confirmationAction}
        onConfirm={onConfirmFollowAction}
      />

      <Prompt.Basic
        control={loggedOutWarningPromptControl}
        title={l`Note about sharing`}
        description={l`This profile is only visible to logged-in users. It won't be visible to people who aren't signed in.`}
        onConfirm={() => pendingShareAction.current()}
        confirmButtonCta={l`Share anyway`}
      />
      <VerificationCreatePrompt
        control={verificationCreatePromptControl}
        profile={profile}
      />
      <VerificationRemovePrompt
        control={verificationRemovePromptControl}
        profile={profile}
        verifications={currentAccountVerifications}
      />
      {status.isDisabled ? (
        <GoLiveDisabledDialog
          control={goLiveDisabledDialogControl}
          status={status}
        />
      ) : status.isActive ? (
        <EditLiveDialog
          control={goLiveDialogControl}
          status={status}
          embed={status.embed}
        />
      ) : (
        <GoLiveDialog control={goLiveDialogControl} profile={profile} />
      )}
    </EventStopper>
  )
}

ProfileMenu = memo(ProfileMenu)
export {ProfileMenu}
