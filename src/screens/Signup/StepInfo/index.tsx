import {useEffect, useRef, useState} from 'react'
import {type TextInput, View} from 'react-native'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import * as EmailValidator from 'email-validator'
import type tldts from 'tldts'

import {DEFAULT_SERVICE} from '#/lib/constants'
import {isEmailMaybeInvalid} from '#/lib/strings/email'
import {logger} from '#/logger'
import {useSignupContext} from '#/screens/Signup/state'
import {Policies} from '#/screens/Signup/StepInfo/Policies'
import {atoms as a, native} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {DeviceLocationRequestDialog} from '#/components/dialogs/DeviceLocationRequestDialog'
import {Divider} from '#/components/Divider'
import * as DateField from '#/components/forms/DateField'
import {type DateFieldRef} from '#/components/forms/DateField/types'
import {FormError} from '#/components/forms/FormError'
import {HostingProvider} from '#/components/forms/HostingProvider'
import * as TextField from '#/components/forms/TextField'
import {Envelope_Stroke2_Corner0_Rounded as Envelope} from '#/components/icons/Envelope'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {createStaticClick, SimpleInlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {usePreemptivelyCompleteActivePolicyUpdate} from '#/components/PolicyUpdateOverlay/usePreemptivelyCompleteActivePolicyUpdate'
import {ScreenTransition} from '#/components/ScreenTransition'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {
  MIN_ACCESS_AGE,
  useAgeAssuranceRegionConfigWithFallback,
} from '#/ageAssurance/util'
import {useAnalytics} from '#/analytics'
import {IS_NATIVE, IS_WEB} from '#/env'
import {useDeviceGeolocationApi} from '#/geolocation'
import {BackNextButtons} from '../BackNextButtons'

function sanitizeDate(date: Date): Date {
  if (!date || date.toString() === 'Invalid Date') {
    logger.error(`Create account: handled invalid date for birthDate`, {
      hasDate: !!date,
    })
    return new Date()
  }
  return date
}

export function StepInfo({
  onPressBack,
  onPressSignIn,
  isServerError,
  refetchServer,
  isLoadingStarterPack,
}: {
  onPressBack: () => void
  onPressSignIn: () => void
  isServerError: boolean
  refetchServer: () => void
  isLoadingStarterPack: boolean
}) {
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const {state, dispatch} = useSignupContext()
  const preemptivelyCompleteActivePolicyUpdate =
    usePreemptivelyCompleteActivePolicyUpdate()

  const inviteCodeValueRef = useRef<string>(state.inviteCode)
  const emailValueRef = useRef<string>(state.email)
  const prevEmailValueRef = useRef<string>(state.email)
  const passwordValueRef = useRef<string>(state.password)

  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const birthdateInputRef = useRef<DateFieldRef>(null)

  const aaRegionConfig = useAgeAssuranceRegionConfigWithFallback()
  const {setDeviceGeolocation} = useDeviceGeolocationApi()
  const locationControl = Dialog.useDialogControl()
  const isOverRegionMinAccessAge = true
  const isOverAppMinAccessAge = true
  const isOverMinAdultAge = true
  const isDeviceGeolocationGranted = true

  const [hasWarnedEmail, setHasWarnedEmail] = useState<boolean>(false)

  const tldtsRef = useRef<typeof tldts>(undefined)
  useEffect(() => {
    // @ts-expect-error - valid path
    void import('tldts/dist/index.cjs.min.js').then(tldts => {
      tldtsRef.current = tldts
    })
    // This will get used in the avatar creator a few steps later, so lets preload it now
    // @ts-expect-error - valid path
    void import('react-native-view-shot/src/index')
  }, [])

  const onNextPress = () => {
    const inviteCode = inviteCodeValueRef.current
    const email = emailValueRef.current
    const emailChanged = prevEmailValueRef.current !== email
    const password = passwordValueRef.current

    if (!isOverRegionMinAccessAge) {
      return
    }

    if (state.serviceUrl === DEFAULT_SERVICE) {
      return dispatch({
        type: 'setError',
        value: l`Please choose a 3rd party service host, or sign up on bsky.app.`,
      })
    }

    if (state.serviceDescription?.inviteCodeRequired && !inviteCode) {
      return dispatch({
        type: 'setError',
        value: l`Please enter your invite code.`,
        field: 'invite-code',
      })
    }
    if (!email) {
      return dispatch({
        type: 'setError',
        value: l`Please enter your email.`,
        field: 'email',
      })
    }
    if (!EmailValidator.validate(email)) {
      return dispatch({
        type: 'setError',
        value: l`Your email appears to be invalid.`,
        field: 'email',
      })
    }
    if (emailChanged && tldtsRef.current) {
      if (isEmailMaybeInvalid(email, tldtsRef.current)) {
        prevEmailValueRef.current = email
        setHasWarnedEmail(true)
        return dispatch({
          type: 'setError',
          value: l`Please double-check that you have entered your email address correctly.`,
        })
      }
    } else if (hasWarnedEmail) {
      setHasWarnedEmail(false)
    }
    prevEmailValueRef.current = email
    if (!password) {
      return dispatch({
        type: 'setError',
        value: l`Please choose your password.`,
        field: 'password',
      })
    }
    if (password.length < 8) {
      return dispatch({
        type: 'setError',
        value: l`Your password must be at least 8 characters long.`,
        field: 'password',
      })
    }

    preemptivelyCompleteActivePolicyUpdate()
    dispatch({type: 'setInviteCode', value: inviteCode})
    dispatch({type: 'setEmail', value: email})
    dispatch({type: 'setPassword', value: password})
    dispatch({type: 'next'})
    ax.metric('signup:nextPressed', {
      activeStep: state.activeStep,
    })
  }

  return (
    <ScreenTransition direction={state.screenTransitionDirection}>
      <View style={[a.gap_md]}>
        {state.serviceUrl === DEFAULT_SERVICE && (
          <View style={[a.gap_xl]}>
            <Text style={[a.gap_md, a.leading_normal]}>
              <Trans>
                Witchsky is part of the{' '}
                {
                  <SimpleInlineLinkText
                    label={l`Atmosphere`}
                    to="https://atproto.com/">
                    <Trans>Atmosphere</Trans>
                  </SimpleInlineLinkText>
                }
                —the network of apps, services, and accounts built on the AT
                Protocol.
              </Trans>
            </Text>
            <Text style={[a.gap_md, a.leading_normal]}>
              <Trans>
                If you have one, sign in with an existing Bluesky account.
              </Trans>
            </Text>
            <View style={IS_WEB && [a.flex_row, a.justify_center]}>
              <Button
                testID="signInButton"
                onPress={onPressSignIn}
                label={l`Sign in with an Atmosphere account`}
                accessibilityHint={l`Opens flow to sign in to your existing Atmosphere account`}
                size="large"
                variant="solid"
                color="primary">
                <ButtonText>
                  <Trans>Sign in with an Atmosphere account</Trans>
                </ButtonText>
              </Button>
            </View>
            <Divider style={[a.mb_xl]} />
          </View>
        )}
        <FormError error={state.error} />
        <HostingProvider
          serviceUrl={state.serviceUrl}
          onSelectServiceUrl={v => dispatch({type: 'setServiceUrl', value: v})}
        />
        {state.serviceUrl === DEFAULT_SERVICE && (
          <Text style={[a.gap_md, a.leading_normal, a.mt_md]}>
            <Trans>
              Don't have an account provider or an existing Bluesky account? To
              create a new account on a Bluesky-hosted PDS, sign up through{' '}
              {/* TODO: Xan: change to say sign up for a Witchsky account */}
              {
                <SimpleInlineLinkText label={l`bsky.app`} to="https://bsky.app">
                  <Trans>bsky.app</Trans>
                </SimpleInlineLinkText>
              }{' '}
              first, then return to Witchsky and log in with the account you
              created.
            </Trans>
          </Text>
        )}
        {state.isLoading || isLoadingStarterPack ? (
          <View style={[a.align_center]}>
            <Loader size="xl" />
          </View>
        ) : state.serviceDescription && state.serviceUrl !== DEFAULT_SERVICE ? (
          <>
            {state.serviceDescription.inviteCodeRequired && (
              <View>
                <TextField.LabelText>
                  <Trans>Invite code</Trans>
                </TextField.LabelText>
                <TextField.Root isInvalid={state.errorField === 'invite-code'}>
                  <TextField.Icon icon={Ticket} />
                  <TextField.Input
                    onChangeText={value => {
                      inviteCodeValueRef.current = value.trim()
                      if (
                        state.errorField === 'invite-code' &&
                        value.trim().length > 0
                      ) {
                        dispatch({type: 'clearError'})
                      }
                    }}
                    label={l`Required for this provider`}
                    defaultValue={state.inviteCode}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    returnKeyType="next"
                    submitBehavior={native('submit')}
                    onSubmitEditing={native(() =>
                      emailInputRef.current?.focus(),
                    )}
                  />
                </TextField.Root>
              </View>
            )}
            <View>
              <TextField.LabelText>
                <Trans>Email</Trans>
              </TextField.LabelText>
              <TextField.Root isInvalid={state.errorField === 'email'}>
                <TextField.Icon icon={Envelope} />
                <TextField.Input
                  testID="emailInput"
                  inputRef={emailInputRef}
                  onChangeText={value => {
                    emailValueRef.current = value.trim()
                    if (hasWarnedEmail) {
                      setHasWarnedEmail(false)
                    }
                    if (
                      state.errorField === 'email' &&
                      value.trim().length > 0 &&
                      EmailValidator.validate(value.trim())
                    ) {
                      dispatch({type: 'clearError'})
                    }
                  }}
                  label={l`Enter your email address`}
                  defaultValue={state.email}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                  submitBehavior={native('submit')}
                  onSubmitEditing={native(() =>
                    passwordInputRef.current?.focus(),
                  )}
                />
              </TextField.Root>
            </View>
            <View>
              <TextField.LabelText>
                <Trans>Password</Trans>
              </TextField.LabelText>
              <TextField.Root isInvalid={state.errorField === 'password'}>
                <TextField.Icon icon={Lock} />
                <TextField.Input
                  testID="passwordInput"
                  inputRef={passwordInputRef}
                  onChangeText={value => {
                    passwordValueRef.current = value
                    if (state.errorField === 'password' && value.length >= 8) {
                      dispatch({type: 'clearError'})
                    }
                  }}
                  label={l`Choose your password`}
                  defaultValue={state.password}
                  secureTextEntry
                  autoComplete="new-password"
                  autoCapitalize="none"
                  returnKeyType="next"
                  submitBehavior={native('blurAndSubmit')}
                  onSubmitEditing={native(() =>
                    birthdateInputRef.current?.focus(),
                  )}
                  passwordRules="minlength: 8;"
                />
              </TextField.Root>
            </View>
            <View>
              <DateField.LabelText>
                <Trans>Your birth date</Trans>
              </DateField.LabelText>
              <DateField.DateField
                testID="date"
                inputRef={birthdateInputRef}
                value={state.dateOfBirth}
                onChangeDate={date => {
                  dispatch({
                    type: 'setDateOfBirth',
                    value: sanitizeDate(new Date(date)),
                  })
                }}
                label={l`Date of birth`}
                accessibilityHint={l`Select your date of birth`}
                maximumDate={new Date()}
              />
            </View>

            <View style={[a.gap_sm]}>
              <Policies serviceDescription={state.serviceDescription} />

              {!isOverRegionMinAccessAge || !isOverAppMinAccessAge ? (
                <Admonition.Outer type="error">
                  <Admonition.Row>
                    <Admonition.Icon />
                    <Admonition.Content>
                      <Admonition.Text>
                        {!isOverAppMinAccessAge ? (
                          <Plural
                            value={MIN_ACCESS_AGE}
                            other="You must be # years of age or older to create an account."
                          />
                        ) : (
                          <Plural
                            value={aaRegionConfig.minAccessAge}
                            other="You must be # years of age or older to create an account in your region."
                          />
                        )}
                      </Admonition.Text>
                      {IS_NATIVE &&
                        !isDeviceGeolocationGranted &&
                        isOverAppMinAccessAge && (
                          <Admonition.Text>
                            <Trans>
                              Have we got your location wrong?{' '}
                              <SimpleInlineLinkText
                                label={l`Tap here to confirm your location with GPS.`}
                                {...createStaticClick(() => {
                                  locationControl.open()
                                })}>
                                Tap here to confirm your location with GPS.
                              </SimpleInlineLinkText>
                            </Trans>
                          </Admonition.Text>
                        )}
                    </Admonition.Content>
                  </Admonition.Row>
                </Admonition.Outer>
              ) : !isOverMinAdultAge ? (
                <Admonition.Admonition type="warning">
                  <Trans>
                    If you are not yet an adult according to the laws of your
                    country, your parent or legal guardian must read these Terms
                    on your behalf.
                  </Trans>
                </Admonition.Admonition>
              ) : undefined}
            </View>

            {IS_NATIVE && (
              <DeviceLocationRequestDialog
                control={locationControl}
                onLocationAcquired={props => {
                  props.closeDialog(() => {
                    // set this after close!
                    setDeviceGeolocation(props.geolocation)
                    Toast.show(l`Your location has been updated.`, {
                      type: 'success',
                    })
                  })
                }}
              />
            )}
          </>
        ) : undefined}
      </View>
      <BackNextButtons
        hideNext={!isOverRegionMinAccessAge}
        showRetry={isServerError}
        isLoading={state.isLoading}
        onBackPress={onPressBack}
        onNextPress={onNextPress}
        onRetryPress={refetchServer}
        overrideNextText={hasWarnedEmail ? l`It's correct` : undefined}
      />
    </ScreenTransition>
  )
}
