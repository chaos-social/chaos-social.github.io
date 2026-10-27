import {View} from 'react-native'
import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {useLingui} from '@lingui/react/macro'

import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {type AtmosphereAnnouncementBannerData} from '#/screens/Atmosphere/data/exploreData'
import {atoms as a, useTheme, utils} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {contrastForeground} from '#/features/themes/accentForeground'

export function AnnouncementBanner({
  banner,
}: {
  banner: AtmosphereAnnouncementBannerData
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const shape = useEnableSquareButtons()

  return (
    <View style={a.pb_md}>
      <View
        style={[
          a.w_full,
          a.relative,
          getShapeStyle(shape, a.rounded_md, a.rounded_md),
          t.atoms.bg_contrast_50,
          a.overflow_hidden,
          {aspectRatio: 2.62},
        ]}>
        {banner.image ? (
          <Image
            source={banner.image}
            contentFit="cover"
            style={[a.absolute, a.inset_0]}
            accessible={false}
          />
        ) : undefined}
        {banner.overlayColor ? (
          <LinearGradient
            colors={[
              utils.alpha(banner.overlayColor, 0),
              utils.alpha(banner.overlayColor, 0.2),
              utils.alpha(banner.overlayColor, 0.8),
            ]}
            locations={[0, 0.5, 1]}
            start={{x: 0, y: 0}}
            end={{x: 0, y: 1}}
            style={[a.absolute, a.inset_0]}
            pointerEvents="none"
          />
        ) : undefined}
        <Link
          to={banner.href}
          dataSet={{keyboardNavigationItem: 'true'}}
          label={l`Open announcement: ${banner.title}`}
          accessibilityHint=""
          style={[
            a.flex_col,
            a.flex_1,
            a.align_start,
            a.justify_end,
            a.p_lg,
            {width: '66%'},
          ]}>
          <Text
            emoji
            style={[
              a.text_lg,
              a.font_bold,
              {
                color:
                  banner.textColor ??
                  (banner.overlayColor
                    ? contrastForeground(banner.overlayColor)
                    : t.atoms.text.color),
              },
            ]}
            numberOfLines={2}>
            {banner.title}
          </Text>
          {banner.description ? (
            <Text
              emoji
              style={[
                a.text_xs,
                {
                  color:
                    banner.textColor ??
                    (banner.overlayColor
                      ? contrastForeground(banner.overlayColor)
                      : t.atoms.text.color),
                },
              ]}
              numberOfLines={4}>
              {banner.description}
            </Text>
          ) : undefined}
        </Link>
      </View>
    </View>
  )
}
