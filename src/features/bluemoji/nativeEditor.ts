import {type RichText} from '@bsky/sdk/richtext'

import {type BluemojiItem, getBluemojiMatches} from '#/features/bluemoji/util'

/** A full-width character reserves one image-sized cursor slot in TextInput. */
export const NATIVE_EMOJI_SLOT = '\u3000'

export type NativeEmojiProjection = {
  text: string
  raw: string
  tokens: {
    index: number
    start: number
    end: number
    alias: string
    item: BluemojiItem
  }[]
}

/** Keep source aliases outside the native input's editable character positions. */
export function projectNativeEmoji(
  rt: RichText,
  items: Map<string, BluemojiItem>,
): NativeEmojiProjection {
  const tokens: NativeEmojiProjection['tokens'] = []
  let text = ''
  let end = 0
  for (const match of getBluemojiMatches(rt)) {
    const item = items.get(match[0])
    if (!item || match.index < end) continue
    text += rt.text.slice(end, match.index)
    end = match.index + match[0].length
    tokens.push({
      index: text.length,
      start: match.index,
      end,
      alias: match[0],
      item,
    })
    text += NATIVE_EMOJI_SLOT
  }
  return {text: text + rt.text.slice(end), raw: rt.text, tokens}
}

/** Map native selection offsets back to the source text used for facets. */
export function nativeToRaw(projection: NativeEmojiProjection, index: number) {
  return (
    index +
    projection.tokens.reduce(
      (extra, token) =>
        extra + (token.index < index ? token.alias.length - 1 : 0),
      0,
    )
  )
}

/** Snap selections inside a newly resolved alias to an emoji boundary. */
export function rawToNative(projection: NativeEmojiProjection, index: number) {
  let extra = 0
  for (const token of projection.tokens) {
    if (index <= token.start) break
    if (index < token.end) return token.index + 1
    extra += token.alias.length - 1
  }
  return index - extra
}

/** Expand only retained slots; deleting or replacing a slot deletes its alias. */
export function applyNativeEmojiEdit(
  previous: NativeEmojiProjection,
  text: string,
  selection: {start: number; end: number},
) {
  return applyNativeEmojiEditWithSelection(previous, text, selection).raw
}

/** Return the source caret at the end of the native replacement. */
export function applyNativeEmojiEditWithSelection(
  previous: NativeEmojiProjection,
  text: string,
  selection: {start: number; end: number},
) {
  if (text === previous.text)
    return {raw: previous.raw, cursor: nativeToRaw(previous, selection.start)}
  let start = 0
  while (
    start < previous.text.length &&
    start < text.length &&
    previous.text[start] === text[start]
  )
    start++
  start = Math.min(start, selection.start)
  if (selection.start === selection.end && text.length < previous.text.length) {
    start = Math.min(
      start,
      Math.max(0, selection.start + text.length - previous.text.length),
    )
  }
  let oldEnd = previous.text.length
  let newEnd = text.length
  while (
    oldEnd > start &&
    newEnd > start &&
    previous.text[oldEnd - 1] === text[newEnd - 1]
  ) {
    oldEnd--
    newEnd--
  }
  const raw =
    previous.raw.slice(0, nativeToRaw(previous, start)) +
    text.slice(start, newEnd) +
    previous.raw.slice(nativeToRaw(previous, oldEnd))
  return {raw, cursor: nativeToRaw(previous, start) + newEnd - start}
}
