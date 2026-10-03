import {type ViewProps} from 'react-native'
import {requireNativeViewManager} from 'expo-modules-core'

/** Observes sibling input and image views without participating in their layout. */
export const NativeComposerLayout: React.ComponentType<
  ViewProps & {emojiLayout: string}
> = requireNativeViewManager('ExpoComposerEmojiLayout')
