import {useLingui} from '@lingui/react/macro'

import {
  useEmojiFont,
  useSetEmojiFont,
} from '#/state/preferences/emoji-font/context'
import {AppearanceToggleButtonGroup} from '#/screens/Settings/components/AppearanceToggleButtonGroup'
import {EmojiSmile_Stroke2_Corner0_Rounded as EmojiIcon} from '#/components/icons/Emoji'

export function EmojiFontControl() {
  const {t: l} = useLingui()
  const font = useEmojiFont()
  const setFont = useSetEmojiFont()

  return (
    <AppearanceToggleButtonGroup
      title={l`Emoji 🤨🥰`}
      emoji
      testID="emojiFontControl"
      icon={EmojiIcon}
      items={[
        {label: l`System`, name: 'system'},
        {label: l`Noto`, name: 'noto'},
        {label: l`Twemoji`, name: 'twemoji'},
      ]}
      value={font}
      onChange={setFont}
    />
  )
}
