import {type TextInput} from 'react-native'
import {type RichText} from '@bsky/sdk/richtext'

import {type BluemojiRef} from '#/features/bluemoji/util'

export type TextInputRef = {
  insertText: (text: string) => void
  focus: () => void
  blur: () => void
  /**
   * @platform web
   */
  getCursorPosition: () =>
    {left: number; right: number; top: number; bottom: number} | undefined
  /**
   * Closes the autocomplete popup if it is open.
   * Returns `true` if the popup was closed, `false` otherwise.
   *
   * @platform web
   */
  maybeClosePopup: () => boolean
}

export type TextInputProps = {
  ref: React.Ref<TextInputRef>
  richtext: RichText
  bluemoji?: Record<string, BluemojiRef>
  bluemojiRepo?: string
  webForceMinHeight: boolean
  hasRightPadding: boolean
  isActive: boolean
  setRichText: (v: RichText) => void
  onPhotoPasted: (uri: string) => void
  onPressPublish: (richtext: RichText) => void
  onNewLink: (uri: string) => void
  onError: (err: string) => void
  onFocus: () => void
  canAddPost: boolean
  canMovePostUp: boolean
  canMovePostDown: boolean
  onBackspaceEmpty: () => boolean
  onAddPost: () => void
  onFocusPost: (direction: 'up' | 'down') => void
  onMovePost: (direction: 'up' | 'down') => void
} & Pick<
  React.ComponentProps<typeof TextInput>,
  | 'placeholder'
  | 'autoFocus'
  | 'style'
  | 'accessible'
  | 'accessibilityLabel'
  | 'accessibilityHint'
>
