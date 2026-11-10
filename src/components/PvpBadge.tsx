import {View} from 'react-native'
import {type ComAtprotoLabelDefs} from '@atproto/api'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import type * as bsky from '#/types/bsky'

/**
 * Whether the account has turned on PVP mode, stored as a `pvp` self-label.
 */
export function isPvpAccount(profile: {
  did: string
  labels?: ComAtprotoLabelDefs.Label[]
}): boolean {
  return (
    profile.labels?.some(l => l.val === 'pvp' && l.src === profile.did) ?? false
  )
}

const textSize = {
  xs: a.text_2xs,
  sm: a.text_2xs,
  md: a.text_xs,
  lg: a.text_sm,
  xl: a.text_sm,
} as const

export function PvpBadge({
  profile,
  size,
  allowFontScaling = true,
}: {
  profile: bsky.profile.AnyProfileView
  size: keyof typeof textSize
  allowFontScaling?: boolean
}) {
  const t = useTheme()

  if (!isPvpAccount(profile)) {
    return null
  }

  return (
    <View
      style={[
        a.align_center,
        a.justify_center,
        a.rounded_full,
        a.px_xs,
        {
          backgroundColor: t.palette.primary_500,
          paddingVertical: size === 'xs' || size === 'sm' ? 0.5 : 1,
        },
      ]}>
      <Text
        allowFontScaling={allowFontScaling}
        style={[
          textSize[size],
          a.font_bold,
          a.leading_tight,
          {color: t.atoms.text_inverted.color},
        ]}>
        <Trans context="Badge shown next to a profile name">PVP</Trans>
      </Text>
    </View>
  )
}
