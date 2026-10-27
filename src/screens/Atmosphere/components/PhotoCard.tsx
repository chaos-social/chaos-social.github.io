import {View} from 'react-native'
import {Image} from 'expo-image'
import {moderateProfile} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'

import {getShapeRadius, getShapeStyle} from '#/lib/shapes'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  maybeModifyImageCdnHost,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {formatCount} from '#/view/com/util/numeric/format'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {type AtmospherePhotoCardData} from '#/screens/Atmosphere/data/exploreData'
import {atoms as a, useTheme, web} from '#/alf'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type ExploreGalleryFocusProps} from './ExploreGallery'

export function PhotoCard({
  photo,
  galleryFocus,
}: {
  photo: AtmospherePhotoCardData
  galleryFocus?: ExploreGalleryFocusProps
}) {
  const {t: l, i18n} = useLingui()
  const t = useTheme()
  const shape = useEnableSquareButtons()
  const imageCdnHost = useImageCdnHost()
  const {
    state: interacted,
    onIn: onInteract,
    onOut: onInteractOut,
  } = useInteractionState()
  const moderationOpts = useModerationOpts()
  const moderation = moderationOpts
    ? moderateProfile(photo.authorProfile, moderationOpts)
    : undefined
  const authorName = sanitizeDisplayName(
    photo.authorProfile.displayName ||
      sanitizeHandle(photo.authorProfile.handle),
    moderation?.ui('displayName'),
  )

  return (
    <Link
      to={photo.href}
      dataSet={{keyboardNavigationItem: 'true'}}
      label={l`Open ${photo.title}`}
      accessibilityHint=""
      ref={galleryFocus?.focusRef}
      tabIndex={galleryFocus?.tabIndex}
      {...web({
        onMouseEnter: onInteract,
        onMouseLeave: onInteractOut,
      })}
      onFocus={() => {
        onInteract()
        galleryFocus?.onFocus()
      }}
      onBlur={onInteractOut}
      style={[a.flex_grow, a.w_full, a.flex_col, a.align_start, a.gap_sm]}>
      <View
        style={[
          a.w_full,
          a.aspect_square,
          a.overflow_hidden,
          getShapeStyle(shape, a.rounded_md, a.rounded_md),
          t.atoms.bg_contrast_25,
        ]}>
        <Image
          source={maybeModifyImageCdnHost(photo.image, imageCdnHost)}
          contentFit="cover"
          accessibilityLabel={photo.imageAlt}
          accessibilityHint=""
          style={[a.w_full, a.h_full]}
          accessible={!!photo.imageAlt}
        />
        {interacted ? (
          <View
            testID="atmospherePhotoHoverOverlay"
            accessible={false}
            pointerEvents="none"
            style={[
              a.absolute,
              a.inset_0,
              {backgroundColor: 'rgba(0, 0, 0, 0.1)'},
            ]}
          />
        ) : undefined}
        {photo.likeCount > 0 ? (
          <View
            accessible={false}
            pointerEvents="none"
            style={[
              a.absolute,
              a.flex_row,
              a.align_center,
              a.gap_2xs,
              a.px_xs,
              a.py_2xs,
              {
                top: 7,
                left: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                borderRadius: getShapeRadius(shape, 5, 5),
              },
            ]}>
            <Heart size="xs" style={{color: 'white'}} />
            <Text style={[a.text_xs, a.font_medium, {color: 'white'}]}>
              {formatCount(i18n, photo.likeCount)}
            </Text>
          </View>
        ) : undefined}
      </View>
      <Text
        emoji
        style={[a.w_full, a.text_sm, a.font_semi_bold]}
        numberOfLines={2}>
        {photo.title}
      </Text>
      <View style={[a.flex_row, a.align_center, a.gap_xs]}>
        <UserAvatar
          type="user"
          size={16}
          avatar={photo.authorProfile.avatar}
          moderation={moderation?.ui('avatar')}
        />
        <Text emoji style={[a.text_xs, a.font_medium]} numberOfLines={1}>
          {authorName}
        </Text>
      </View>
    </Link>
  )
}
