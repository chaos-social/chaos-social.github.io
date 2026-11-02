import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {ExternalEmbedRemoveBtn} from '#/view/com/composer/ExternalEmbedRemoveBtn'
import {type GameMedia} from '#/view/com/composer/state/composer'
import {atoms as a, useTheme} from '#/alf'
import {GameFrame} from '#/components/Post/Embed/GameEmbed/GameFrame'
import {
  GAME_KIND_LABEL,
  getGamePlayerUrl,
} from '#/components/Post/Embed/GameEmbed/utils'
import {Text} from '#/components/Typography'

/**
 * Composer preview for a game that hasn't been uploaded yet. The file only
 * exists in memory here, so it plays from an object URL through the same player
 * page the published post will use.
 */
export function GamePreview({
  game,
  onRemove,
}: {
  game: GameMedia
  onRemove: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const shapePreference = useEnableSquareButtons()
  /*
   * Created during render so the frame never renders without a source, and
   * re-created if the user picks a different file.
   */
  const [objectUrl, setObjectUrl] = useState(() => URL.createObjectURL(game.file))
  const [lastFile, setLastFile] = useState(game.file)
  if (lastFile !== game.file) {
    setLastFile(game.file)
    setObjectUrl(URL.createObjectURL(game.file))
  }
  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  return (
    <View
      style={[
        a.relative,
        a.mt_lg,
        a.rounded_md,
        a.overflow_hidden,
        a.border,
        a.w_full,
        t.atoms.border_contrast_low,
        shapePreference === 'sharp' && SHARP_CORNERS,
      ]}>
      <GameFrame
        /*
         * The player resolves blobs through a PDS, and an unsaved file isn't
         * on one yet, so hand it the object URL directly.
         */
        src={getGamePlayerUrl(window.location.origin, objectUrl, game)}
        title={game.title}
        game={game}
      />
      <View style={[a.p_md, a.gap_2xs, t.atoms.bg]}>
        <Text numberOfLines={2} style={[a.text_lg, a.font_semi_bold]} emoji>
          {game.title}
        </Text>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {l`${GAME_KIND_LABEL[game.kind]} · ${formatSize(game.file.size)} — uploads when you post`}
        </Text>
      </View>
      <ExternalEmbedRemoveBtn onRemove={onRemove} />
    </View>
  )
}

function formatSize(bytes: number): string {
  return bytes >= 1000000
    ? `${(bytes / 1000 / 1000).toFixed(1)} MB`
    : `${Math.round(bytes / 1000)} KB`
}
