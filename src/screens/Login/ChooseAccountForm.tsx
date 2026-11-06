import {useCallback, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {logger} from '#/logger'
import {type SessionAccount, useSession, useSessionApi} from '#/state/session'
import {canAttemptSessionResume} from '#/state/session/util'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a, web} from '#/alf'
import {AccountList} from '#/components/AccountList'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import * as Toast from '#/components/Toast'
import {useAnalytics} from '#/analytics'
import {APP_NAME, IS_WEB} from '#/env'
import {FormContainer} from './FormContainer'

export const ChooseAccountForm = ({
  onSelectAccount,
  onPressBack,
}: {
  onSelectAccount: (account?: SessionAccount) => void
  onPressBack: () => void
}) => {
  const [error, setError] = useState('')
  const [pendingDid, setPendingDid] = useState<string | null>(null)
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const {currentAccount} = useSession()
  const {resumeSession} = useSessionApi()
  const {setShowLoggedOut} = useLoggedOutViewControls()

  const onSelect = useCallback(
    async (account: SessionAccount) => {
      if (pendingDid) {
        // The session API isn't resilient to race conditions so let's just ignore this.
        return
      }
      if (!canAttemptSessionResume(account)) {
        // Move to login form.
        onSelectAccount(account)
        return
      }
      if (account.did === currentAccount?.did) {
        setShowLoggedOut(false)
        Toast.show(l`Already signed in as @${account.handle}`)
        return
      }
      setError('')
      try {
        setPendingDid(account.did)
        await resumeSession(account, true)
        ax.metric('account:loggedIn', {
          logContext: 'ChooseAccountForm',
          withPassword: false,
        })
        Toast.show(l`Signed in as @${account.handle}`)
      } catch (err) {
        if (err instanceof Error && err.name === 'OAuthSessionBusyError') {
          setError(
            l`Sign-in is taking too long. Another ${APP_NAME} tab or window may be using this account’s session. Close that view, then try again.`,
          )
          return
        }
        if (/cancelled|dismiss|OAUTH_CANCELLED/i.test(String(err))) return
        logger.warn('choose account: initSession failed', {
          message: err instanceof Error ? err.message : String(err),
        })
        Toast.show(l`Sign in failed. Please try again.`)
        // Move to login form.
        onSelectAccount(account)
      } finally {
        setPendingDid(null)
      }
    },
    [
      currentAccount,
      resumeSession,
      pendingDid,
      onSelectAccount,
      setShowLoggedOut,
      l,
      ax,
    ],
  )

  return (
    <FormContainer
      testID="chooseAccountForm"
      titleText={<Trans>Select account</Trans>}
      style={web([a.py_2xl])}>
      {error ? <Admonition type="error">{error}</Admonition> : null}
      <View>
        {IS_WEB && (
          <TextField.LabelText>
            <Trans>Sign in as…</Trans>
          </TextField.LabelText>
        )}
        <AccountList
          onSelectAccount={account => void onSelect(account)}
          onSelectOther={() => onSelectAccount()}
          pendingDid={pendingDid}
        />
      </View>
      {IS_WEB && (
        <View style={[a.flex_row]}>
          <Button
            label={l`Back`}
            color="secondary"
            size="large"
            onPress={onPressBack}>
            <ButtonText>{l`Back`}</ButtonText>
          </Button>
          <View style={[a.flex_1]} />
        </View>
      )}
    </FormContainer>
  )
}
