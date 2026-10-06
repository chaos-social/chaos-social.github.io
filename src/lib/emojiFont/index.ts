import {type Schema} from '#/state/persisted/schema'

export type EmojiFont = NonNullable<Schema['emojiFont']>
type CustomEmojiFont = Exclude<EmojiFont, 'system'>

const fonts: Record<
  CustomEmojiFont,
  {
    family: string
    url: string
    loading?: Promise<void>
    loaded?: boolean
    picker?: FontFace
  }
> = {
  noto: {
    family: 'WitchskyNotoColorEmoji',
    url: require('../../../assets/fonts/noto-color-emoji/WitchskyNotoColorEmoji.woff2') as string,
  },
  twemoji: {
    family: 'WitchskyTwemoji',
    url: require('../../../assets/fonts/twemoji/WitchskyTwemoji.woff2') as string,
  },
}

let activePicker: FontFace | undefined

export function loadEmojiFont(name: CustomEmojiFont): Promise<void> {
  const entry = fonts[name]
  if (!entry.loading) {
    const source = `url("${entry.url}")`
    const font = new FontFace(entry.family, source)
    // Emoji Mart puts this family first in its native emoji font stack.
    const picker = new FontFace('EmojiMart', source)
    entry.loading = Promise.all([font.load(), picker.load()])
      .then(([face]) => {
        document.fonts.add(face)
        entry.picker = picker
        entry.loaded = true
      })
      .catch(error => {
        entry.loading = undefined
        throw error
      })
  }
  return entry.loading
}

/** Update inherited font stacks, including inputs and Emoji Mart's shadow DOM. */
export function setEmojiFont(name: EmojiFont) {
  if (activePicker) {
    document.fonts.delete(activePicker)
    activePicker = undefined
  }
  const entry = name === 'system' ? undefined : fonts[name]
  if (entry?.loaded) {
    document.documentElement.style.setProperty('--emoji-font', entry.family)
    if (entry.picker) {
      document.fonts.add(entry.picker)
      activePicker = entry.picker
    }
  } else {
    document.documentElement.style.removeProperty('--emoji-font')
  }
}
