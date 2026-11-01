import {useRef} from 'react'
import {Keyboard} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {type GameMedia} from '#/view/com/composer/state/composer'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {GameController_Stroke2_Corner0_Rounded as GameIcon} from '#/components/icons/GameController'
import {
  GAME_MAX_SIZE,
  getGameKindFromFilename,
  stripGameExtension,
} from '#/components/Post/Embed/GameEmbed/utils'
import * as toast from '#/components/Toast'

export const GAME_FILE_ACCEPT = '.swf,.jar,.zip,.tar.gz,.tgz'

/**
 * Web only. Ruffle and CheerpJ can't run natively; the native build resolves
 * `SelectGameBtn.native.tsx` to a no-op instead.
 */
export function SelectGameBtn({
  onSelectGame,
  disabled,
}: {
  onSelectGame: (game: Omit<GameMedia, 'type'>) => void
  disabled?: boolean
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  const inputRef = useRef<HTMLInputElement>(null)

  function onPress() {
    Keyboard.dismiss()
    inputRef.current?.click()
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Allow re-picking the same file after a validation failure.
    event.target.value = ''
    if (!file) return

    const kind = getGameKindFromFilename(file.name)
    if (!kind) {
      toast.show(l`Only .swf, .jar, and .zip or .tar.gz files are supported`, {
        type: 'warning',
      })
      return
    }
    if (file.size > GAME_MAX_SIZE) {
      toast.show(
        l`That file is larger than the ${Math.round(GAME_MAX_SIZE / 1000 / 1000)} MB limit`,
        {type: 'warning'},
      )
      return
    }

    onSelectGame({
      file,
      kind,
      title: stripGameExtension(file.name),
      alt: '',
    })
  }

  return (
    <>
      <Button
        testID="openGameBtn"
        onPress={onPress}
        label={l({
          message: 'Attach a game',
          comment:
            'Accessibility label for the button in the post composer that attaches a Flash, Java, or VNDS game file.',
        })}
        accessibilityHint={l({
          message: 'Opens a file picker for a game file',
          comment:
            'Accessibility hint announced after the attach-game button label.',
        })}
        style={a.p_sm}
        variant="ghost"
        shape={enableSquareButtons ? 'square' : 'round'}
        color="primary"
        disabled={disabled}>
        <GameIcon size="lg" style={disabled && t.atoms.text_contrast_low} />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={GAME_FILE_ACCEPT}
        onChange={onChange}
        style={{display: 'none'}}
        aria-hidden
        tabIndex={-1}
      />
    </>
  )
}
