import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {type GestureResponderEvent} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useProfileQuery, useProfilesQuery} from '#/state/queries/profile'
import {type SessionAccount, useSession} from '#/state/session'
import {SwitchMenuItems} from '#/view/shell/desktop/LeftNav'
import {useDialogControl} from '#/components/Dialog'
import {SwitchAccountDialog} from '#/components/dialogs/SwitchAccount'
import {
  EphemeralAccountPicker,
  useAccountPickerControl,
} from '#/components/EphemeralAccountPicker'
import {type AccountPickerRequest} from '#/components/EphemeralAccountPicker/types'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import {IS_WEB_TOUCH_DEVICE} from '#/env'
import {type app} from '#/lexicons'

type AccountListItem = {
  account: SessionAccount
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}

export type SwitcherTriggerProps = {
  ref: null
  onPress: (() => void) | undefined
  onLongPress?: ((event?: GestureResponderEvent) => void) | undefined
  onFocus: () => void
  onBlur: () => void
  onPressIn: () => void
  onPressOut: () => void
  accessibilityLabel: string
  accessibilityRole: 'button'
}

type EphemeralAccountSwitcherContextValue = {
  hasAlternateAccounts: boolean
  currentProfile?: app.bsky.actor.defs.ProfileViewDetailed
  switcherAccounts: AccountListItem[]
  signOutPromptControl: ReturnType<typeof Prompt.usePromptControl>
  openAccountPicker: (request: AccountPickerRequest) => void
}

type EphemeralAccountSwitcherData = Pick<
  EphemeralAccountSwitcherContextValue,
  'currentProfile' | 'hasAlternateAccounts' | 'switcherAccounts'
>

const EphemeralAccountSwitcherContext =
  createContext<EphemeralAccountSwitcherContextValue | null>(null)

const noopTriggerProps: SwitcherTriggerProps = {
  ref: null,
  onPress: undefined,
  onLongPress: undefined,
  onFocus: () => {},
  onBlur: () => {},
  onPressIn: () => {},
  onPressOut: () => {},
  accessibilityLabel: '',
  accessibilityRole: 'button',
}

function useEphemeralAccountSwitcherData(
  selectedDid: string,
  currentProfileFromBatch = false,
) {
  const {accounts} = useSession()
  const {data: currentProfileQuery} = useProfileQuery({
    did: currentProfileFromBatch ? undefined : selectedDid,
  })
  const {data} = useProfilesQuery({
    handles: accounts
      .filter(account => currentProfileFromBatch || account.did !== selectedDid)
      .map(account => account.did),
  })
  const profiles = data?.profiles
  const currentProfile = currentProfileFromBatch
    ? profiles?.find(profile => profile.did === selectedDid)
    : currentProfileQuery

  const switcherAccounts = useMemo<AccountListItem[]>(
    () =>
      accounts
        .filter(account => account.did !== selectedDid)
        .map(account => ({
          account,
          profile: profiles?.find(p => p.did === account.did),
        })),
    [accounts, profiles, selectedDid],
  )

  return {
    switcherAccounts,
    hasAlternateAccounts: switcherAccounts.length > 0,
    currentProfile,
  }
}

function EphemeralAccountSwitcherProvider({
  data: {switcherAccounts, hasAlternateAccounts, currentProfile},
  signOutPromptControl,
  children,
}: {
  data: EphemeralAccountSwitcherData
  signOutPromptControl: ReturnType<typeof Prompt.usePromptControl>
  children: React.ReactNode
}) {
  const pickerControl = useAccountPickerControl()
  const {open} = pickerControl
  const [request, setRequest] = useState<AccountPickerRequest | null>(null)
  const openAccountPicker = useCallback(
    (next: NonNullable<typeof request>) => {
      setRequest(next)
      open()
    },
    [open],
  )
  const contextValue = useMemo<EphemeralAccountSwitcherContextValue>(
    () => ({
      hasAlternateAccounts,
      currentProfile,
      switcherAccounts,
      signOutPromptControl,
      openAccountPicker,
    }),
    [
      openAccountPicker,
      currentProfile,
      hasAlternateAccounts,
      signOutPromptControl,
      switcherAccounts,
    ],
  )

  return (
    <EphemeralAccountSwitcherContext.Provider value={contextValue}>
      {children}
      <EphemeralAccountPicker
        control={pickerControl}
        request={request}
        accounts={switcherAccounts}
        signOutPromptControl={signOutPromptControl}
      />
    </EphemeralAccountSwitcherContext.Provider>
  )
}

export function EphemeralAccountSwitcherScope({
  selectedDid,
  currentProfileFromBatch = false,
  children,
}: {
  selectedDid: string
  currentProfileFromBatch?: boolean
  children: React.ReactNode
}) {
  const data = useEphemeralAccountSwitcherData(
    selectedDid,
    currentProfileFromBatch,
  )
  const signOutPromptControl = Prompt.usePromptControl()

  return (
    <EphemeralAccountSwitcherProvider
      data={data}
      signOutPromptControl={signOutPromptControl}>
      {children}
    </EphemeralAccountSwitcherProvider>
  )
}

/**
 * Provides one shared account/profile query and prompt control for the active
 * app shell. Single-account sessions skip the provider entirely.
 */
export function EphemeralAccountSwitcherRootScope({
  children,
}: React.PropsWithChildren) {
  const {accounts, currentAccount} = useSession()

  if (accounts.length < 2 || !currentAccount) return children

  return (
    <EphemeralAccountSwitcherScope
      selectedDid={currentAccount.did}
      currentProfileFromBatch>
      {children}
    </EphemeralAccountSwitcherScope>
  )
}

export function useEphemeralAccountSwitcher() {
  const context = useContext(EphemeralAccountSwitcherContext)
  if (!context) {
    throw new Error(
      'useEphemeralAccountSwitcher must be used within EphemeralAccountSwitcherScope',
    )
  }
  return context
}

type EphemeralAccountSwitcherProps = {
  /** Open the picker when this switcher first mounts. */
  defaultOpen?: boolean
  selectedDid: string
  title: string
  onSelectAccount: (account: SessionAccount) => void
  triggerBehavior?: 'press' | 'longPress'
  accounts?: AccountListItem[]
  renderTrigger: (args: {
    currentProfile?: app.bsky.actor.defs.ProfileViewDetailed
    triggerProps: SwitcherTriggerProps
  }) => React.ReactNode
}

export function EphemeralAccountSwitcher(props: EphemeralAccountSwitcherProps) {
  const context = useContext(EphemeralAccountSwitcherContext)
  if (context && props.triggerBehavior === 'longPress') {
    return <EphemeralAccountSwitcherFromScope {...props} />
  }
  return <StandaloneEphemeralAccountSwitcher {...props} />
}

function StandaloneEphemeralAccountSwitcher(
  props: EphemeralAccountSwitcherProps,
) {
  const data = useEphemeralAccountSwitcherData(props.selectedDid)
  return <EphemeralAccountSwitcherWithData {...props} data={data} />
}

export function EphemeralAccountSwitcherFromScope(
  props: EphemeralAccountSwitcherProps,
) {
  const data = useEphemeralAccountSwitcher()
  if (props.triggerBehavior === 'longPress') {
    return props.renderTrigger({
      currentProfile: data.currentProfile,
      triggerProps: {
        ...noopTriggerProps,
        onLongPress: data.hasAlternateAccounts
          ? event =>
              data.openAccountPicker({
                title: props.title,
                onSelectAccount: props.onSelectAccount,
                target: event?.target,
                pointerHeld: event?.type === 'pointerdown',
              })
          : undefined,
      },
    })
  }
  return <EphemeralAccountSwitcherWithData {...props} data={data} />
}

function EphemeralAccountSwitcherWithData({
  defaultOpen = false,
  selectedDid,
  title,
  onSelectAccount,
  triggerBehavior = 'press',
  accounts: accountsOverride,
  renderTrigger,
  data,
}: EphemeralAccountSwitcherProps & {
  data: EphemeralAccountSwitcherData
}) {
  const {t: l} = useLingui()
  const {switcherAccounts, hasAlternateAccounts, currentProfile} = data
  const menuAccounts = accountsOverride ?? switcherAccounts
  const control = useDialogControl()
  const signOutPromptControl = Prompt.usePromptControl()
  const menuControl = Menu.useMenuControl()
  const usesDialog = IS_WEB_TOUCH_DEVICE || triggerBehavior === 'longPress'
  const open = usesDialog ? control.open : menuControl.open
  const openedInitially = useRef(false)

  useEffect(() => {
    if (
      !defaultOpen ||
      openedInitially.current ||
      !hasAlternateAccounts ||
      menuAccounts.length === 0
    )
      return
    // Let the composer's focus scope mount before the picker takes focus.
    const timeout = setTimeout(() => {
      openedInitially.current = true
      open()
    }, 0)
    return () => clearTimeout(timeout)
  }, [defaultOpen, hasAlternateAccounts, menuAccounts.length, open])

  if (!hasAlternateAccounts || menuAccounts.length === 0) {
    return renderTrigger({
      currentProfile,
      triggerProps: {
        ...noopTriggerProps,
        accessibilityLabel: l`Switch accounts`,
      },
    })
  }

  if (IS_WEB_TOUCH_DEVICE || triggerBehavior === 'longPress') {
    const openProps =
      triggerBehavior === 'longPress'
        ? {onPress: undefined, onLongPress: control.open}
        : {onPress: control.open, onLongPress: undefined}

    return (
      <>
        {renderTrigger({
          currentProfile,
          triggerProps: {
            ref: null,
            ...openProps,
            onFocus: () => {},
            onBlur: () => {},
            onPressIn: () => {},
            onPressOut: () => {},
            accessibilityLabel: l`Switch accounts`,
            accessibilityRole: 'button',
          },
        })}
        <SwitchAccountDialog
          control={control}
          accounts={menuAccounts.map(item => item.account)}
          pendingDid={null}
          selectedDid={selectedDid}
          title={title}
          showAddAccount={false}
          onSelectAccount={onSelectAccount}
        />
      </>
    )
  }

  return (
    <Menu.Root control={menuControl}>
      <Menu.Trigger label={l`Switch accounts`}>
        {({props}) =>
          renderTrigger({
            currentProfile,
            triggerProps: {
              ...(props as unknown as SwitcherTriggerProps),
            },
          })
        }
      </Menu.Trigger>
      <SwitchMenuItems
        accounts={menuAccounts}
        signOutPromptControl={signOutPromptControl}
        showExtraButtons={false}
        showAddAccount={false}
        title={title}
        onSelectAccount={onSelectAccount}
      />
    </Menu.Root>
  )
}
