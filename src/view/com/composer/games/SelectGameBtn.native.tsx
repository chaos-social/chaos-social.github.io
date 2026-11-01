import {type GameMedia} from '#/view/com/composer/state/composer'

/**
 * Native stub. Game playback needs Ruffle or CheerpJ, so the feature is web
 * only and this never renders.
 */
export function SelectGameBtn(_props: {
  onSelectGame: (game: Omit<GameMedia, 'type'>) => void
  disabled?: boolean
}) {
  return null
}
