import {View} from 'react-native'
import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {useLingui} from '@lingui/react/macro'

import {getShapeRadius, getShapeStyle} from '#/lib/shapes'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {type AtmosphereAppCardData} from '#/screens/Atmosphere/data/exploreData'
import {atoms as a, useTheme, utils} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {contrastForeground} from '#/features/themes/accentForeground'

export function AppCard({app}: {app: AtmosphereAppCardData}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const shape = useEnableSquareButtons()
  const avatarShape = useEnableSquareAvatars()

  return (
    <View
      style={[
        a.w_full,
        a.relative,
        getShapeStyle(shape, a.rounded_xl, a.rounded_xl),
        a.overflow_hidden,
        {backgroundColor: app.overlayColor ?? t.palette.contrast_50},
      ]}>
      {app.backgroundImage ? (
        <Image
          source={app.backgroundImage}
          contentFit="cover"
          style={[a.absolute, {top: 0, right: 0, bottom: 0, width: 96}]}
          accessible={false}
        />
      ) : undefined}
      {app.overlayColor ? (
        <LinearGradient
          colors={[
            utils.alpha(app.overlayColor, 1),
            utils.alpha(app.overlayColor, 0),
          ]}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={[a.absolute, {top: 0, right: 0, bottom: 0, width: 96}]}
          pointerEvents="none"
        />
      ) : undefined}
      <Link
        to={app.href}
        dataSet={{keyboardNavigationItem: 'true'}}
        label={l`Open ${app.title}`}
        accessibilityHint=""
        style={[a.w_full]}>
        <View
          style={[
            a.flex_row,
            a.w_full,
            a.align_center,
            a.gap_md,
            a.py_md,
            {paddingLeft: 24, paddingRight: 96},
          ]}>
          {app.logo ? (
            <Image
              source={app.logo}
              contentFit="cover"
              style={[
                {
                  width: 44,
                  height: 44,
                  borderRadius: getShapeRadius(avatarShape, 8, 8),
                },
              ]}
              accessible={false}
            />
          ) : undefined}
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text
              emoji
              style={[
                a.text_md,
                a.font_semi_bold,
                {
                  color:
                    app.textColor ??
                    (app.overlayColor
                      ? contrastForeground(app.overlayColor)
                      : t.atoms.text.color),
                },
              ]}
              numberOfLines={1}>
              {app.title}
            </Text>
            {app.description ? (
              <Text
                emoji
                style={[
                  a.text_sm,
                  a.leading_snug,
                  {
                    color:
                      app.textColor ??
                      (app.overlayColor
                        ? contrastForeground(app.overlayColor)
                        : t.atoms.text.color),
                  },
                ]}
                numberOfLines={2}>
                {app.description}
              </Text>
            ) : undefined}
          </View>
        </View>
      </Link>
    </View>
  )
}
