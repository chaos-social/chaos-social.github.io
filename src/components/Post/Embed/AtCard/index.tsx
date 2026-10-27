import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {getShapeStyle} from '#/lib/shapes'
import {shareUrl} from '#/lib/sharing'
import {getAuthorPrimaryName} from '#/lib/strings/display-names'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useHideDisplayNames} from '#/state/preferences/hide-display-names'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {useProfileQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {contrastForeground} from '#/features/themes/accentForeground'
import {type app} from '#/lexicons'
import {getAtCardProvider} from './providers'

const ATTIE_ACCOUNT_DID = 'did:plc:v7lt2fu7igydcjszoexxrvl2'

/** A whole-card link for AT-aware services, starting with Attie. */
export function AtCard({
  view,
  authorDid,
  preview,
  onEmbedInteractionCallback,
  style,
}: {
  view: app.bsky.embed.external.ViewExternal
  authorDid?: string
  preview?: boolean
  onEmbedInteractionCallback?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const shape = useEnableSquareButtons()
  const hideDisplayNames = useHideDisplayNames()
  const imageCdnHost = useImageCdnHost()
  const thumbnailFormat = useThumbnailFormat()
  const {t: l} = useLingui()
  const {gtPhone} = useBreakpoints()
  const haptics = useHaptics()
  const {data: authorProfile, isError: authorLookupFailed} = useProfileQuery({
    did: authorDid,
  })
  const showAttieAccount = !authorDid || (authorLookupFailed && !authorProfile)
  const {data: attieProfile} = useProfileQuery({
    did: showAttieAccount ? ATTIE_ACCOUNT_DID : undefined,
  })
  const displayedProfile = showAttieAccount ? attieProfile : authorProfile
  const displayedName = displayedProfile
    ? getAuthorPrimaryName(displayedProfile, {hideDisplayNames})
    : showAttieAccount
      ? hideDisplayNames
        ? 'attie.ai'
        : 'Attie'
      : authorDid
  const displayedHandle = showAttieAccount
    ? displayedProfile?.handle || 'attie.ai'
    : displayedProfile?.handle
  const provider = getAtCardProvider(view.uri)
  if (!provider) return null

  return (
    <Link
      testID="atCard"
      shouldProxy
      to={view.uri}
      label={
        view.title
          ? l`Visit ${view.title} on ${provider.name}`
          : l`Visit site on ${provider.name}`
      }
      onPress={() => {
        haptics.tap()
        onEmbedInteractionCallback?.()
      }}
      onLongPress={
        IS_NATIVE
          ? () => {
              haptics.longPress()
              void shareUrl(view.uri)
              return false
            }
          : undefined
      }
      style={[
        a.w_full,
        getShapeStyle(shape, a.rounded_lg, a.rounded_lg),
        a.border,
        t.atoms.border_contrast_low,
        preview && a.pointer_events_none,
        style,
      ]}>
      {({hovered, focused, pressed}) => (
        <View
          style={[
            a.w_full,
            getShapeStyle(shape, a.rounded_lg, a.rounded_lg),
            a.overflow_hidden,
            hovered || focused || pressed ? t.atoms.bg_contrast_25 : t.atoms.bg,
          ]}>
          {view.thumb && (
            <Image
              style={a.aspect_card}
              source={{
                uri: applyImageTransforms(view.thumb, {
                  imageCdnHost,
                  format: thumbnailFormat,
                }),
              }}
              accessibilityIgnoresInvertColors
              loading="lazy"
              useAppleWebpCodec
            />
          )}
          <View style={[a.p_md, a.gap_xs]}>
            <Text
              emoji
              numberOfLines={3}
              style={[a.text_lg, a.font_bold, a.leading_snug]}>
              {view.title}
            </Text>
            {view.description && (
              <Text
                emoji
                numberOfLines={view.thumb ? 3 : 4}
                style={[a.text_sm, a.leading_snug]}>
                {view.description}
              </Text>
            )}
          </View>
          <Divider />
          <View
            style={[
              a.align_center,
              a.justify_between,
              a.p_md,
              a.gap_md,
              gtPhone && [a.flex_row, a.gap_sm],
            ]}>
            <View
              style={[
                a.w_full,
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.pointer_events_none,
                gtPhone && a.flex_1,
              ]}>
              <UserAvatar
                avatar={displayedProfile?.avatar}
                size={32}
                type="user"
              />
              <View style={[a.flex_1, a.gap_2xs]}>
                <Text
                  emoji
                  numberOfLines={1}
                  style={[
                    a.text_sm,
                    a.font_medium,
                    a.leading_tight,
                    t.atoms.text,
                  ]}>
                  {displayedName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    a.text_xs,
                    a.leading_tight,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {displayedHandle ? l`@${displayedHandle}` : authorDid}
                </Text>
              </View>
            </View>

            {/* The CTA is visual; the enclosing link is the single interactive target. */}
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.justify_center,
                a.gap_sm,
                getShapeStyle(shape, a.rounded_sm, a.rounded_full),
                a.px_md,
                a.py_sm,
                {
                  backgroundColor:
                    hovered || focused || pressed
                      ? provider.hoverColor
                      : provider.backgroundColor,
                },
                !gtPhone && a.w_full,
              ]}>
              <provider.CtaIcon
                size="md"
                fill={contrastForeground(provider.backgroundColor)}
              />
              <Text
                style={[
                  a.font_bold,
                  {color: contrastForeground(provider.backgroundColor)},
                ]}>{l`Visit site`}</Text>
            </View>
          </View>
        </View>
      )}
    </Link>
  )
}
