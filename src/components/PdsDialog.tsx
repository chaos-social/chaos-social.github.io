import {useState} from 'react'
import {Image, View} from 'react-native'
import Svg, {G, Path, Rect} from 'react-native-svg'
import {
  FontAwesomeIcon,
  type FontAwesomeIconStyle,
} from '@fortawesome/react-native-fontawesome'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {
  getPdsFallbackFaviconUrl,
  isBridgedPdsUrl,
  isBskyPdsUrl,
} from '#/state/queries/pds-label.util'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'

const failedFaviconUrls = new Set<string>()

function formatBskyPdsDisplayName(hostname: string): string {
  const match = hostname.match(/^([^.]+)\.([^.]+)\.host\.bsky\.network$/)
  if (match) {
    const name = match[1].charAt(0).toUpperCase() + match[1].slice(1)
    const rawRegion = match[2]
    const region = rawRegion
      .replace(/^us-east$/, 'US East')
      .replace(/^us-west$/, 'US West')
      .replace(/^eu-west$/, 'EU West')
      .replace(
        /^ap-(.+)$/,
        (_match: string, r: string) =>
          `AP ${r.charAt(0).toUpperCase()}${r.slice(1)}`,
      )
    return `${name} (${region})`
  }
  if (hostname === 'bsky.social') return 'Bluesky Social'
  return hostname
}

export function PdsDialog({
  control,
  pdsUrl,
  faviconUrl,
}: {
  control: Dialog.DialogControlProps
  pdsUrl: string
  faviconUrl: string | undefined
}) {
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()

  let hostname = pdsUrl
  try {
    hostname = new URL(pdsUrl).hostname
  } catch {}

  const isBsky = isBskyPdsUrl(pdsUrl)
  const isBridged = isBridgedPdsUrl(pdsUrl)
  const displayName = isBsky ? formatBskyPdsDisplayName(hostname) : hostname

  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={_(msg`PDS Information`)}
        style={[
          gtMobile ? {width: 'auto', maxWidth: 400, minWidth: 200} : a.w_full,
        ]}>
        <View style={[a.gap_md, a.pb_lg]}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <PdsBadgeIcon
              faviconUrl={faviconUrl}
              pdsUrl={pdsUrl}
              isBsky={isBsky}
              isBridged={isBridged}
              size={36}
            />
            <View style={[a.flex_1]}>
              {
                <Text
                  style={[a.text_2xl, a.font_semi_bold, a.leading_tight]}
                  numberOfLines={1}>
                  {isBridged ? <Trans>Fediverse</Trans> : displayName}
                </Text>
              }
              {isBsky && (
                <Text style={[a.text_sm, a.leading_tight]}>
                  <Trans>Bluesky Social</Trans>
                </Text>
              )}
            </View>
          </View>

          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>
              This badge represents the Personal Data Server this account is
              stored on:{' '}
              <InlineLinkText
                to={pdsUrl}
                label={displayName}
                style={[a.text_md, a.font_semi_bold]}>
                {displayName}
              </InlineLinkText>
              . A PDS is where posts, follows, and other data live on the AT
              Protocol network.
            </Trans>
          </Text>

          {isBridged && (
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                This account is bridged from the Fediverse via{' '}
                <InlineLinkText
                  to="https://witchsky.app/profile/ap.brid.gy"
                  label="Bridgy Fed"
                  style={[a.text_md, a.font_semi_bold]}>
                  Bridgy Fed
                </InlineLinkText>
                .{' '}
                {/* Their original account is avaiable at:{' '}
                <InlineLinkText
                  to={BridgedUrl}
                  label="Federated account address"
                  style={[a.text_md, a.font_semi_bold]}>
                  {BridgedUrl}
                </InlineLinkText> */}
              </Trans>
            </Text>
          )}

          {!isBridged && (
            <Text style={[a.text_md, a.leading_snug]}>
              <Trans>
                <InlineLinkText
                  to="https://atproto.com/guides/glossary#pds-personal-data-server"
                  label="PDS Glossary definition"
                  style={[a.text_md, a.font_semi_bold]}>
                  Learn more
                </InlineLinkText>{' '}
                about what a PDS is and how to{' '}
                <InlineLinkText
                  to="https://atproto.com/guides/self-hosting#pds"
                  label="Self-hosting PDS documentation"
                  style={[a.text_md, a.font_semi_bold]}>
                  self-host
                </InlineLinkText>{' '}
                your own.
              </Trans>
            </Text>
          )}
        </View>

        <View
          style={[
            a.w_full,
            a.gap_sm,
            gtMobile
              ? [a.flex_row, a.flex_row_reverse, a.justify_start]
              : [a.flex_col],
          ]}>
          <Button
            label={_(msg`Close dialog`)}
            size="small"
            variant="solid"
            color="primary"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Close</Trans>
            </ButtonText>
          </Button>
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function BskyBadgeSVG({size}: {size: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect width={24} height={24} rx={6} fill="#0085ff" />
      <G transform="translate(2.4 2.4) scale(0.8)">
        <Path
          fill="#fff"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.335 4.212c2.293 1.76 4.76 5.327 5.665 7.241.906-1.914 3.372-5.482 5.665-7.241C19.319 2.942 22 1.96 22 5.086c0 .624-.35 5.244-.556 5.994-.713 2.608-3.315 3.273-5.629 2.87 4.045.704 5.074 3.035 2.852 5.366-4.22 4.426-6.066-1.111-6.54-2.53-.086-.26-.126-.382-.127-.278 0-.104-.041.018-.128.278-.473 1.419-2.318 6.956-6.539 2.53-2.222-2.331-1.193-4.662 2.852-5.366-2.314.403-4.916-.262-5.63-2.87C2.35 10.33 2 5.71 2 5.086c0-3.126 2.68-2.144 4.335-.874Z"
        />
      </G>
    </Svg>
  )
}

function FediverseBadgeSVG({size}: {size: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect width={24} height={24} rx={6} fill="#6364FF" />
      <G transform="translate(2.4 2.4) scale(0.03)">
        <Path
          fill="#fff"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M426.8 590.9C407.1 590.4 389.3 579.3 380.2 561.8C371.2 544.4 372.3 523.4 383.2 507C394.1 490.6 413 481.5 432.6 483.1C452.3 483.6 470.1 494.7 479.2 512.2C488.2 529.6 487.1 550.6 476.2 567C465.3 583.4 446.4 592.5 426.8 590.9zM376.7 510.3C371.2 521.2 369.3 533.6 371.1 545.7L200.7 518.4C206.2 507.5 208.2 495.1 206.4 483L376.7 510.3zM144.7 545.6C125.1 545.1 107.3 533.9 98.3 516.5C89.2 499 90.4 478.1 101.3 461.7C112.1 445.4 131 436.2 150.6 437.8C170.2 438.3 188 449.5 197 466.9C206.1 484.4 204.9 505.3 194 521.7C183.2 538 164.3 547.2 144.7 545.6zM402.4 484.2C391.5 489.8 382.7 498.6 377 509.5L306.4 438.6L340 421.6L402.4 484.3zM518.1 325C526.8 333.6 537.9 339.3 550 341.4L471.4 494.8C462.7 486.2 451.6 480.5 439.5 478.4L518.1 325zM408.7 283.3L439.2 478.4C427.1 476.5 414.7 478.3 403.8 483.7L371.6 277.4L408.8 283.4zM382.4 392.9L206.2 482.2C204.2 470.1 198.6 459 190 450.2L376.6 355.6L382.4 392.8zM229.7 370.9L189.4 449.6C180.7 441 169.6 435.3 157.5 433.3L203.1 344.3L229.7 371zM156.7 433C144.6 431.2 132.3 433.2 121.3 438.6L94.7 268.3C106.8 270.1 119.2 268.2 130.1 262.7L156.7 433zM303.8 385.2L270.2 402.2L130.8 262.3C141.7 256.7 150.5 247.9 156.2 237L303.8 385.2zM501.3 292.4C503.3 304.5 508.9 315.6 517.5 324.3L428.2 369.5L422.4 332.3L501.3 292.3zM556.9 336.7C537.3 336.2 519.5 325 510.5 307.6C501.4 290.1 502.6 269.2 513.5 252.8C524.3 236.5 543.2 227.3 562.8 228.9C582.4 229.4 600.2 240.6 609.2 258C618.3 275.5 617.1 296.4 606.2 312.8C595.4 329.1 576.5 338.3 556.9 336.7zM316.6 122.7C325.3 131.3 336.4 137 348.4 139L253.1 325.1L226.5 298.4L316.5 122.6zM506.9 256.1C501.4 267 499.4 279.4 501.2 291.4L294.8 258.3L312 224.8L507 256.1zM100.7 263.6C81.1 263.1 63.3 251.9 54.3 234.5C45.2 217 46.4 196.1 57.3 179.7C68.1 163.4 87 154.2 106.6 155.8C126.2 156.3 144 167.5 153 184.9C162.1 202.4 160.9 223.3 150 239.7C139.2 256 120.3 265.2 100.7 263.6zM532.7 230.2C521.8 235.8 513 244.6 507.3 255.5L385.5 133.3C396.4 127.7 405.2 118.9 410.9 108L532.6 230.2zM261.3 216.6L244.1 250.1L156.7 236.1C162.1 225.2 164.1 212.8 162.2 200.7L261.2 216.6zM400.8 232.5L363.6 226.5L350 139.3C362.1 141 374.5 139 385.3 133.4L400.8 232.5zM299.8 90.2C301.8 102.3 307.4 113.4 316 122.1L162.1 200.1C160.1 188 154.5 176.9 145.9 168.2L299.8 90.2zM355.4 134.5C335.7 134 317.9 122.9 308.8 105.4C299.8 88 300.9 67 311.8 50.6C322.7 34.2 341.6 25.1 361.2 26.7C380.9 27.2 398.7 38.3 407.8 55.8C416.8 73.2 415.7 94.2 404.8 110.6C393.9 127 375 136.1 355.4 134.5z"
        />
      </G>
    </Svg>
  )
}

function DbBadgeIcon({
  size,
  borderRadius,
}: {
  size: number
  borderRadius: number
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: t.atoms.bg_contrast_100.backgroundColor,
        },
      ]}>
      <FontAwesomeIcon
        icon="database"
        size={Math.round(size * 0.7)}
        style={
          {color: t.atoms.text_contrast_medium.color} as FontAwesomeIconStyle
        }
      />
    </View>
  )
}

function FaviconBadgeIcon({
  size,
  borderRadius,
  faviconUrl,
  fallbackFaviconUrl,
}: {
  size: number
  borderRadius: number
  faviconUrl: string
  fallbackFaviconUrl?: string
}) {
  const getInitialUrl = () => {
    if (!failedFaviconUrls.has(faviconUrl)) return faviconUrl
    if (fallbackFaviconUrl && !failedFaviconUrls.has(fallbackFaviconUrl)) {
      return fallbackFaviconUrl
    }
    return undefined
  }
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(
    getInitialUrl,
  )
  const [imageLoaded, setImageLoaded] = useState(false)

  if (!currentUrl) {
    return <DbBadgeIcon size={size} borderRadius={borderRadius} />
  }

  return (
    <View
      style={[
        a.overflow_hidden,
        {
          width: size,
          height: size,
          borderRadius,
        },
      ]}>
      <DbBadgeIcon size={size} borderRadius={borderRadius} />
      <Image
        key={currentUrl}
        source={{uri: currentUrl}}
        style={{
          width: size,
          height: size,
          position: 'absolute',
          top: 0,
          left: 0,
          opacity: imageLoaded ? 1 : 0,
        }}
        accessibilityIgnoresInvertColors
        onLoad={() => {
          setImageLoaded(true)
        }}
        onError={() => {
          failedFaviconUrls.add(currentUrl)
          setImageLoaded(false)

          if (
            fallbackFaviconUrl &&
            currentUrl !== fallbackFaviconUrl &&
            !failedFaviconUrls.has(fallbackFaviconUrl)
          ) {
            setCurrentUrl(fallbackFaviconUrl)
            return
          }

          setCurrentUrl(undefined)
        }}
      />
    </View>
  )
}

export function PdsBadgeIcon({
  faviconUrl,
  pdsUrl,
  isBsky,
  isBridged,
  size,
  borderRadius,
}: {
  faviconUrl?: string
  pdsUrl?: string
  isBsky: boolean
  isBridged: boolean
  size: number
  borderRadius?: number
}) {
  const r = borderRadius ?? size / 5
  if (isBsky) return <BskyBadgeSVG size={size} />
  if (isBridged) return <FediverseBadgeSVG size={size} />
  const fallbackFaviconUrl = pdsUrl
    ? getPdsFallbackFaviconUrl(pdsUrl)
    : undefined
  if (faviconUrl)
    return (
      <FaviconBadgeIcon
        key={`${faviconUrl}|${fallbackFaviconUrl ?? ''}`}
        size={size}
        borderRadius={r}
        faviconUrl={faviconUrl}
        fallbackFaviconUrl={fallbackFaviconUrl}
      />
    )
  if (fallbackFaviconUrl)
    return (
      <FaviconBadgeIcon
        key={fallbackFaviconUrl}
        size={size}
        borderRadius={r}
        faviconUrl={fallbackFaviconUrl}
      />
    )
  return <DbBadgeIcon size={size} borderRadius={r} />
}
