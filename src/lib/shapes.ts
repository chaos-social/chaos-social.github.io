import {type ViewStyle} from 'react-native'

/** Keeps the original round/rounded boolean preferences compatible with storage and sync. */
export type ShapePreference = boolean | 'sharp' | undefined

/** Resets individual corners as well as the shorthand radius, including RTL styles. */
export const SHARP_CORNERS = {
  borderRadius: 0,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  borderTopStartRadius: 0,
  borderTopEndRadius: 0,
  borderBottomStartRadius: 0,
  borderBottomEndRadius: 0,
  borderStartStartRadius: 0,
  borderStartEndRadius: 0,
  borderEndStartRadius: 0,
  borderEndEndRadius: 0,
} satisfies ViewStyle

/** Resolves the corner radius for all three appearance settings. */
export function getShapeRadius(
  preference: ShapePreference,
  rounded: number,
  completelyRounded: number,
) {
  return preference === 'sharp' ? 0 : preference ? rounded : completelyRounded
}

/** Preserves size and layout styles while removing rounding in sharp mode. */
export function getShapeStyle(
  preference: ShapePreference,
  rounded: ViewStyle,
  completelyRounded: ViewStyle,
): ViewStyle {
  return preference === 'sharp'
    ? {...rounded, ...SHARP_CORNERS}
    : preference
      ? rounded
      : completelyRounded
}
