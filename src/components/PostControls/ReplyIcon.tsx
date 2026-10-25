import Svg, {Ellipse, Path} from 'react-native-svg'

import {useReplyIconIndicators} from '#/state/preferences/reply-icon-indicators'
import {type Props, useCommonSVGProps} from '#/components/icons/common'
import {Reply_Stroke2_Corner0_Rounded as Bubble} from '#/components/icons/Reply'

const replyIcons = [false, true].map(restricted =>
  Array.from({length: 4}, (_, dotCount) => {
    return function ReplyIcon(props: Props) {
      const {fill, size, style, gradient, ...rest} = useCommonSVGProps(props)

      return (
        <Svg
          fill="none"
          {...rest}
          viewBox="0 0 24 24"
          width={size}
          height={size}
          style={style}>
          {gradient}
          <Path
            d="M18 4H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h2v4l5-4h5a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Z"
            stroke={fill}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={restricted ? '2 3.1' : undefined}
          />
          {Array.from({length: dotCount}, (_, index) => (
            <Ellipse
              key={index}
              cx={12 - (dotCount - 1) * 2 + index * 4}
              cy={11}
              rx={1.25}
              ry={1.5}
              fill={fill}
            />
          ))}
        </Svg>
      )
    }
  }),
)

/**
 * Indicator artwork for a reply count and gate state. Ignores the
 * `replyIconIndicators` pref, so use {@link useReplyIcon} instead - the settings
 * row is the one caller that wants the artwork regardless.
 */
export function getReplyIcon(replyCount: number, restricted: boolean) {
  const dotCount = Math.min(3, Math.max(0, Math.floor(replyCount)))
  return replyIcons[restricted ? 1 : 0][dotCount]
}

export function useReplyIcon(replyCount: number, restricted: boolean) {
  const indicators = useReplyIconIndicators() ?? true
  return indicators ? getReplyIcon(replyCount, restricted) : Bubble
}
