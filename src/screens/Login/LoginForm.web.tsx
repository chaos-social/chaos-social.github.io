import {useRef, useState} from 'react'
import {Keyboard, LayoutAnimation, View} from 'react-native'
import {type ComAtprotoServerDescribeServer} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {getWebOAuthClient} from '#/state/session/oauth-web-client'
import {atoms as a} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Loader} from '#/components/Loader'
import {FormContainer} from './FormContainer'

type ServiceDescription = ComAtprotoServerDescribeServer.OutputSchema

/**
 * Web-specific LoginForm that uses OAuth handle-only flow.
 * On web, users enter their handle and are redirected to their PDS
 * authorization server for approval.
 *
 * Accepts the same props as the native LoginForm for compatibility with
 * Login/index.tsx, but only uses a subset of them.
 */
export const LoginForm = ({
  error,
  initialHandle,
  setError,
  onPressBack,
}: {
  error: string
  serviceUrl?: string | undefined
  serviceDescription: ServiceDescription | undefined
  initialHandle: string
  setError: (v: string) => void
  setServiceUrl: (v: string) => void
  onPressRetryConnect: () => void
  onPressBack: () => void
  onPressForgotPassword: () => void
  onAttemptSuccess: () => void
  onAttemptFailed: () => void
  debouncedResolveService: (identifier: string) => void
  isResolvingService: boolean
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const identifierValueRef = useRef<string>(initialHandle || '')
  const {_} = useLingui()

  const onPressNext = async () => {
    if (isProcessing) return
    Keyboard.dismiss()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setError('')

    const identifier = identifierValueRef.current.trim()

    if (!identifier) {
      setError(_(msg`Please enter your username or handle`))
      return
    }

    setIsProcessing(true)

    try {
      const client = getWebOAuthClient()
      await client.signIn(identifier)
      // Browser will redirect to authorization server
    } catch (e: any) {
      const errMsg = e.toString()
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setIsProcessing(false)
      if (isNetworkError(e)) {
        logger.warn('Failed to start OAuth sign-in due to network error', {
          error: errMsg,
        })
        setError(
          _(
            msg`Unable to contact your service. Please check your Internet connection.`,
          ),
        )
      } else {
        logger.warn('Failed to start OAuth sign-in', {error: errMsg})
        setError(cleanError(errMsg))
      }
    }
  }

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      <View>
        <TextField.LabelText>
          <Trans>Account</Trans>
        </TextField.LabelText>
        <View style={[a.gap_sm]}>
          <TextField.Root>
            <TextField.Icon icon={At} />
            <TextField.Input
              testID="loginUsernameInput"
              label={_(msg`Username or handle`)}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="done"
              textContentType="username"
              defaultValue={initialHandle || ''}
              onChangeText={v => {
                identifierValueRef.current = v
              }}
              onSubmitEditing={onPressNext}
              blurOnSubmit={false}
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Enter your handle (e.g. alice.bsky.social)`,
              )}
            />
          </TextField.Root>
        </View>
      </View>
      <FormError error={error} />
      <View style={[a.flex_row, a.align_center, a.pt_md]}>
        <Button
          label={_(msg`Back`)}
          variant="solid"
          color="secondary"
          size="large"
          onPress={onPressBack}>
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
        <View style={a.flex_1} />
        <Button
          testID="loginNextButton"
          label={_(msg`Sign in`)}
          accessibilityHint={_(msg`Redirects to your authorization server`)}
          color="primary"
          size="large"
          onPress={onPressNext}>
          <ButtonText>
            <Trans>Sign in</Trans>
          </ButtonText>
          {isProcessing && <ButtonIcon icon={Loader} />}
        </Button>
      </View>
    </FormContainer>
  )
}
