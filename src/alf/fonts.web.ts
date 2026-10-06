import {
  applyFonts as applySharedFonts,
  type MutableTextStyle,
} from './fonts.shared'

export * from './fonts.shared'

/** Keep the text font first so ordinary numbers retain their text styling. */
export function applyFonts(
  style: MutableTextStyle,
  fontFamily: 'material' | 'system' | 'theme',
) {
  applySharedFonts(style, fontFamily)
  style.fontFamily = style.fontFamily?.replace(
    /^([^,]+)(.*)$/,
    '$1, var(--emoji-font, "__disabledEmojiFont")$2',
  )
}
