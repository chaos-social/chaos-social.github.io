import {useCallback, useState} from 'react'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {logger} from '#/logger'
import {type SessionAccount, useSessionApi} from '#/state/session'
import {canAttemptSessionResume} from '#/state/session/util'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import * as Toast from '#/components/Toast'
import {useAnalytics} from '#/analytics'
import {type Metrics} from '#/analytics/metrics'
import {storeNavigationStateForAccountSwitch} from '#/Navigation'

export function useAccountSwitcher() {
  const ax = useAnalytics()
  const [pendingDid, setPendingDid] = useState<string | null>(null)
  const {_} = useLingui()
  const {resumeSession} = useSessionApi()
  const {requestSwitchToAccount} = useLoggedOutViewControls()

  const onPressSwitchAccount = useCallback(
    async (
      account: SessionAccount,
      logContext: Metrics['account:loggedIn']['logContext'],
    ) => {
      if (pendingDid) {
        // The session API isn't resilient to race conditions so let's just ignore this.
        return
      }
      try {
        setPendingDid(account.did)
        if (canAttemptSessionResume(account)) {
          // Store navigation state before switching so user stays on the same page
          storeNavigationStateForAccountSwitch()
          await resumeSession(account, true)
          ax.metric('account:loggedIn', {logContext, withPassword: false})
          Toast.show(_(msg`Signed in as @${account.handle}`))
        } else {
          requestSwitchToAccount({requestedAccount: account.did})
          Toast.show(_(msg`Please sign in as @${account.handle}`), {
            type: 'warning',
          })
        }
      } catch (e: any) {
        logger.error(`switch account: selectAccount failed`, {
          message: e instanceof Error ? e.message : String(e),
        })
        requestSwitchToAccount({requestedAccount: account.did})
        Toast.show(_(msg`Please sign in as @${account.handle}`), {
          type: 'warning',
        })
      } finally {
        setPendingDid(null)
      }
    },
    [_, ax, resumeSession, requestSwitchToAccount, pendingDid],
  )

  return {onPressSwitchAccount, pendingDid}
}
