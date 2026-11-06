import {Text, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useShowThreadPostNumbers} from '#/state/preferences/show-thread-post-numbers'
import {atoms as a, ios, platform, useTheme} from '#/alf'
import {useNativeFontScale} from '#/alf/util/dimensions'
import {type app} from '#/lexicons'

/**
 * Map of Android font scale values to inline offsets.
 */
const ANDROID_INLINE_OFFSETS = [
  [0.85, 2],
  [1, 4],
  [1.15, 6],
  [1.3, 8],
  [1.5, 10],
  [1.8, 12],
  [2, 14],
] as const

/**
 * Max amount the inline badge is nudged below the text baseline. Android's
 * containing `RichText` reserves matching room via `suffixOffset`.
 */
export const POST_NUMBER_INLINE_OFFSET = 14

function getAndroidInlineOffset(fontScale: number) {
  return ANDROID_INLINE_OFFSETS.reduce((nearest, candidate) =>
    Math.abs(candidate[0] - fontScale) < Math.abs(nearest[0] - fontScale)
      ? candidate
      : nearest,
  )[1]
}

export type ThreadItemPostNumbering = Pick<
  app.bsky.unspecced.defs.ThreadItemPost,
  'opThreadPostIndex' | 'opThreadPostCount'
>

/**
 * Whether this post should show its numbered badge. Honors the
 * `showThreadPostNumbers` pref, so callers that render the badge directly
 * (rather than passing it as a `suffix`) can rely on this alone.
 */
export function useHasThreadItemPostNumber(
  value: ThreadItemPostNumbering | undefined,
) {
  const showPostNumbers = useShowThreadPostNumbers()
  const index = value?.opThreadPostIndex
  const count = value?.opThreadPostCount

  return (
    showPostNumbers &&
    index !== undefined &&
    count !== undefined &&
    index >= 1 &&
    count >= 1 &&
    index <= count
  )
}

export function ThreadItemPostNumber({
  value,
  inline = true,
}: {
  value: ThreadItemPostNumbering | undefined
  inline?: boolean
}) {
  const t = useTheme()
  const square = useEnableSquareButtons()
  const {t: l} = useLingui()
  const nativeFontScale = useNativeFontScale()
  const shouldRender = useHasThreadItemPostNumber(value)
  const index = value?.opThreadPostIndex
  const count = value?.opThreadPostCount

  if (!shouldRender) {
    return null
  }

  return (
    <View
      style={[
        a.flex_shrink_0,
        square ? a.rounded_xs : a.rounded_full,
        t.atoms.bg_contrast_50,
        !inline && a.self_start,
        ios(a.py_2xs),
        {
          paddingLeft: 5,
          paddingRight: 5,
        },
        inline
          ? platform({
              android: {
                /*
                 * Android aligns the inline view's bottom to the surrounding
                 * text baseline.
                 * We want it to align the inline view's child/text baseline.
                 */
                transform: [
                  {translateY: getAndroidInlineOffset(nativeFontScale)},
                ],
              },
              ios: {
                /*
                 * For iOS, we just need to offset the padding we applied.
                 */
                transform: [{translateY: a.py_2xs.paddingBottom}],
              },
              web: {
                /*
                 * Inline views inherit the surrounding line height on web. Keep
                 * the badge at its usual size when emoji-only text enlarges it.
                 */
                lineHeight: a.text_xs.fontSize * a.leading_normal.lineHeight,
              },
            })
          : {top: -2, marginBottom: -2},
      ]}>
      <Text
        accessibilityLabel={l({
          message: `Post ${index} of ${count}`,
          context: 'post-number-in-thread',
          comment:
            "Screen reader label indicating post count in a thread, e.g., the 3rd post of 5 total is 'Post 3 of 5'",
        })}
        accessibilityHint=""
        style={[
          a.text_xs,
          a.font_medium,
          t.atoms.text_contrast_medium,
          {
            fontVariant: ['tabular-nums'],
          },
        ]}>
        <Trans
          context="post-number-in-thread"
          comment="Badge indicating post count in a thread, e.g., the 3rd post of 5 total is '3/5'">
          {index}/{count}
        </Trans>
      </Text>
    </View>
  )
}
