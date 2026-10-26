import {View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Trans, useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {getShapeStyle} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {Nux, useNux, useSaveNux} from '#/state/queries/nuxs'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/TimesLarge'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {accentForeground} from '#/features/themes/accentForeground'

export function AtmosphereNux() {
  const {t: l} = useLingui()
  const t = useTheme()
  const shape = useEnableSquareButtons()
  const ax = useAnalytics()
  const {nux} = useNux(Nux.AtmosphereNux)
  const {mutate: save, variables} = useSaveNux()

  if (variables || nux?.completed) return null

  const dismiss = () => {
    Toast.show(`TEMP: Dismissed the banner. Will remove for production.`)
    return
    save({
      id: Nux.AtmosphereNux,
      completed: true,
      data: undefined,
    })
    ax.metric('atmosphere:nux:bannerDismissed', {})
  }

  return (
    <View style={a.pb_md}>
      <View
        style={[
          a.w_full,
          a.relative,
          getShapeStyle(shape, a.rounded_md, a.rounded_md),
          a.overflow_hidden,
          {height: 180},
        ]}>
        {/*
        <Image
          source={discoverAtmosphereNux}
          contentFit="cover"
          style={[a.absolute, a.inset_0]}
          accessible={false}
        />
        */}
        <LinearGradient
          colors={[t.palette.primary_500, t.palette.primary_600]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={[a.absolute, a.inset_0]}
        />
        <View style={[a.absolute, a.inset_0, a.justify_end, a.p_lg, a.gap_xs]}>
          <Text
            emoji
            style={[
              a.text_lg,
              a.font_bold,
              {color: accentForeground(t, t.palette.primary_500)},
            ]}
            numberOfLines={2}>
            <Trans>Discover the Atmosphere</Trans>
          </Text>
          <Text
            emoji
            style={[
              a.text_sm,
              a.leading_snug,
              {
                color: accentForeground(t, t.palette.primary_500),
                maxWidth: 260,
              },
            ]}
            numberOfLines={4}>
            <Trans>
              Bluesky is part of a growing network of hundreds of social apps.
              Your account unlocks them all.
            </Trans>
          </Text>
        </View>
        <Button
          label={l`Dismiss Discover the Atmosphere banner`}
          accessibilityHint={l`Hides this banner from the Explore tab`}
          hitSlop={HITSLOP_10}
          testID="atmosphereNuxDismiss"
          onPress={dismiss}
          color="secondary_inverted"
          shape="round"
          size="tiny"
          style={[
            a.absolute,
            a.align_center,
            a.justify_center,
            {top: a.p_md.padding, right: a.p_md.padding},
          ]}>
          <ButtonIcon icon={XIcon} size="sm" />
        </Button>
      </View>
    </View>
  )
}
