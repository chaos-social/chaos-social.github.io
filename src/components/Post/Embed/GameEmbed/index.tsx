import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {GAME_KIND_LABEL, type GameEmbed as Game, getGameAspect} from './utils'

/**
 * Native can't run a game runtime, so this mirrors the ordinary external card
 * and lets `Link` open the player page in the in-app browser.
 */
export function GameEmbed({
  view,
  game,
  style,
  onOpen,
}: {
  view: app.bsky.embed.external.ViewExternal
  game: Game
  style?: React.ComponentProps<typeof View>['style']
  onOpen?: () => void
}) {
  const {_} = useLingui()
  const t = useTheme()
  const shapePreference = useEnableSquareButtons()
  const title = view.title

  return (
    <View
      style={[
        a.mt_sm,
        a.flex_col,
        a.align_stretch,
        a.rounded_md,
        a.overflow_hidden,
        a.border,
        a.w_full,
        t.atoms.border_contrast_low,
        shapePreference === 'sharp' && SHARP_CORNERS,
        style,
      ]}>
      <Link
        label={_(msg`Play ${title}`)}
        to={view.uri}
        onPress={onOpen}
        style={[a.w_full, a.flex_col, a.align_stretch]}>
        <View
          style={[
            a.w_full,
            a.align_center,
            a.justify_center,
            {aspectRatio: getGameAspect(game)},
            t.atoms.bg_contrast_25,
          ]}>
          <Text style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            {GAME_KIND_LABEL[game.kind]}
          </Text>
        </View>
        <View style={[a.p_md, a.gap_2xs, t.atoms.bg]}>
          <Text numberOfLines={2} style={[a.text_lg, a.font_semi_bold]} emoji>
            {title}
          </Text>
          {view.description ? (
            <Text
              numberOfLines={2}
              style={[a.text_sm, t.atoms.text_contrast_medium]}
              emoji>
              {view.description}
            </Text>
          ) : null}
          <Text style={[a.text_sm, a.pt_xs, t.atoms.text_contrast_low]}>
            <Trans>Tap to play</Trans>
          </Text>
        </View>
      </Link>
    </View>
  )
}
