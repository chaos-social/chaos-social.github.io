import {useMemo} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {parseAltFromGIFDescription} from '#/lib/gif-alt-text'
import {useHaptics} from '#/lib/haptics'
import {getRecordImageMimeType} from '#/lib/media/recordImageMimeType'
import {SHARP_CORNERS} from '#/lib/shapes'
import {shareUrl} from '#/lib/sharing'
import {
  exemptExternalEmbedSources,
  parseEmbedPlayerFromUrl,
} from '#/lib/strings/embed-player'
import {toNiceDomain} from '#/lib/strings/url-helpers'
import {useExternalEmbedsPrefs} from '#/state/preferences'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {
  applyImageTransforms,
  useImageCdnHost,
} from '#/state/preferences/image-cdn-host'
import {useThumbnailFormat} from '#/state/preferences/thumbnail-format'
import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {Earth_Stroke2_Corner0_Rounded as Globe} from '#/components/icons/Globe'
import {Link} from '#/components/Link'
import {PostEmbedViewContext} from '#/components/Post/Embed/types'
import {Text} from '#/components/Typography'
import {IS_NATIVE} from '#/env'
import {IS_ANDROID} from '#/env'
import {type app} from '#/lexicons'
import {ExternalGif} from './ExternalGif'
import {ExternalPlayer} from './ExternalPlayer'
import {GifEmbed} from './Gif'

export const ExternalEmbed = ({
  link,
  onOpen,
  post,
  style,
  hideAlt,
  preview,
  viewContext,
}: {
  link: app.bsky.embed.external.ViewExternal
  onOpen?: () => void
  post?: app.bsky.feed.defs.PostView
  style?: StyleProp<ViewStyle>
  hideAlt?: boolean
  preview?: boolean
  viewContext?: PostEmbedViewContext
}) => {
  const shapePreference = useEnableSquareButtons()

  const {_} = useLingui()
  const t = useTheme()
  const playHaptic = useHaptics()
  const externalEmbedPrefs = useExternalEmbedsPrefs()
  const thumbnailFormat = useThumbnailFormat()
  const imageCdnHost = useImageCdnHost()
  const niceUrl = toNiceDomain(link.uri)
  const imageUri = link.thumb
    ? preview
      ? link.thumb
      : applyImageTransforms(link.thumb, {
          imageCdnHost,
          format: thumbnailFormat,
          originalMimeType: getRecordImageMimeType(link.thumb, post?.record),
        })
    : undefined
  const embedPlayerParams = useMemo(() => {
    const params = parseEmbedPlayerFromUrl(link.uri)
    if (!params) return
    const canShow = externalEmbedPrefs?.[params.source] !== 'hide'
    if (canShow || exemptExternalEmbedSources.has(params.source)) {
      return params
    }
  }, [link.uri, externalEmbedPrefs])
  const hasMedia = Boolean(imageUri || embedPlayerParams)
  const isAndroidCarousel =
    IS_ANDROID && viewContext === PostEmbedViewContext.FeedCarousel

  const onPress = () => {
    playHaptic('Light')
    onOpen?.()
  }

  const onShareExternal = IS_NATIVE
    ? () => {
        if (link.uri) {
          playHaptic('Heavy')
          void shareUrl(link.uri)
        }
      }
    : undefined

  if (
    embedPlayerParams?.source === 'tenor' ||
    embedPlayerParams?.source === 'klipy'
  ) {
    const parsedAlt = parseAltFromGIFDescription(link.description)
    return (
      <View style={style}>
        <GifEmbed
          params={embedPlayerParams}
          thumb={link.thumb}
          altText={parsedAlt.alt}
          isPreferredAltText={parsedAlt.isPreferred}
          hideAlt={hideAlt}
        />
      </View>
    )
  }

  return (
    <Link
      testID="postEmbedOpenBtn"
      label={link.title || _(msg`Open link to ${niceUrl}`)}
      to={link.uri}
      shouldProxy={true}
      peek
      style={[a.rounded_md, shapePreference === 'sharp' && SHARP_CORNERS]}
      onPress={onPress}
      onLongPress={onShareExternal}>
      {({hovered, pressed}) => (
        <View
          style={[
            a.transition_color,
            a.flex_col,
            a.rounded_md,
            a.overflow_hidden,
            a.w_full,
            a.border,
            pressed && t.atoms.bg,
            style,
            hovered
              ? t.atoms.border_contrast_high
              : t.atoms.border_contrast_low,
            shapePreference === 'sharp' && SHARP_CORNERS,
          ]}>
          {imageUri && !embedPlayerParams ? (
            <Image
              style={[a.aspect_card]}
              source={{uri: imageUri}}
              accessibilityIgnoresInvertColors
              loading="lazy"
              useAppleWebpCodec
            />
          ) : undefined}

          {embedPlayerParams?.isGif ? (
            <ExternalGif link={link} params={embedPlayerParams} />
          ) : embedPlayerParams ? (
            <ExternalPlayer
              link={link}
              params={embedPlayerParams}
              preview={preview}
              post={post}
            />
          ) : undefined}

          <View
            style={[
              isAndroidCarousel ? {flex: 0} : a.flex_1,
              a.pt_sm,
              {gap: 3},
              hasMedia && a.border_t,
              hovered
                ? t.atoms.border_contrast_high
                : t.atoms.border_contrast_low,
            ]}>
            <View style={[{gap: 3}, a.pb_xs, a.px_md]}>
              {!embedPlayerParams?.isGif && !embedPlayerParams?.dimensions && (
                <Text
                  emoji
                  numberOfLines={3}
                  style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                  {link.title || link.uri}
                </Text>
              )}
              {link.description ? (
                <Text
                  emoji
                  numberOfLines={imageUri ? 2 : 4}
                  style={[a.text_sm, a.leading_snug]}>
                  {link.description}
                </Text>
              ) : undefined}
            </View>
            <View style={[a.px_md]}>
              <Divider />
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  a.gap_2xs,
                  a.pb_sm,
                  {
                    paddingTop: 6, // off menu
                  },
                ]}>
                <Globe
                  size="xs"
                  style={[
                    a.transition_color,
                    hovered
                      ? t.atoms.text_contrast_medium
                      : t.atoms.text_contrast_low,
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    a.transition_color,
                    a.text_xs,
                    a.leading_snug,
                    hovered
                      ? t.atoms.text_contrast_high
                      : t.atoms.text_contrast_medium,
                  ]}>
                  {toNiceDomain(link.uri)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </Link>
  )
}
