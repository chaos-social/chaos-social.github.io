import {type GameMedia} from '#/view/com/composer/state/composer'

/**
 * Native stub. Games are only attachable on web, where the player can run, so
 * the composer never has one to preview here.
 */
export function GamePreview(_props: {
  game: GameMedia
  onRemove: () => void
}) {
  return null
}
