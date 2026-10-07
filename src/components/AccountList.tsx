import {Fragment, useCallback} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {isJwtExpired} from '#/lib/jwt'
import {getShapeStyle} from '#/lib/shapes'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useAutoCompactAccountSwitcher} from '#/state/preferences/auto-compact-account-switcher'
import {useCompactAccountSwitcher} from '#/state/preferences/compact-account-switcher'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useProfilesQuery} from '#/state/queries/profile'
import {type SessionAccount, useSession} from '#/state/session'
import {useSortedAccountItems} from '#/state/session/sorting'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {CheckThick_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {ProfileBadges} from '#/components/ProfileBadges'
import {Text} from '#/components/Typography'
import {useActorStatus} from '#/features/liveNow'
import {type app} from '#/lexicons'
import {useHiddenAccountsElsewhere} from '#/storage/hooks/hidden-accounts-elsewhere'

export function AccountList({
  accounts: accountsProp,
  onSelectAccount,
  onSelectOther,
  otherLabel,
  pendingDid,
  selectedDid,
  showAddAccount = true,
}: {
  accounts?: SessionAccount[]
  onSelectAccount: (account: SessionAccount) => void
  onSelectOther: () => void
  otherLabel?: string
  pendingDid: string | null
  selectedDid?: string | null
  showAddAccount?: boolean
}) {
  const {currentAccount, accounts: sessionAccounts} = useSession()
  const t = useTheme()
  const {_} = useLingui()
  const enableSquareButtons = useEnableSquareButtons()
  const useCompactSwitcher = useCompactAccountSwitcher()
  const autoCompactSwitcher = useAutoCompactAccountSwitcher()
  const accounts = accountsProp ?? sessionAccounts
  const [, , hiddenDidsSet] = useHiddenAccountsElsewhere()
  const {data: profiles} = useProfilesQuery({
    handles: accounts.map(acc => acc.did),
  })
  const sortedAccounts = useSortedAccountItems(accounts).filter(
    account => !hiddenDidsSet.has(account.did),
  )
  const shouldUseCompactSwitcher =
    Boolean(useCompactSwitcher) ||
    (Boolean(autoCompactSwitcher) && sortedAccounts.length > 6)

  const onPressAddAccount = useCallback(() => {
    onSelectOther()
  }, [onSelectOther])

  return (
    <View
      pointerEvents={pendingDid ? 'none' : 'auto'}
      style={[
        shouldUseCompactSwitcher ? a.rounded_md : a.rounded_lg,
        a.overflow_hidden,
        a.border,
        t.atoms.border_contrast_low,
      ]}>
      {sortedAccounts.map(account => (
        <Fragment key={account.did}>
          <AccountItem
            profile={profiles?.profiles.find(p => p.did === account.did)}
            account={account}
            onSelect={onSelectAccount}
            useCompactSwitcher={shouldUseCompactSwitcher}
            isCurrentAccount={
              account.did === (selectedDid ?? currentAccount?.did)
            }
            isPendingAccount={account.did === pendingDid}
          />
          <View style={[a.border_b, t.atoms.border_contrast_low]} />
        </Fragment>
      ))}
      {showAddAccount ? (
        <Button
          testID="chooseAddAccountBtn"
          style={[a.flex_1]}
          onPress={pendingDid ? undefined : onPressAddAccount}
          label={_(msg`Sign in to account that is not listed`)}>
          {({hovered, pressed}) => (
            <View
              style={[
                a.flex_1,
                a.flex_row,
                a.align_center,
                shouldUseCompactSwitcher ? {height: 48} : a.p_lg,
                shouldUseCompactSwitcher ? null : a.gap_sm,
                (hovered || pressed) && t.atoms.bg_contrast_25,
              ]}>
              {shouldUseCompactSwitcher ? (
                <>
                  <Text
                    style={[
                      a.font_semi_bold,
                      a.flex_1,
                      a.flex_row,
                      a.py_sm,
                      a.leading_tight,
                      t.atoms.text_contrast_medium,
                      {paddingLeft: 56},
                    ]}>
                    {otherLabel ?? <Trans>Other account</Trans>}
                  </Text>
                  <ChevronIcon size="sm" style={[t.atoms.text, a.mr_md]} />
                </>
              ) : (
                <>
                  <View
                    style={[
                      t.atoms.bg_contrast_25,
                      getShapeStyle(
                        enableSquareButtons,
                        a.rounded_sm,
                        a.rounded_full,
                      ),
                      {width: 48, height: 48},
                      a.justify_center,
                      a.align_center,
                      (hovered || pressed) && t.atoms.bg_contrast_50,
                    ]}>
                    <PlusIcon style={[t.atoms.text_contrast_low]} size="md" />
                  </View>
                  <Text
                    style={[
                      a.flex_1,
                      a.leading_tight,
                      a.text_md,
                      a.font_medium,
                    ]}>
                    {otherLabel ?? <Trans>Other account</Trans>}
                  </Text>
                  <ChevronIcon size="md" style={[t.atoms.text_contrast_low]} />
                </>
              )}
            </View>
          )}
        </Button>
      ) : null}
    </View>
  )
}

function AccountItem({
  profile,
  account,
  onSelect,
  useCompactSwitcher,
  isCurrentAccount,
  isPendingAccount,
}: {
  profile?: app.bsky.actor.defs.ProfileViewDetailed
  account: SessionAccount
  onSelect: (account: SessionAccount) => void
  useCompactSwitcher: boolean
  isCurrentAccount: boolean
  isPendingAccount: boolean
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {isActive: live} = useActorStatus(profile)
  const enableSquareButtons = useEnableSquareButtons()

  const onPress = useCallback(() => {
    onSelect(account)
  }, [account, onSelect])

  const isLoggedOut = account.isOauthSession
    ? false // OAuth sessions are managed by the OAuth client, not refreshJwt
    : !account.refreshJwt || isJwtExpired(account.refreshJwt)

  return (
    <Button
      testID={`chooseAccountBtn-${account.handle}`}
      key={account.did}
      style={[a.w_full]}
      onPress={onPress}
      label={
        isCurrentAccount
          ? _(msg`Continue as ${account.handle} (currently signed in)`)
          : _(msg`Sign in as ${account.handle}`)
      }>
      {({hovered, pressed}) => (
        <View
          style={[
            a.flex_1,
            a.flex_row,
            a.align_center,
            useCompactSwitcher ? a.px_md : a.p_lg,
            a.gap_sm,
            useCompactSwitcher ? {height: 56} : null,
            (hovered || pressed || isPendingAccount) && t.atoms.bg_contrast_25,
          ]}>
          <UserAvatar
            avatar={profile?.avatar}
            size={useCompactSwitcher ? 36 : 48}
            type={profile?.associated?.labeler ? 'labeler' : 'user'}
            live={live}
            hideLiveBadge
          />

          <View style={[a.flex_1, a.gap_2xs, a.pr_2xl]}>
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <Text
                emoji
                style={[
                  useCompactSwitcher ? a.font_semi_bold : a.font_medium,
                  a.leading_tight,
                  useCompactSwitcher ? null : a.text_md,
                ]}
                numberOfLines={1}>
                {sanitizeDisplayName(
                  profile?.displayName || profile?.handle || account.handle,
                )}
              </Text>
              {profile && (
                <ProfileBadges
                  profile={profile}
                  size="sm"
                  style={[{marginTop: -2}]}
                />
              )}
            </View>
            <Text
              style={[
                a.leading_tight,
                t.atoms.text_contrast_medium,
                useCompactSwitcher ? null : a.text_sm,
              ]}>
              {sanitizeHandle(account.handle, '@')}
            </Text>
            {isLoggedOut && (
              <Text
                style={[
                  a.leading_tight,
                  a.text_xs,
                  a.italic,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>Logged out</Trans>
              </Text>
            )}
          </View>

          {isCurrentAccount ? (
            useCompactSwitcher ? (
              <CheckIcon size="sm" style={[{color: t.palette.positive_500}]} />
            ) : (
              <View
                style={[
                  {
                    width: 20,
                    height: 20,
                    backgroundColor: t.palette.positive_500,
                  },
                  getShapeStyle(
                    enableSquareButtons,
                    a.rounded_sm,
                    a.rounded_full,
                  ),
                  a.justify_center,
                  a.align_center,
                ]}>
                <CheckIcon size="xs" style={[{color: t.palette.white}]} />
              </View>
            )
          ) : (
            <ChevronIcon
              size={useCompactSwitcher ? 'sm' : 'md'}
              style={[
                useCompactSwitcher ? t.atoms.text : t.atoms.text_contrast_low,
              ]}
            />
          )}
        </View>
      )}
    </Button>
  )
}
