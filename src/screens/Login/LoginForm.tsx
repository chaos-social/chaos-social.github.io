import {useCallback, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  type TextInput,
  View,
} from 'react-native'
import {
  ComAtprotoServerCreateSession,
  type ComAtprotoServerDescribeServer,
} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {isValidDomain} from '#/lib/strings/url-helpers'
import {logger} from '#/logger'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
import {useSessionApi} from '#/state/session'
import {getNativeOAuthClient} from '#/state/session/oauth-native-client'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a, ios, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import {HostingProvider} from '#/components/forms/HostingProvider'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_IOS} from '#/env'
import {FormContainer} from './FormContainer'

type ServiceDescription = ComAtprotoServerDescribeServer.OutputSchema

type LoginMode = 'oauth' | 'legacy'

export const LoginForm = ({
  error,
  serviceUrl,
  serviceDescription,
  initialHandle,
  setError,
  setServiceUrl,
  onPressRetryConnect,
  onPressForgotPassword,
  onAttemptSuccess,
  onAttemptFailed,
  debouncedResolveService,
  isResolvingService,
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
  const t = useTheme()
  const [mode, setMode] = useState<LoginMode>('oauth')
  const [isProcessing, setIsProcessing] = useState(false)

  const switchMode = (next: LoginMode) => {
    if (next === mode) return
    setError('')
    setMode(next)
  }

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      <View
        style={[a.flex_row, a.mb_md, a.rounded_sm, a.overflow_hidden]}
        accessibilityRole="tablist">
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{selected: mode === 'oauth'}}
          onPress={() => switchMode('oauth')}
          style={[
            a.flex_1,
            a.align_center,
            a.py_sm,
            a.border_b,
            {borderBottomWidth: 2},
            mode === 'oauth'
              ? {borderBottomColor: t.palette.primary_500}
              : {borderBottomColor: 'transparent'},
          ]}>
          <Text
            style={[
              a.text_sm,
              a.font_bold,
              mode === 'oauth'
                ? {color: t.palette.primary_500}
                : t.atoms.text_contrast_medium,
            ]}>
            <Trans>OAuth</Trans>
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{selected: mode === 'legacy'}}
          onPress={() => switchMode('legacy')}
          style={[
            a.flex_1,
            a.align_center,
            a.py_sm,
            a.border_b,
            {borderBottomWidth: 2},
            mode === 'legacy'
              ? {borderBottomColor: t.palette.primary_500}
              : {borderBottomColor: 'transparent'},
          ]}>
          <Text
            style={[
              a.text_sm,
              a.font_bold,
              mode === 'legacy'
                ? {color: t.palette.primary_500}
                : t.atoms.text_contrast_medium,
            ]}>
            <Trans>Legacy sign-in</Trans>
          </Text>
        </Pressable>
      </View>

      {mode === 'oauth' ? (
        <OAuthLoginFields
          error={error}
          initialHandle={initialHandle}
          setError={setError}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          onAttemptSuccess={onAttemptSuccess}
        />
      ) : (
        <LegacyLoginFields
          error={error}
          serviceUrl={serviceUrl}
          serviceDescription={serviceDescription}
          initialHandle={initialHandle}
          setError={setError}
          setServiceUrl={setServiceUrl}
          onPressRetryConnect={onPressRetryConnect}
          onPressForgotPassword={onPressForgotPassword}
          onAttemptSuccess={onAttemptSuccess}
          onAttemptFailed={onAttemptFailed}
          debouncedResolveService={debouncedResolveService}
          isResolvingService={isResolvingService}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      )}
    </FormContainer>
  )
}

function OAuthLoginFields({
  error,
  initialHandle,
  setError,
  isProcessing,
  setIsProcessing,
  onAttemptSuccess,
}: {
  error: string
  initialHandle: string
  setError: (v: string) => void
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
  onAttemptSuccess: () => void
}) {
  const {_} = useLingui()
  const {login} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()
  const identifierValueRef = useRef<string>(initialHandle || '')

  const onPressNext = async () => {
    if (isProcessing) return
    Keyboard.dismiss()
    setError('')

    const identifier = identifierValueRef.current.trim()

    if (!identifier) {
      setError(_(msg`Please enter your username or handle`))
      return
    }

    setIsProcessing(true)

    try {
      const client = getNativeOAuthClient()
      const session = await client.signIn(identifier)
      await login(
        {
          service: '',
          identifier: '',
          password: '',
          oauthSession: session,
        },
        'LoginForm',
      )
      onAttemptSuccess()
      setShowLoggedOut(false)
      setHasCheckedForStarterPack(true)
      requestNotificationsPermission('Login')
    } catch (e: any) {
      const errMsg = e.toString()
      setIsProcessing(false)
      if (errMsg.includes('cancelled') || errMsg.includes('dismiss')) {
        // User cancelled the browser auth flow
        return
      }
      if (isNetworkError(e)) {
        logger.warn(
          `Failed to start OAuth sign-in due to network error\n${e instanceof Error ? `${errMsg}\n${e.stack}\n${String(e.cause)}` : errMsg}`,
        )
        setError(
          _(
            msg`Unable to contact your service. Please check your Internet connection.`,
          ),
        )
      } else {
        logger.warn(
          `Failed to start OAuth sign-in\n${e instanceof Error ? `${errMsg}\n${e.stack}\n${String(e.cause)}` : errMsg}`,
        )
        setError(cleanError(errMsg))
      }
    }
  }

  return (
    <>
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
              autoFocus={!IS_IOS}
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
      <View style={[a.pt_md]}>
        <Button
          testID="loginNextButton"
          label={_(msg`Sign in`)}
          accessibilityHint={_(msg`Opens your authorization server to sign in`)}
          color="primary"
          size="large"
          onPress={onPressNext}>
          <ButtonText>
            <Trans>Sign in</Trans>
          </ButtonText>
          {isProcessing && <ButtonIcon icon={Loader} />}
        </Button>
      </View>
    </>
  )
}

function LegacyLoginFields({
  error,
  serviceUrl,
  serviceDescription,
  initialHandle,
  setError,
  setServiceUrl,
  onPressRetryConnect,
  onPressForgotPassword,
  onAttemptSuccess,
  onAttemptFailed,
  debouncedResolveService,
  isResolvingService,
  isProcessing,
  setIsProcessing,
}: {
  error: string
  serviceUrl?: string | undefined
  serviceDescription: ServiceDescription | undefined
  initialHandle: string
  setError: (v: string) => void
  setServiceUrl: (v: string) => void
  onPressRetryConnect: () => void
  onPressForgotPassword: () => void
  onAttemptSuccess: () => void
  onAttemptFailed: () => void
  debouncedResolveService: (identifier: string) => void
  isResolvingService: boolean
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {login} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()

  const [errorField, setErrorField] = useState<
    'none' | 'identifier' | 'password' | '2fa'
  >('none')
  const [isAuthFactorTokenNeeded, setIsAuthFactorTokenNeeded] = useState(false)
  const identifierValueRef = useRef<string>(initialHandle || '')
  const passwordValueRef = useRef<string>('')
  const [authFactorToken, setAuthFactorToken] = useState('')
  const identifierRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const hasFocusedOnce = useRef<boolean>(false)

  const onPressSelectService = useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const onPressNext = async () => {
    if (isProcessing || isResolvingService || serviceUrl === undefined) return
    Keyboard.dismiss()
    setError('')
    setErrorField('none')

    const identifier = identifierValueRef.current.toLowerCase().trim()
    const password = passwordValueRef.current

    if (!identifier) {
      setError(_(msg`Please enter your username`))
      setErrorField('identifier')
      return
    }

    if (!password) {
      setError(_(msg`Please enter your password`))
      return
    }

    setIsProcessing(true)

    try {
      // try to guess the handle if the user just gave their own username
      let fullIdent = identifier
      if (
        !identifier.includes('@') && // not an email
        !identifier.includes('.') && // not a domain
        serviceDescription &&
        serviceDescription.availableUserDomains.length > 0
      ) {
        let matched = false
        for (const domain of serviceDescription.availableUserDomains) {
          if (fullIdent.endsWith(domain)) {
            matched = true
          }
        }
        if (!matched) {
          fullIdent = createFullHandle(
            identifier,
            serviceDescription.availableUserDomains[0],
          )
        }
      }

      await login(
        {
          service: serviceUrl,
          identifier: fullIdent,
          password,
          authFactorToken: authFactorToken.trim(),
        },
        'LoginForm',
      )
      onAttemptSuccess()
      setShowLoggedOut(false)
      setHasCheckedForStarterPack(true)
      requestNotificationsPermission('Login')
    } catch (e: any) {
      const errMsg = e.toString()
      setIsProcessing(false)
      if (
        e instanceof ComAtprotoServerCreateSession.AuthFactorTokenRequiredError
      ) {
        setIsAuthFactorTokenNeeded(true)
      } else {
        onAttemptFailed()
        if (errMsg.includes('Token is invalid')) {
          logger.debug('Failed to login due to invalid 2fa token', {
            error: errMsg,
          })
          setError(_(msg`Invalid 2FA confirmation code.`))
          setErrorField('2fa')
        } else if (
          errMsg.includes('Authentication Required') ||
          errMsg.includes('Invalid identifier or password')
        ) {
          logger.debug('Failed to login due to invalid credentials', {
            error: errMsg,
          })
          setError(_(msg`Incorrect username or password`))
        } else if (isNetworkError(e)) {
          logger.warn('Failed to login due to network error', {error: errMsg})
          setError(
            _(
              msg`Unable to contact your service. Please check your Internet connection.`,
            ),
          )
        } else {
          logger.warn('Failed to login', {error: errMsg})
          setError(cleanError(errMsg))
        }
      }
    }
  }

  return (
    <>
      <View>
        <TextField.LabelText>
          <Trans>Hosting provider</Trans>
          {isResolvingService && (
            <ActivityIndicator
              size={10}
              color={t.palette.contrast_500}
              style={a.ml_sm}
            />
          )}
        </TextField.LabelText>
        <HostingProvider
          serviceUrl={serviceUrl}
          onSelectServiceUrl={setServiceUrl}
          onOpenDialog={onPressSelectService}
        />
      </View>
      <View>
        <TextField.LabelText>
          <Trans>Account</Trans>
        </TextField.LabelText>
        <View style={[a.gap_sm]}>
          <TextField.Root isInvalid={errorField === 'identifier'}>
            <TextField.Icon icon={At} />
            <TextField.Input
              testID="loginUsernameInput"
              inputRef={identifierRef}
              label={
                serviceUrl === undefined
                  ? _(msg`Username (full handle)`)
                  : _(msg`Username or email address`)
              }
              autoCapitalize="none"
              autoFocus={!IS_IOS}
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              textContentType="username"
              defaultValue={initialHandle || ''}
              onChangeText={v => {
                identifierValueRef.current = v
                // Trigger PDS auto-resolution for handles/DIDs
                const id = v.trim()
                if (!id) return
                if (
                  id.startsWith('did:') ||
                  (!id.includes('@') && isValidDomain(id))
                ) {
                  debouncedResolveService(id)
                }
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={() => {
                passwordRef.current?.focus()
              }}
              blurOnSubmit={false}
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Enter the username or email address you used when you created your account`,
              )}
            />
          </TextField.Root>

          <TextField.Root isInvalid={errorField === 'password'}>
            <TextField.Icon icon={Lock} />
            <TextField.Input
              testID="loginPasswordInput"
              inputRef={passwordRef}
              label={_(msg`Password`)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              returnKeyType="done"
              enablesReturnKeyAutomatically={true}
              secureTextEntry={true}
              clearButtonMode="while-editing"
              onChangeText={v => {
                passwordValueRef.current = v
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={onPressNext}
              blurOnSubmit={false}
              editable={!isProcessing}
              accessibilityHint={_(msg`Enter your password`)}
              // eslint-disable-next-line react-hooks/refs
              onLayout={ios(() => {
                if (hasFocusedOnce.current) return
                hasFocusedOnce.current = true
                identifierRef.current?.focus()
              })}
            />
            <Button
              testID="forgotPasswordButton"
              onPress={onPressForgotPassword}
              label={_(msg`Forgot password?`)}
              accessibilityHint={_(msg`Opens password reset form`)}
              variant="solid"
              color="secondary"
              style={[
                a.rounded_sm,
                {marginLeft: 'auto', left: 6, padding: 6},
                a.z_10,
              ]}>
              <ButtonText>
                <Trans>Forgot?</Trans>
              </ButtonText>
            </Button>
          </TextField.Root>
        </View>
      </View>
      {isAuthFactorTokenNeeded && (
        <View>
          <TextField.LabelText>
            <Trans>2FA Confirmation</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={errorField === '2fa'}>
            <TextField.Icon icon={Ticket} />
            <TextField.Input
              testID="loginAuthFactorTokenInput"
              label={_(msg`Confirmation code`)}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="one-time-code"
              returnKeyType="done"
              blurOnSubmit={false}
              value={authFactorToken}
              onChangeText={text => {
                setAuthFactorToken(text)
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={onPressNext}
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Input the code which has been emailed to you`,
              )}
              style={{
                textTransform: authFactorToken === '' ? 'none' : 'uppercase',
              }}
            />
          </TextField.Root>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
            <Trans>
              Check your email for a sign in code and enter it here.
            </Trans>
          </Text>
        </View>
      )}
      <FormError error={error} />
      <View style={[a.pt_md]}>
        {!serviceDescription && error ? (
          <Button
            testID="loginRetryButton"
            label={_(msg`Retry`)}
            accessibilityHint={_(msg`Retries signing in`)}
            color="primary_subtle"
            size="large"
            onPress={onPressRetryConnect}>
            <ButtonText>
              <Trans>Retry</Trans>
            </ButtonText>
          </Button>
        ) : !serviceDescription && serviceUrl !== undefined ? (
          <Button
            label={_(msg`Connecting to service...`)}
            size="large"
            color="secondary"
            disabled>
            <ButtonIcon icon={Loader} />
            <ButtonText>Connecting...</ButtonText>
          </Button>
        ) : (
          <Button
            testID="loginNextButton"
            label={_(msg`Sign in`)}
            accessibilityHint={_(msg`Navigates to the next screen`)}
            color="primary"
            size="large"
            onPress={onPressNext}
            disabled={isResolvingService || serviceUrl === undefined}>
            <ButtonText>
              <Trans>Sign in</Trans>
            </ButtonText>
            {isProcessing && <ButtonIcon icon={Loader} />}
          </Button>
        )}
      </View>
    </>
  )
}
