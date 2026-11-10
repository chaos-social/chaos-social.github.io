import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {isCakeDay} from '#/lib/cake-day'
import {HITSLOP_20} from '#/lib/constants'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {type Shadow} from '#/state/cache/types'
import {usePdsProfilePriority} from '#/state/pds-viewability'
import {useDeerVerification} from '#/state/preferences/deer-verification'
import {
  usePdsLabelEnabled,
  usePdsLabelHideBskyPds,
} from '#/state/preferences/pds-label'
import {useDeerVerificationProfileOverlay} from '#/state/queries/deer-verification'
import {usePdsFaviconUrl, usePdsLabelQuery} from '#/state/queries/pds-label'
import {useTickEveryMinute} from '#/state/shell'
import {atoms as a, useAlf, useTheme, type ViewStyleProp} from '#/alf'
import {useNativeFontScale} from '#/alf/util/dimensions'
import {BotBadge, BotBadgeButton, isBotAccount} from '#/components/BotBadge'
import {Button} from '#/components/Button'
import {CakeDayBadge} from '#/components/CakeDayBadge'
import * as Dialog from '#/components/Dialog'
import {PdsBadgeIcon, PdsDialog} from '#/components/PdsDialog'
import {isPetAccount, PetBadge, PetBadgeButton} from '#/components/PetBadge'
import {isPvpAccount, PvpBadge} from '#/components/PvpBadge'
import {useSimpleVerificationState} from '#/components/verification'
import {verificationBadges} from '#/components/verification/badges'
import {VerificationCheck} from '#/components/verification/VerificationCheck'
import {VerificationCheckButton} from '#/components/verification/VerificationCheckButton'
import {verifierColor} from '#/components/verification/verifier-color'
import {IS_WEB} from '#/env'
import type * as bsky from '#/types/bsky'
import {BetaBadge, BetaBadgeButton, useIsBetaBadgeVisible} from './BetaBadge'

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const verificationIconSizes: Record<Size, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
} as const

const botIconSizes: Record<Size, number> = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 19,
  xl: 23,
} as const

const betaIconSizes: Record<Size, number> = {
  xs: 8,
  sm: 8,
  md: 8,
  lg: 10,
  xl: 12,
} as const

const betaBadgePadding: Record<Size, number> = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 5,
} as const

type ProfileBadgesProps = ViewStyleProp & {
  profile: bsky.profile.AnyProfileView
  interactive?: boolean
  pdsInteractive?: boolean
  /** The beta badge is reserved for the full profile header. */
  showBetaBadge?: boolean
  size: Size
  allowFontScaling?: boolean
}

export function ProfileBadges(props: ProfileBadgesProps) {
  const profile = useProfileShadow(props.profile)
  return <ProfileBadgesFromProfileShadow {...props} profile={profile} />
}

/**
 * Use when the parent already owns a profile-shadow subscription. Feed rows
 * use this path to avoid subscribing twice for the same author.
 */
export function ProfileBadgesFromProfileShadow({
  profile,
  interactive = false,
  pdsInteractive = true,
  showBetaBadge = false,
  size,
  style,
  allowFontScaling = true,
}: Omit<ProfileBadgesProps, 'profile'> & {
  profile: Shadow<bsky.profile.AnyProfileView>
}) {
  const t = useTheme()
  const shadowed = useDeerVerificationProfileOverlay(profile)
  const {perVerifierBadges} = useDeerVerification()
  const verification = useSimpleVerificationState({profile: shadowed})
  const pdsLabelEnabled = usePdsLabelEnabled()
  const hideBskyPds = usePdsLabelHideBskyPds()
  const isBskyHandle =
    !!shadowed.handle && shadowed.handle.endsWith('.bsky.social')
  const shouldShowPdsCandidate =
    pdsLabelEnabled && !(hideBskyPds && isBskyHandle)
  const pdsProfilePriority = usePdsProfilePriority(shadowed.did)
  const {data: pdsData, isLoading: isPdsLoading} = usePdsLabelQuery(
    shouldShowPdsCandidate ? shadowed.did : undefined,
    pdsProfilePriority,
  )
  const pdsFaviconUrl = usePdsFaviconUrl(
    pdsData && !pdsData.isBsky && !pdsData.isBridged
      ? pdsData.pdsUrl
      : undefined,
  )
  const nativeScaleMultiplier = useNativeFontScale()
  const {
    fonts: {scaleMultiplier: alfScaleMultiplier},
  } = useAlf()

  const showPdsBadge =
    shouldShowPdsCandidate && (!pdsData || !(hideBskyPds && pdsData.isBsky))

  const isBetaBadgeVisible = useIsBetaBadgeVisible(shadowed) && showBetaBadge
  /*
   * Only subscribe to the minute tick on the anniversary day, so the cake
   * appears and disappears at UTC midnight without every profile polling.
   * The tick is 0 when not subscribed, which also means no cake.
   */
  const cakeDayTick = useTickEveryMinute(isCakeDay(shadowed.createdAt))
  const showCake = cakeDayTick > 0 && isCakeDay(shadowed.createdAt, cakeDayTick)
  const badgeVisibility = [
    verification.showBadge,
    isBetaBadgeVisible,
    isBotAccount(shadowed),
    isPetAccount(shadowed),
    isPvpAccount(shadowed),
    showCake,
  ]
  const badgeCount = badgeVisibility.filter(Boolean).length

  // if nothing to show, don't render the container at all
  if (!showPdsBadge && badgeCount < 1) return null

  const isOnTheSmallSide = size === 'xs' || size === 'sm'

  const scaleMultiplier = allowFontScaling
    ? nativeScaleMultiplier * alfScaleMultiplier
    : 1

  const verificationIconWidth = verificationIconSizes[size] * scaleMultiplier
  const botIconWidth = botIconSizes[size] * scaleMultiplier
  const betaIconWidth = betaIconSizes[size] * scaleMultiplier
  const betaBadgeScaledPadding = betaBadgePadding[size] * scaleMultiplier

  const gap = isOnTheSmallSide ? a.gap_2xs : a.gap_xs
  const padding = gap.gap / 2
  const hitSlops = []
  let visibleBadgeIndex = 0
  for (const isVisible of badgeVisibility) {
    if (!isVisible) {
      hitSlops.push(HITSLOP_20)
      continue
    }
    const index = visibleBadgeIndex++
    hitSlops.push({
      ...HITSLOP_20,
      left: index === 0 ? HITSLOP_20.left : padding,
      right: index === badgeCount - 1 ? HITSLOP_20.right : padding,
    })
  }

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        isOnTheSmallSide ? a.gap_2xs : a.gap_xs,
        style,
      ]}>
      {showPdsBadge && (
        <PdsInlineIcon
          size={size}
          interactive={pdsInteractive}
          isLoading={!pdsData || isPdsLoading}
          isBsky={pdsData?.isBsky ?? isBskyHandle}
          isBridged={pdsData?.isBridged ?? false}
          pdsUrl={pdsData?.pdsUrl}
          faviconUrl={pdsFaviconUrl}
        />
      )}
      {interactive ? (
        <>
          <VerificationCheckButton
            profile={shadowed}
            width={verificationIconWidth}
            hitSlop={hitSlops[0]}
          />
          {showBetaBadge ? (
            <BetaBadgeButton
              profile={shadowed}
              width={betaIconWidth}
              padding={betaBadgeScaledPadding}
              hitSlop={hitSlops[1]}
            />
          ) : null}
          <BotBadgeButton
            profile={shadowed}
            width={botIconWidth}
            hitSlop={hitSlops[2]}
          />
          <PetBadgeButton profile={shadowed} width={botIconWidth} />
          <PvpBadge
            profile={shadowed}
            size={size}
            allowFontScaling={allowFontScaling}
          />
          {showCake && (
            <CakeDayBadge
              width={botIconWidth}
              interactive
              hitSlop={hitSlops[5]}
            />
          )}
        </>
      ) : (
        <>
          {verification.showBadge &&
            verificationBadges(shadowed, !!perVerifierBadges).map(badge => (
              <VerificationCheck
                key={
                  badge.kind === 'verifier'
                    ? 'verifier'
                    : (badge.issuer ?? 'verification')
                }
                verifier={badge.kind === 'verifier'}
                fill={
                  !perVerifierBadges
                    ? t.palette.primary_500
                    : badge.kind === 'verifier'
                      ? verifierColor(badge.did, t)
                      : badge.kind === 'verification' && badge.issuer
                        ? verifierColor(badge.issuer, t)
                        : verifierColor(shadowed.did, t)
                }
                width={verificationIconWidth}
              />
            ))}
          {showBetaBadge ? (
            <BetaBadge
              profile={shadowed}
              width={betaIconWidth}
              padding={betaBadgeScaledPadding}
            />
          ) : null}
          <BotBadge profile={shadowed} width={botIconWidth} />
          <PetBadge profile={shadowed} width={botIconWidth} />
          <PvpBadge
            profile={shadowed}
            size={size}
            allowFontScaling={allowFontScaling}
          />
          {showCake && <CakeDayBadge width={botIconWidth} />}
        </>
      )}
    </View>
  )
}

function pdsIconDimensions(size: Size) {
  switch (size) {
    case 'md':
      return 14
    case 'lg':
      return 20
    case 'xl':
      return 24
    default:
      return 12
  }
}

function PdsInlineIcon({
  size,
  interactive,
  isLoading,
  isBsky,
  isBridged,
  pdsUrl,
  faviconUrl,
}: {
  size: Size
  interactive: boolean
  isLoading: boolean
  isBsky: boolean
  isBridged: boolean
  pdsUrl?: string
  faviconUrl?: string
}) {
  const {t: l} = useLingui()
  const dialogControl = Dialog.useDialogControl()
  const [loadDescription, setLoadDescription] = useState(false)
  const dimensions = pdsIconDimensions(size)

  const icon = (
    <PdsBadgeIcon
      faviconUrl={faviconUrl}
      pdsUrl={pdsUrl}
      isBsky={isBsky}
      isBridged={isBridged}
      size={dimensions}
      borderRadius={Math.round(dimensions * 0.25)}
    />
  )

  if (isLoading || !pdsUrl || !interactive) {
    return (
      <View
        style={[
          a.justify_center,
          a.align_center,
          {width: dimensions, height: dimensions},
        ]}>
        {icon}
      </View>
    )
  }

  return (
    <>
      <Button
        label={l`View PDS information`}
        hitSlop={20}
        onPress={evt => {
          evt.preventDefault()
          setLoadDescription(true)
          dialogControl.open()
          if (IS_WEB) {
            ;(document.activeElement as HTMLElement | null)?.blur()
          }
        }}>
        {({hovered}) => (
          <View style={{width: dimensions, height: dimensions}}>
            <View
              style={[
                a.justify_center,
                a.align_center,
                a.transition_transform,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  transform: [{scale: hovered ? 1.1 : 1}],
                },
              ]}>
              {icon}
            </View>
          </View>
        )}
      </Button>

      <PdsDialog
        control={dialogControl}
        pdsUrl={pdsUrl}
        faviconUrl={faviconUrl}
        loadDescription={loadDescription}
      />
    </>
  )
}
