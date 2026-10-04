import {useCallback, useEffect, useLayoutEffect, useState} from 'react'
import {StyleSheet, TouchableWithoutFeedback, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {StackActions, useNavigation} from '@react-navigation/native'
import {RemoveScrollBar} from 'react-remove-scroll-bar'

import {useIntentHandler} from '#/lib/hooks/useIntentHandler'
import {handlePastedLink} from '#/lib/routes/pasteLink'
import {type NavigationProp} from '#/lib/routes/types'
import {usePasteToLinkEnabled} from '#/state/preferences'
import {useSession} from '#/state/session'
import {useIsDrawerOpen, useSetDrawerOpen} from '#/state/shell'
import {useCloseAllActiveElements} from '#/state/util'
import {ErrorBoundary} from '#/view/com/util/ErrorBoundary'
import {LOGO_PATH, LOGO_VIEW_BOX} from '#/view/icons/Logo'
import {Deactivated} from '#/screens/Deactivated'
import {Takendown} from '#/screens/Takendown'
import {atoms as a, select, useBreakpoints, useTheme} from '#/alf'
import {AgeAssuranceRedirectDialog} from '#/components/ageAssurance/AgeAssuranceRedirectDialog'
import {EmailDialog} from '#/components/dialogs/EmailDialog'
import {LinkWarningDialog} from '#/components/dialogs/LinkWarning'
import {MutedWordsDialog} from '#/components/dialogs/MutedWords'
import {NuxDialogs} from '#/components/dialogs/nuxs'
import {SigninDialog} from '#/components/dialogs/Signin'
import {useWelcomeModal} from '#/components/hooks/useWelcomeModal'
import {Lightbox} from '#/components/Lightbox'
import {GlobalReportDialog} from '#/components/moderation/ReportDialog'
import {
  Outlet as PolicyUpdateOverlayPortalOutlet,
  usePolicyUpdateContext,
} from '#/components/PolicyUpdateOverlay'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {WelcomeModal} from '#/components/WelcomeModal'
import {RedirectOverlay} from '#/ageAssurance/components/RedirectOverlay'
import {PassiveAnalytics} from '#/analytics/PassiveAnalytics'
import {SixSevenOutlet} from '#/features/sixSeven'
import {FlatNavigator, RoutesContainer} from '#/Navigation'
import {Composer} from './Composer'
import {DrawerContent} from './Drawer'

const HEX_COLOR = /^#([0-9a-f]{6})$/i

function relativeLuminance(color: string) {
  const match = HEX_COLOR.exec(color)
  if (!match) return
  const channels = [0, 2, 4].map(offset => {
    const channel =
      Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  if (firstLuminance === undefined || secondLuminance === undefined) return
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function selectionTextColor(
  background: string,
  canvas: string,
  text: string,
  scheme: 'light' | 'dark',
) {
  const canvasContrast = contrastRatio(background, canvas)
  const textContrast = contrastRatio(background, text)
  if (canvasContrast !== undefined && textContrast !== undefined) {
    return canvasContrast > textContrast ? canvas : text
  }
  return scheme === 'dark' ? canvas : text
}

function createFaviconDataUrl(color: string, outline: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEW_BOX}"><path fill="${color}" stroke="${outline}" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke fill" d="${LOGO_PATH}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function upsertHeadLink({
  rel,
  href,
  type,
  sizes,
}: {
  rel: string
  href: string
  type?: string
  sizes?: string
}) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)

  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }

  if (type) link.type = type
  if (sizes) link.sizes = sizes
  link.href = href
}

function ShellInner() {
  const t = useTheme()
  const navigator = useNavigation<NavigationProp>()
  const pasteToLinkEnabled = usePasteToLinkEnabled()
  const closeAllActiveElements = useCloseAllActiveElements()
  const {state: policyUpdateState} = usePolicyUpdateContext()
  const welcomeModalControl = useWelcomeModal()

  useIntentHandler()

  useEffect(() => {
    if (!pasteToLinkEnabled) return

    const onPaste = (event: ClipboardEvent) => {
      handlePastedLink(event, link => {
        navigator.dispatch(StackActions.push(link.screen, link.params))
      })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [navigator, pasteToLinkEnabled])

  useLayoutEffect(() => {
    const rootElement = document.documentElement
    rootElement.classList.add('html')
    rootElement.style.colorScheme = t.scheme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', t.palette.contrast_0)
    rootElement.style.setProperty(
      'background',
      `${t.atoms.bg.backgroundColor}`,
      'important',
    )
    rootElement.style.setProperty('--text', t.palette.contrast_1000)
    rootElement.style.setProperty('--background', t.palette.contrast_0)
    rootElement.style.setProperty('--backgroundLight', t.palette.contrast_25)
    const selectionBackground = t.palette.primary_300
    rootElement.style.setProperty('--selectionBackground', selectionBackground)
    rootElement.style.setProperty(
      '--selectionText',
      selectionTextColor(
        selectionBackground,
        t.palette.contrast_0,
        t.palette.contrast_1000,
        t.scheme,
      ),
    )
  }, [t])

  useLayoutEffect(() => {
    const color = t.palette.primary_500

    const styleId = 'prosemirror-mention-color'
    let style = document.getElementById(styleId) as HTMLStyleElement | null

    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }

    style.innerHTML = `
      .ProseMirror .mention {
        color: ${color} !important;
      }
      .ProseMirror a,
      .ProseMirror .autolink {
        color: ${color} !important;
      }
    `
  }, [t.palette.primary_500])

  useLayoutEffect(() => {
    const faviconHref = createFaviconDataUrl(
      t.palette.primary_500,
      t.palette.contrast_1000,
    )

    upsertHeadLink({
      rel: 'icon',
      href: faviconHref,
      type: 'image/svg+xml',
      sizes: 'any',
    })
    upsertHeadLink({
      rel: 'shortcut icon',
      href: faviconHref,
      type: 'image/svg+xml',
    })
  }, [t.palette.contrast_1000, t.palette.primary_500])

  useEffect(() => {
    const unsubscribe = navigator.addListener('state', () => {
      closeAllActiveElements()
    })
    return unsubscribe
  }, [navigator, closeAllActiveElements])

  const drawerLayout = useCallback(
    ({children}: {children: React.ReactNode}) => (
      <DrawerLayout>{children}</DrawerLayout>
    ),
    [],
  )
  return (
    <>
      <ErrorBoundary>
        <FlatNavigator layout={drawerLayout} />
      </ErrorBoundary>
      <Composer />
      <MutedWordsDialog />
      <SigninDialog />
      <EmailDialog />
      <AgeAssuranceRedirectDialog />
      <LinkWarningDialog />
      <Lightbox />
      <NuxDialogs />
      <GlobalReportDialog />

      {welcomeModalControl.isOpen && (
        <WelcomeModal control={welcomeModalControl} />
      )}

      {/* Until policy update has been completed by the user, don't render anything that is portaled */}
      {policyUpdateState.completed && (
        <>
          <PortalOutlet />
          <SixSevenOutlet />
        </>
      )}

      <PolicyUpdateOverlayPortalOutlet />

      {/* workaround for a WebKit compositing bug. After a
          dialog (which uses Portal + fixed elements + CSS animations)
          closes, WebKit can skip painting subsequent view transitions.
          A persistent zero-size fixed element keeps the compositing
          tree from entering this broken state. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  )
}

function DrawerLayout({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const isDrawerOpen = useIsDrawerOpen()
  const setDrawerOpen = useSetDrawerOpen()
  const {gtTablet} = useBreakpoints()
  const {_} = useLingui()
  const showDrawer = !gtTablet && isDrawerOpen
  const [showDrawerDelayedExit, setShowDrawerDelayedExit] = useState(showDrawer)

  useLayoutEffect(() => {
    if (showDrawer !== showDrawerDelayedExit) {
      if (showDrawer) {
        setShowDrawerDelayedExit(true)
      } else {
        const timeout = setTimeout(() => {
          setShowDrawerDelayedExit(false)
        }, 160)
        return () => clearTimeout(timeout)
      }
    }
  }, [showDrawer, showDrawerDelayedExit])

  return (
    <>
      {children}
      {showDrawerDelayedExit && (
        <>
          <RemoveScrollBar />
          <TouchableWithoutFeedback
            onPress={ev => {
              // Only close if press happens outside of the drawer
              if (ev.target === ev.currentTarget) {
                setDrawerOpen(false)
              }
            }}
            accessibilityLabel={_(msg`Close drawer menu`)}
            accessibilityHint="">
            <View
              style={[
                styles.drawerMask,
                {
                  backgroundColor: showDrawer
                    ? select(t.name, {
                        light: 'rgba(0, 57, 117, 0.1)',
                        dark: 'rgba(1, 82, 168, 0.1)',
                        dim: 'rgba(10, 13, 16, 0.8)',
                      })
                    : 'transparent',
                },
                a.transition_color,
              ]}>
              <View
                style={[
                  styles.drawerContainer,
                  showDrawer ? a.slide_in_left : a.slide_out_left,
                ]}>
                <DrawerContent />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </>
      )}
    </>
  )
}

export function Shell() {
  const t = useTheme()
  const {currentAccount} = useSession()
  return (
    <View style={[a.util_screen_outer, t.atoms.bg]}>
      {currentAccount?.status === 'takendown' ? (
        <Takendown />
      ) : currentAccount?.status === 'deactivated' ? (
        <Deactivated />
      ) : (
        <>
          <RoutesContainer>
            <ShellInner />
          </RoutesContainer>

          <RedirectOverlay />
        </>
      )}

      <PassiveAnalytics />
    </View>
  )
}

const styles = StyleSheet.create({
  drawerMask: {
    ...a.fixed,
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },
  drawerContainer: {
    display: 'flex',
    ...a.fixed,
    top: 0,
    left: 0,
    height: '100%',
    width: 330,
    maxWidth: '80%',
  },
})
