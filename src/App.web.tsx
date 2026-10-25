import '#/logger/sentry/setup' // must be near top
import './style.css'

import {Fragment, useEffect, useState} from 'react'
import {KeyboardProvider as KeyboardControllerProvider} from 'react-native-keyboard-controller'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {BackgroundNotificationPreferencesProvider} from '@bsky.app/expo-background-notification-handler/src/BackgroundNotificationHandlerProvider'
import {useLingui} from '@lingui/react/macro'

import {Provider as HotkeysProvider} from '#/lib/hotkeys'
import {SafeAreaOverride} from '#/lib/pwa-safe-area'
import {QueryProvider} from '#/lib/react-query'
import {ThemeProvider} from '#/lib/ThemeContext'
import {Provider as TranslateOnDeviceProvider} from '#/lib/translation'
import I18nProvider from '#/locale/i18nProvider'
import {logger} from '#/logger'
import {Sentry} from '#/logger/sentry/lib'
import {identifyDevice} from '#/logger/sentry/user'
import {Provider as A11yProvider} from '#/state/a11y'
import {
  prefetchAppConfig,
  Provider as AppConfigProvider,
} from '#/state/appConfig'
import {Provider as MutedThreadsProvider} from '#/state/cache/thread-mutes'
import {Provider as DialogStateProvider} from '#/state/dialogs'
import {Provider as EmailVerificationProvider} from '#/state/email-verification'
import {listenSessionDropped} from '#/state/events'
import {Provider as HomeBadgeProvider} from '#/state/home-badge'
import {MessagesProvider} from '#/state/messages'
import {init as initPersistedState} from '#/state/persisted'
import {Provider as PrefsStateProvider} from '#/state/preferences'
import {BetaUserStorageSync} from '#/state/preferences/beta-user-sync'
import {Provider as LabelDefsProvider} from '#/state/preferences/label-defs'
import {Provider as ModerationOptsProvider} from '#/state/preferences/moderation-opts'
import {Provider as UnreadNotifsProvider} from '#/state/queries/notifications/unread'
import {Provider as ServiceConfigProvider} from '#/state/service-config'
import {
  Provider as SessionProvider,
  type SessionAccount,
  useSession,
  useSessionApi,
} from '#/state/session'
import {
  completeWebOAuth,
  readOAuthCallbackParams,
} from '#/state/session/oauth-appview-switch'
import {isOAuthPopupComplete} from '#/state/session/oauth-config'
import {
  consumeOAuthReturnUrl,
  saveOAuthCallbackError,
} from '#/state/session/oauth-web-return-url'
import {
  canAttemptSessionResume,
  readLastActiveAccount,
} from '#/state/session/util'
import {Provider as ShellStateProvider} from '#/state/shell'
import {Provider as ComposerProvider} from '#/state/shell/composer'
import {Provider as LandingProvider} from '#/state/shell/landing'
import {
  Provider as LoggedOutViewProvider,
  useLoggedOutViewControls,
} from '#/state/shell/logged-out'
import {Provider as OnboardingProvider} from '#/state/shell/onboarding'
import {Provider as ProgressGuideProvider} from '#/state/shell/progress-guide'
import {Provider as SelectedFeedProvider} from '#/state/shell/selected-feed'
import {Provider as HiddenRepliesProvider} from '#/state/threadgate-hidden-replies'
import {Shell} from '#/view/shell/index'
import {ThemeProvider as Alf} from '#/alf'
import {useColorModeTheme} from '#/alf/util/useColorModeTheme'
import {Provider as ContextMenuProvider} from '#/components/ContextMenu'
import {EphemeralAccountSwitcherRootScope} from '#/components/EphemeralAccountSwitcher'
import {useLandingEntry} from '#/components/hooks/useLandingEntry'
import {Provider as IntentDialogProvider} from '#/components/intents/IntentDialogs'
import {Provider as LightboxStateProvider} from '#/components/Lightbox/state'
import {Provider as PolicyUpdateOverlayProvider} from '#/components/PolicyUpdateOverlay'
import {Provider as PortalProvider} from '#/components/Portal'
import {Provider as ActiveVideoProvider} from '#/components/Post/Embed/VideoEmbed/ActiveVideoWebContext'
import {Provider as VideoVolumeProvider} from '#/components/Post/Embed/VideoEmbed/VideoVolumeContext'
import * as Toast from '#/components/Toast'
import {ToastOutlet} from '#/components/Toast'
import {
  prefetchAgeAssuranceConfig,
  Provider as AgeAssuranceV2Provider,
} from '#/ageAssurance'
import {
  AnalyticsContext,
  AnalyticsFeaturesContext,
  features,
  setupDeviceId,
} from '#/analytics'
import {getDeviceId} from '#/analytics/identifiers'
import {useSessionActivity} from '#/analytics/useSessionActivity'
import {
  prefetchLiveEvents,
  Provider as LiveEventsProvider,
} from '#/features/liveEvents/context'
import {SettingsSyncGate} from '#/features/settingsSync'
import * as Geo from '#/geolocation'
import {Splash} from '#/Splash'
import {Provider as HideBottomBarBorderProvider} from './lib/hooks/useHideBottomBarBorder'
import {cleanError} from './lib/strings/errors'

// For local development: the OAuth loopback spec requires IP-based origins
// (127.0.0.1), not "localhost". The auth server redirects to 127.0.0.1, but
// IndexedDB is per-origin, so PKCE state stored on "localhost" is unreachable
// from "127.0.0.1". Redirect immediately so both signIn() and the callback
// use the same origin.
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  const url = new URL(window.location.href)
  url.hostname = '127.0.0.1'
  window.location.replace(url.href)
}

void identifyDevice(getDeviceId(), setupDeviceId)

/**
 * Begin geolocation ASAP
 */
void Geo.resolve()
void prefetchAgeAssuranceConfig()
void prefetchLiveEvents()
void prefetchAppConfig()

function InnerApp() {
  const [isReady, setIsReady] = useState(false)
  const {currentAccount} = useSession()
  const {resumeSession, login} = useSessionApi()
  const {requestSwitchToAccount, setShowLoggedOut} = useLoggedOutViewControls()
  const theme = useColorModeTheme()
  const {t: l} = useLingui()
  const hasCheckedLanding = useLandingEntry()

  // init
  useEffect(() => {
    async function onLaunch(account?: SessionAccount) {
      try {
        // Check for OAuth callback params first (loopback redirects to /)
        if (readOAuthCallbackParams()) {
          try {
            const completed = await completeWebOAuth(async session => {
              await login(
                {
                  service: '',
                  identifier: '',
                  password: '',
                  oauthSession: session,
                },
                'LoginForm',
              )
            })
            if (completed) {
              setShowLoggedOut(false)
              const returnUrl = consumeOAuthReturnUrl()
              if (returnUrl) {
                window.history.replaceState(null, '', returnUrl)
                return
              }

              // Clear hash fragment after processing
              window.history.replaceState(null, '', window.location.pathname)
              return
            }
          } catch (e) {
            if (isOAuthPopupComplete(e)) return
            const error =
              e instanceof Error ? cleanError(e.message) : cleanError(String(e))
            logger.error('OAuth callback failed', {
              error: e instanceof Error ? e.message : String(e),
            })

            const returnUrl = consumeOAuthReturnUrl()
            if (account && canAttemptSessionResume(account)) {
              try {
                await resumeSession(account)
                setShowLoggedOut(false)
                if (returnUrl) {
                  window.history.replaceState(null, '', returnUrl)
                } else {
                  window.history.replaceState(
                    null,
                    '',
                    window.location.pathname,
                  )
                }
                return
              } catch (resumeError) {
                logger.error('OAuth callback recovery failed', {
                  error:
                    resumeError instanceof Error
                      ? resumeError.message
                      : String(resumeError),
                })
              }
            }

            saveOAuthCallbackError(error)
            requestSwitchToAccount({
              requestedAccount: account?.did ?? 'none',
            })
            if (returnUrl) {
              window.history.replaceState(null, '', returnUrl)
            } else {
              window.history.replaceState(null, '', window.location.pathname)
            }
            return
          }
        }

        if (account) {
          await resumeSession(account)
        } else {
          await features.init
        }
      } catch (e) {
        logger.warn('session: resumeSession failed', {message: e})
      } finally {
        // OAuth success and cancellation recovery both return early.
        setIsReady(true)
      }
    }
    const account = readLastActiveAccount()
    void onLaunch(account)
  }, [resumeSession, login, requestSwitchToAccount, setShowLoggedOut])

  useEffect(() => {
    return listenSessionDropped(() => {
      Toast.show(l`Sorry! Your session expired. Please sign in again.`, {
        type: 'info',
      })
    })
  }, [l])

  return (
    <Alf theme={theme} syncDocument>
      <ThemeProvider theme={theme}>
        <ContextMenuProvider>
          <Splash isReady={isReady && hasCheckedLanding}>
            <VideoVolumeProvider>
              <ActiveVideoProvider>
                <Fragment
                  // Resets the entire tree below when it changes:
                  key={currentAccount?.did}>
                  <AnalyticsFeaturesContext>
                    <QueryProvider currentDid={currentAccount?.did}>
                      <BetaUserStorageSync />
                      <SettingsSyncGate>
                        <PolicyUpdateOverlayProvider>
                          <LiveEventsProvider>
                            <AgeAssuranceV2Provider>
                              <ComposerProvider>
                                <MessagesProvider>
                                  {/* LabelDefsProvider MUST come before ModerationOptsProvider */}
                                  <LabelDefsProvider>
                                    <ModerationOptsProvider>
                                      <LoggedOutViewProvider>
                                        <SelectedFeedProvider>
                                          <HiddenRepliesProvider>
                                            <HomeBadgeProvider>
                                              <UnreadNotifsProvider>
                                                <BackgroundNotificationPreferencesProvider>
                                                  <MutedThreadsProvider>
                                                    <SafeAreaProvider>
                                                      <SafeAreaOverride>
                                                        <ProgressGuideProvider>
                                                          <ServiceConfigProvider>
                                                            <EmailVerificationProvider>
                                                              <HideBottomBarBorderProvider>
                                                                <IntentDialogProvider>
                                                                  <TranslateOnDeviceProvider>
                                                                    <HotkeysProvider>
                                                                      <EphemeralAccountSwitcherRootScope>
                                                                        <Shell />
                                                                      </EphemeralAccountSwitcherRootScope>
                                                                      <ToastOutlet />
                                                                    </HotkeysProvider>
                                                                  </TranslateOnDeviceProvider>
                                                                </IntentDialogProvider>
                                                              </HideBottomBarBorderProvider>
                                                            </EmailVerificationProvider>
                                                          </ServiceConfigProvider>
                                                        </ProgressGuideProvider>
                                                      </SafeAreaOverride>
                                                    </SafeAreaProvider>
                                                  </MutedThreadsProvider>
                                                </BackgroundNotificationPreferencesProvider>
                                              </UnreadNotifsProvider>
                                            </HomeBadgeProvider>
                                          </HiddenRepliesProvider>
                                        </SelectedFeedProvider>
                                      </LoggedOutViewProvider>
                                    </ModerationOptsProvider>
                                  </LabelDefsProvider>
                                </MessagesProvider>
                              </ComposerProvider>
                            </AgeAssuranceV2Provider>
                          </LiveEventsProvider>
                        </PolicyUpdateOverlayProvider>
                      </SettingsSyncGate>
                    </QueryProvider>
                  </AnalyticsFeaturesContext>
                </Fragment>
              </ActiveVideoProvider>
            </VideoVolumeProvider>
          </Splash>
        </ContextMenuProvider>
      </ThemeProvider>
    </Alf>
  )
}

function App() {
  useSessionActivity()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void Promise.all([initPersistedState(), Geo.resolve(), setupDeviceId]).then(
      () => setIsReady(true),
    )
  }, [])

  if (!isReady) {
    return null
  }

  /*
   * NOTE: only nothing here can depend on other data or session state, since
   * that is set up in the InnerApp component above.
   */
  return (
    <Geo.Provider>
      <AppConfigProvider>
        <A11yProvider>
          <KeyboardControllerProvider>
            <OnboardingProvider>
              <AnalyticsContext>
                <SessionProvider>
                  <PrefsStateProvider>
                    <I18nProvider>
                      <ShellStateProvider>
                        <DialogStateProvider>
                          <LightboxStateProvider>
                            <PortalProvider>
                              <LandingProvider>
                                <InnerApp />
                              </LandingProvider>
                            </PortalProvider>
                          </LightboxStateProvider>
                        </DialogStateProvider>
                      </ShellStateProvider>
                    </I18nProvider>
                  </PrefsStateProvider>
                </SessionProvider>
              </AnalyticsContext>
            </OnboardingProvider>
          </KeyboardControllerProvider>
        </A11yProvider>
      </AppConfigProvider>
    </Geo.Provider>
  )
}

export default Sentry.wrap(App)
