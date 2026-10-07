import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type AccessibilityProps,
  type GestureResponderEvent,
  type MouseEvent,
  type NativeSyntheticEvent,
  type PointerEvent,
  Pressable,
  type PressableProps,
  type StyleProp,
  type TargetedEvent,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'

import {getShapeRadius, getShapeStyle, SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useThemePrefs} from '#/state/shell'
import {atoms as a, flatten, useTheme} from '#/alf'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Text} from '#/components/Typography'
import {IS_WEB, IS_WEB_TOUCH_DEVICE} from '#/env'
import {accentForeground} from '#/features/themes/accentForeground'

/**
 * The `Button` component, and some extensions of it like `Link` are intended
 * to be generic and therefore apply no styles by default. These `VariantProps`
 * are what control the `Button`'s presentation, and are intended only use cases where the buttons appear as, well, buttons.
 *
 * If `Button` or an extension of it are used for other compound components, use this property to avoid misuse of these variant props further down the line.
 *
 * @example
 * type MyComponentProps = Omit<ButtonProps, UninheritableButtonProps> & {...}
 */
export type UninheritableButtonProps = 'variant' | 'color' | 'size' | 'shape'

export type ButtonVariant = 'solid' | 'outline' | 'ghost'
export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'secondary_inverted'
  | 'negative'
  | 'primary_subtle'
  | 'negative_subtle'
export type ButtonSize = 'tiny' | 'small' | 'medium' | 'large'
export type ButtonShape = 'round' | 'square' | 'rectangular' | 'default'
export type VariantProps = {
  /**
   * The style variation of the button
   * @deprecated Use `color` instead.
   */
  variant?: ButtonVariant
  /**
   * The color of the button
   */
  color?: ButtonColor
  /**
   * The size of the button
   */
  size?: ButtonSize
  /**
   * The shape of the button
   *
   * - `default`: Pill shaped. Most buttons should use this shape.
   * - `round`: Circular. For icon-only buttons.
   * - `square`: Square. For icon-only buttons.
   * - `rectangular`: Rectangular. Matches previous style, use when adjacent to form fields.
   */
  shape?: ButtonShape
}

export type ButtonState = {
  hovered: boolean
  focused: boolean
  pressed: boolean
  disabled: boolean
  /**
   * Alias for hovered || focused || pressed
   */
  interacting: boolean
}

export type ButtonContext = VariantProps & ButtonState

type NonTextElements =
  React.ReactElement | Iterable<React.ReactElement | null | undefined | boolean>

type WebLongPressPressableProps = {
  onPointerDown?: (e: PointerEvent) => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
  onContextMenu?: (e: Event) => void
}

export type ButtonProps = Pick<
  PressableProps,
  | 'disabled'
  | 'onPress'
  | 'testID'
  | 'onLongPress'
  | 'hitSlop'
  | 'onHoverIn'
  | 'onHoverOut'
  | 'onPressIn'
  | 'onPressOut'
  | 'onFocus'
  | 'onBlur'
  | 'onAccessibilityAction'
  | 'onAccessibilityEscape'
> &
  AccessibilityProps &
  VariantProps & {
    testID?: string
    /**
     * For a11y, try to make this descriptive and clear
     */
    label: string
    style?: StyleProp<ViewStyle>
    hoverStyle?: StyleProp<ViewStyle>
    children: NonTextElements | ((context: ButtonContext) => NonTextElements)
    PressableComponent?: React.ComponentType<
      PressableProps & WebLongPressPressableProps
    >
  }

export type ButtonTextProps = TextProps &
  VariantProps & {disabled?: boolean; emoji?: boolean}

const Context = createContext<VariantProps & ButtonState>({
  hovered: false,
  focused: false,
  pressed: false,
  disabled: false,
  interacting: false,
})
Context.displayName = 'ButtonContext'

export function useButtonContext() {
  return useContext(Context)
}

export const Button = forwardRef<React.ComponentRef<typeof View>, ButtonProps>(
  (
    {
      children,
      variant: variantProp,
      color,
      size,
      shape = 'default',
      label,
      disabled = false,
      style,
      hoverStyle: hoverStyleProp,
      PressableComponent = Pressable,
      onPress: onPressOuter,
      onLongPress: onLongPressOuter,
      onPressIn: onPressInOuter,
      onPressOut: onPressOutOuter,
      onHoverIn: onHoverInOuter,
      onHoverOut: onHoverOutOuter,
      onFocus: onFocusOuter,
      onBlur: onBlurOuter,
      ...rest
    },
    ref,
  ) => {
    /**
     * The `variant` prop is deprecated in favor of simply specifying `color`.
     * If a `color` is set, then we want to use the existing codepaths for
     * "solid" buttons. This is to maintain backwards compatibility.
     */
    let variant: VariantProps['variant'] = variantProp
    const resolvedVariant = !variantProp && color ? 'solid' : variant

    const enableSquareButtons = useEnableSquareButtons()

    const t = useTheme()
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggeredRef = useRef(false)
    const [state, setState] = useState({
      pressed: false,
      hovered: false,
      focused: false,
    })

    const clearLongPressTimer = useCallback(() => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }, [])

    const onPressIn = useCallback(
      (e: GestureResponderEvent) => {
        setState(s => ({
          ...s,
          pressed: true,
        }))
        longPressTriggeredRef.current = false
        onPressInOuter?.(e)
      },
      [setState, onPressInOuter],
    )
    const onPressOut = useCallback(
      (e: GestureResponderEvent) => {
        setState(s => ({
          ...s,
          pressed: false,
        }))
        clearLongPressTimer()
        onPressOutOuter?.(e)
      },
      [clearLongPressTimer, setState, onPressOutOuter],
    )
    const onPress = useCallback(
      (e: GestureResponderEvent) => {
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false
          return
        }
        onPressOuter?.(e)
      },
      [onPressOuter],
    )
    const onPointerDown = useCallback(
      (e: PointerEvent) => {
        if (onLongPressOuter && IS_WEB && !IS_WEB_TOUCH_DEVICE) {
          clearLongPressTimer()
          longPressTriggeredRef.current = false
          longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true
            onLongPressOuter(e as unknown as GestureResponderEvent)
          }, 500)
        }
      },
      [clearLongPressTimer, onLongPressOuter],
    )
    const onPointerUp = useCallback(() => {
      clearLongPressTimer()
    }, [clearLongPressTimer])
    const onPointerLeave = useCallback(() => {
      clearLongPressTimer()
    }, [clearLongPressTimer])
    const onContextMenu = useCallback(
      (e: Event) => {
        if (onLongPressOuter && IS_WEB && !IS_WEB_TOUCH_DEVICE) {
          e.preventDefault()
          clearLongPressTimer()
          if (longPressTriggeredRef.current) return
          longPressTriggeredRef.current = true
          onLongPressOuter(e as unknown as GestureResponderEvent)
        }
      },
      [clearLongPressTimer, onLongPressOuter],
    )
    const onHoverIn = useCallback(
      (e: MouseEvent) => {
        setState(s => ({
          ...s,
          hovered: true,
        }))
        onHoverInOuter?.(e)
      },
      [setState, onHoverInOuter],
    )
    const onHoverOut = useCallback(
      (e: MouseEvent) => {
        setState(s => ({
          ...s,
          hovered: false,
        }))
        onHoverOutOuter?.(e)
      },
      [setState, onHoverOutOuter],
    )
    const onFocus = useCallback(
      (e: NativeSyntheticEvent<TargetedEvent>) => {
        setState(s => ({
          ...s,
          focused: true,
        }))
        onFocusOuter?.(e)
      },
      [setState, onFocusOuter],
    )
    const onBlur = useCallback(
      (e: NativeSyntheticEvent<TargetedEvent>) => {
        setState(s => ({
          ...s,
          focused: false,
        }))
        onBlurOuter?.(e)
      },
      [setState, onBlurOuter],
    )

    const {baseStyles, hoverStyles} = useMemo(() => {
      const baseStyles: ViewStyle[] = []
      const hoverStyles: ViewStyle[] = []

      /*
       * This is the happy path for new button styles, following the
       * deprecation of `variant` prop. This redundant `variant` check is here
       * just to make this handling easier to understand.
       */
      if (resolvedVariant === 'solid') {
        if (color === 'primary') {
          if (!disabled) {
            baseStyles.push({
              backgroundColor: t.palette.primary_500,
            })
            hoverStyles.push({
              backgroundColor: t.palette.primary_600,
            })
          } else {
            baseStyles.push({
              backgroundColor: t.palette.primary_200,
            })
          }
        } else if (color === 'secondary') {
          if (!disabled) {
            baseStyles.push(t.atoms.bg_contrast_50)
            hoverStyles.push(t.atoms.bg_contrast_100)
          } else {
            baseStyles.push(t.atoms.bg_contrast_50)
          }
        } else if (color === 'secondary_inverted') {
          if (!disabled) {
            baseStyles.push({
              backgroundColor: t.palette.contrast_900,
            })
            hoverStyles.push({
              backgroundColor: t.palette.contrast_975,
            })
          } else {
            baseStyles.push({
              backgroundColor: t.palette.contrast_600,
            })
          }
        } else if (color === 'negative') {
          if (!disabled) {
            baseStyles.push({
              backgroundColor: t.palette.negative_500,
            })
            hoverStyles.push({
              backgroundColor: t.palette.negative_600,
            })
          } else {
            baseStyles.push({
              backgroundColor: t.palette.negative_700,
            })
          }
        } else if (color === 'primary_subtle') {
          if (!disabled) {
            baseStyles.push({
              backgroundColor: t.palette.primary_50,
            })
            hoverStyles.push({
              backgroundColor: t.palette.primary_100,
            })
          } else {
            baseStyles.push({
              backgroundColor: t.palette.primary_50,
            })
          }
        } else if (color === 'negative_subtle') {
          if (!disabled) {
            baseStyles.push({
              backgroundColor: t.palette.negative_50,
            })
            hoverStyles.push({
              backgroundColor: t.palette.negative_100,
            })
          } else {
            baseStyles.push({
              backgroundColor: t.palette.negative_50,
            })
          }
        }
      } else {
        /*
         * BEGIN DEPRECATED STYLES
         */
        if (color === 'primary') {
          if (resolvedVariant === 'outline') {
            baseStyles.push(a.border, t.atoms.bg, {
              borderWidth: 1,
            })

            if (!disabled) {
              baseStyles.push(a.border, {
                borderColor: t.palette.primary_500,
              })
              hoverStyles.push(a.border, {
                backgroundColor: t.palette.primary_50,
              })
            } else {
              baseStyles.push(a.border, {
                borderColor: t.palette.primary_200,
              })
            }
          } else if (resolvedVariant === 'ghost') {
            if (!disabled) {
              baseStyles.push(t.atoms.bg)
              hoverStyles.push({
                backgroundColor: t.palette.primary_100,
              })
            }
          }
        } else if (color === 'secondary') {
          if (resolvedVariant === 'outline') {
            baseStyles.push(a.border, t.atoms.bg, {
              borderWidth: 1,
            })

            if (!disabled) {
              baseStyles.push(a.border, {
                borderColor: t.palette.contrast_300,
              })
              hoverStyles.push(t.atoms.bg_contrast_50)
            } else {
              baseStyles.push(a.border, {
                borderColor: t.palette.contrast_200,
              })
            }
          } else if (resolvedVariant === 'ghost') {
            if (!disabled) {
              baseStyles.push(t.atoms.bg)
              hoverStyles.push({
                backgroundColor: t.palette.contrast_50,
              })
            }
          }
        } else if (color === 'secondary_inverted') {
          if (resolvedVariant === 'outline') {
            baseStyles.push(a.border, t.atoms.bg, {
              borderWidth: 1,
            })

            if (!disabled) {
              baseStyles.push(a.border, {
                borderColor: t.palette.contrast_300,
              })
              hoverStyles.push(t.atoms.bg_contrast_50)
            } else {
              baseStyles.push(a.border, {
                borderColor: t.palette.contrast_200,
              })
            }
          } else if (resolvedVariant === 'ghost') {
            if (!disabled) {
              baseStyles.push(t.atoms.bg)
              hoverStyles.push({
                backgroundColor: t.palette.contrast_50,
              })
            }
          }
        } else if (color === 'negative') {
          if (resolvedVariant === 'outline') {
            baseStyles.push(a.border, t.atoms.bg, {
              borderWidth: 1,
            })

            if (!disabled) {
              baseStyles.push(a.border, {
                borderColor: t.palette.negative_500,
              })
              hoverStyles.push(a.border, {
                backgroundColor: t.palette.negative_50,
              })
            } else {
              baseStyles.push(a.border, {
                borderColor: t.palette.negative_200,
              })
            }
          } else if (resolvedVariant === 'ghost') {
            if (!disabled) {
              baseStyles.push(t.atoms.bg)
              hoverStyles.push({
                backgroundColor: t.palette.negative_100,
              })
            }
          }
        } else if (color === 'negative_subtle') {
          if (resolvedVariant === 'outline') {
            baseStyles.push(a.border, t.atoms.bg, {
              borderWidth: 1,
            })

            if (!disabled) {
              baseStyles.push(a.border, {
                borderColor: t.palette.negative_500,
              })
              hoverStyles.push(a.border, {
                backgroundColor: t.palette.negative_50,
              })
            } else {
              baseStyles.push(a.border, {
                borderColor: t.palette.negative_200,
              })
            }
          } else if (resolvedVariant === 'ghost') {
            if (!disabled) {
              baseStyles.push(t.atoms.bg)
              hoverStyles.push({
                backgroundColor: t.palette.negative_100,
              })
            }
          }
        }
        /*
         * END DEPRECATED STYLES
         */
      }

      if (shape === 'default') {
        if (size === 'large') {
          baseStyles.push(
            getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
            {
              paddingVertical: 12,
              paddingHorizontal: 24,
              gap: 6,
            },
          )
        } else if (size === 'medium') {
          baseStyles.push(
            getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
            {
              paddingVertical: 9,
              paddingHorizontal: 28,
              gap: 5,
            },
          )
        } else if (size === 'small') {
          baseStyles.push(
            getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
            {
              paddingVertical: 8,
              paddingHorizontal: 14,
              gap: 5,
            },
          )
        } else if (size === 'tiny') {
          baseStyles.push(
            getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
            {
              paddingVertical: 5,
              paddingHorizontal: 10,
              gap: 3,
            },
          )
        }
      } else if (shape === 'rectangular') {
        if (size === 'large') {
          baseStyles.push({
            paddingVertical: 12,
            paddingHorizontal: 25,
            borderRadius: 10,
            gap: 3,
          })
        } else if (size === 'medium') {
          baseStyles.push({
            paddingVertical: 9,
            paddingHorizontal: 16,
            borderRadius: 8,
            gap: 3,
          })
        } else if (size === 'small') {
          baseStyles.push({
            paddingVertical: 8,
            paddingHorizontal: 13,
            borderRadius: 8,
            gap: 3,
          })
        } else if (size === 'tiny') {
          baseStyles.push({
            paddingVertical: 5,
            paddingHorizontal: 9,
            borderRadius: 6,
            gap: 2,
          })
        }
      } else if (shape === 'round' || shape === 'square') {
        /*
         * These sizes match the actual rendered size on screen, based on
         * Chrome's web inspector
         */
        if (size === 'large') {
          if (shape === 'round') {
            baseStyles.push({height: 44, width: 44})
          } else {
            baseStyles.push({height: 44, width: 44})
          }
        } else if (size === 'medium') {
          if (shape === 'round') {
            baseStyles.push({height: 33, width: 33})
          } else {
            baseStyles.push({height: 33, width: 33})
          }
        } else if (size === 'small') {
          if (shape === 'round') {
            baseStyles.push({height: 33, width: 33})
          } else {
            baseStyles.push({height: 33, width: 33})
          }
        } else if (size === 'tiny') {
          if (shape === 'round') {
            baseStyles.push({height: 25, width: 25})
          } else {
            baseStyles.push({height: 25, width: 25})
          }
        }

        if (shape === 'round') {
          baseStyles.push(
            getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
          )
        } else if (shape === 'square') {
          if (size === 'tiny') {
            baseStyles.push({
              borderRadius: 6,
            })
          } else {
            baseStyles.push(a.rounded_sm)
          }
        }
      }

      return {
        baseStyles,
        hoverStyles,
      }
    }, [t, resolvedVariant, color, size, shape, disabled, enableSquareButtons])

    const context = useMemo<ButtonContext>(
      () => ({
        ...state,
        interacting: state.hovered || state.focused || state.pressed,
        variant: resolvedVariant,
        color,
        size,
        shape,
        disabled: disabled || false,
      }),
      [state, resolvedVariant, color, size, shape, disabled],
    )

    return (
      <PressableComponent
        role="button"
        accessibilityHint={undefined} // optional
        {...rest}
        {...(onLongPressOuter && IS_WEB && !IS_WEB_TOUCH_DEVICE
          ? {
              onPointerDown,
              onPointerUp,
              onPointerLeave,
              onContextMenu,
            }
          : {})}
        ref={ref}
        aria-label={label}
        aria-pressed={state.pressed}
        accessibilityLabel={label}
        disabled={disabled || false}
        accessibilityState={{
          disabled: disabled || false,
        }}
        style={[
          a.flex_row,
          a.align_center,
          a.justify_center,
          a.curve_continuous,
          baseStyles,
          style,
          ...(state.hovered || state.pressed
            ? [hoverStyles, hoverStyleProp]
            : []),
          enableSquareButtons === 'sharp' && SHARP_CORNERS,
        ]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        onLongPress={
          !IS_WEB || IS_WEB_TOUCH_DEVICE ? onLongPressOuter : undefined
        }
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        onFocus={onFocus}
        onBlur={onBlur}>
        <Context.Provider value={context}>
          {typeof children === 'function' ? children(context) : children}
        </Context.Provider>
      </PressableComponent>
    )
  },
)
Button.displayName = 'Button'

export function useSharedButtonTextStyles() {
  const t = useTheme()
  const {color, variant, disabled, size, interacting} = useButtonContext()
  const {colorScheme} = useThemePrefs()

  return useMemo(() => {
    const baseStyles: TextStyle[] = []

    /*
     * This is the happy path for new button styles, following the
     * deprecation of `variant` prop. This redundant `variant` check is here
     * just to make this handling easier to understand.
     */
    if (variant === 'solid') {
      if (color === 'primary') {
        baseStyles.push({
          color: accentForeground(
            t,
            disabled
              ? t.palette.primary_200
              : interacting
                ? t.palette.primary_600
                : t.palette.primary_500,
          ),
        })
      } else if (color === 'secondary') {
        if (!disabled) {
          baseStyles.push(t.atoms.text_contrast_medium)
        } else {
          baseStyles.push({
            color: t.palette.contrast_300,
          })
        }
      } else if (color === 'secondary_inverted') {
        if (!disabled) {
          baseStyles.push(t.atoms.text_inverted)
        } else {
          baseStyles.push({
            color: t.palette.contrast_300,
          })
        }
      } else if (color === 'negative') {
        if (!disabled) {
          baseStyles.push({color: t.palette.white})
        } else {
          baseStyles.push({color: t.palette.negative_300})
        }
      } else if (color === 'primary_subtle') {
        if (!disabled) {
          baseStyles.push({
            color: t.palette.primary_600,
          })
        } else {
          if (colorScheme === 'material3') {
            // ugly hack! really alf should export these colors as atoms
            baseStyles.push({
              color: t.palette.primary_400,
            })
          } else {
            baseStyles.push({
              color: t.palette.primary_200,
            })
          }
        }
      } else if (color === 'negative_subtle') {
        if (!disabled) {
          baseStyles.push({
            color: t.palette.negative_600,
          })
        } else {
          baseStyles.push({
            color: t.palette.negative_200,
          })
        }
      }
    } else {
      /*
       * BEGIN DEPRECATED STYLES
       */
      if (color === 'primary') {
        if (variant === 'outline') {
          if (!disabled) {
            baseStyles.push({
              color: t.palette.primary_600,
            })
          } else {
            baseStyles.push({color: t.palette.primary_600, opacity: 0.5})
          }
        } else if (variant === 'ghost') {
          if (!disabled) {
            baseStyles.push({color: t.palette.primary_600})
          } else {
            baseStyles.push({color: t.palette.primary_600, opacity: 0.5})
          }
        }
      } else if (color === 'secondary') {
        if (variant === 'outline') {
          if (!disabled) {
            baseStyles.push({
              color: t.palette.contrast_600,
            })
          } else {
            baseStyles.push({
              color: t.palette.contrast_300,
            })
          }
        } else if (variant === 'ghost') {
          if (!disabled) {
            baseStyles.push({
              color: t.palette.contrast_600,
            })
          } else {
            baseStyles.push({
              color: t.palette.contrast_300,
            })
          }
        }
      } else if (color === 'secondary_inverted') {
        if (variant === 'outline') {
          if (!disabled) {
            baseStyles.push({
              color: t.palette.contrast_600,
            })
          } else {
            baseStyles.push({
              color: t.palette.contrast_300,
            })
          }
        } else if (variant === 'ghost') {
          if (!disabled) {
            baseStyles.push({
              color: t.palette.contrast_600,
            })
          } else {
            baseStyles.push({
              color: t.palette.contrast_300,
            })
          }
        }
      } else if (color === 'negative') {
        if (variant === 'outline') {
          if (!disabled) {
            baseStyles.push({color: t.palette.negative_400})
          } else {
            baseStyles.push({color: t.palette.negative_400, opacity: 0.5})
          }
        } else if (variant === 'ghost') {
          if (!disabled) {
            baseStyles.push({color: t.palette.negative_400})
          } else {
            baseStyles.push({color: t.palette.negative_400, opacity: 0.5})
          }
        }
      } else if (color === 'negative_subtle') {
        if (variant === 'outline') {
          if (!disabled) {
            baseStyles.push({color: t.palette.negative_400})
          } else {
            baseStyles.push({color: t.palette.negative_400, opacity: 0.5})
          }
        } else if (variant === 'ghost') {
          if (!disabled) {
            baseStyles.push({color: t.palette.negative_400})
          } else {
            baseStyles.push({color: t.palette.negative_400, opacity: 0.5})
          }
        }
      }
      /*
       * END DEPRECATED STYLES
       */
    }

    if (size === 'large') {
      baseStyles.push(a.text_md, a.font_medium)
    } else if (size === 'medium') {
      baseStyles.push(a.text_sm, a.font_medium)
    } else if (size === 'small') {
      baseStyles.push(a.text_sm, a.font_medium)
    } else if (size === 'tiny') {
      baseStyles.push(a.text_xs, a.font_semi_bold)
    }

    return flatten(baseStyles)
  }, [t, variant, color, size, disabled, colorScheme, interacting])
}

export function ButtonText({children, style, ...rest}: ButtonTextProps) {
  const textStyles = useSharedButtonTextStyles()

  return (
    <Text {...rest} style={[a.text_center, textStyles, style]}>
      {children}
    </Text>
  )
}

export function ButtonIcon({
  icon: Comp,
  size,
}: {
  icon: React.ComponentType<SVGIconProps>
  /**
   * @deprecated no longer needed
   */
  position?: 'left' | 'right'
  size?: SVGIconProps['size']
}) {
  const {size: buttonSize, shape: buttonShape} = useButtonContext()
  const textStyles = useSharedButtonTextStyles()
  const {iconSize, iconContainerSize, iconNegativeMargin} = useMemo(() => {
    /**
     * Pre-set icon sizes for different button sizes
     */
    const iconSizeShorthand =
      size ??
      (({
        large: 'md',
        medium: 'sm',
        small: 'sm',
        tiny: 'xs',
      }[buttonSize || 'small'] || 'sm') as Exclude<
        SVGIconProps['size'],
        undefined
      >)

    /*
     * Copied here from icons/common.tsx so we can tweak if we need to, but
     * also so that we can calculate transforms.
     */
    const iconSize = {
      '2xs': 8,
      xs: 12,
      sm: 16,
      md: 18,
      lg: 24,
      xl: 28,
      '2xl': 32,
      '3xl': 40,
      '4xl': 48,
    }[iconSizeShorthand]

    /*
     * Goal here is to match rendered text size so that different size icons
     * don't increase button size
     */
    const iconContainerSize = {
      large: 20,
      medium: 17,
      small: 17,
      tiny: 15,
    }[buttonSize || 'small']

    /*
     * The icon needs to be closer to the edge of the button than the text. Therefore
     * we make the gap slightly too large, and then pull in the sides using negative margins.
     */
    let iconNegativeMargin = 0

    if (buttonShape === 'default') {
      iconNegativeMargin = {
        large: -2,
        medium: -2,
        small: -2,
        tiny: -1,
      }[buttonSize || 'small']
    }

    return {
      iconSize,
      iconContainerSize,
      iconNegativeMargin,
    }
  }, [buttonSize, buttonShape, size])

  return (
    <View
      style={[
        a.z_20,
        {
          width: size === '2xs' ? 10 : iconContainerSize,
          height: iconContainerSize,
          marginLeft: iconNegativeMargin,
          marginRight: iconNegativeMargin,
        },
      ]}>
      <View
        style={[
          a.absolute,
          {
            width: iconSize,
            height: iconSize,
            top: '50%',
            left: '50%',
            transform: [
              {
                translateX: (iconSize / 2) * -1,
              },
              {
                translateY: (iconSize / 2) * -1,
              },
            ],
          },
        ]}>
        <Comp
          width={iconSize}
          style={[
            {
              color: textStyles.color,
              pointerEvents: 'none',
            },
          ]}
        />
      </View>
    </View>
  )
}

export type StackedButtonProps = Omit<
  ButtonProps,
  keyof VariantProps | 'children'
> &
  Pick<VariantProps, 'color'> & {
    children: React.ReactNode
    icon: React.ComponentType<SVGIconProps>
  }

export function StackedButton({children, ...props}: StackedButtonProps) {
  const enableSquareButtons = useEnableSquareButtons()

  return (
    <Button
      {...props}
      size="tiny"
      style={[
        a.flex_col,
        {
          height: 72,
          paddingHorizontal: 16,
          borderRadius: getShapeRadius(enableSquareButtons, 4, 20),
          gap: 4,
        },
        props.style,
      ]}>
      <StackedButtonInnerText icon={props.icon}>
        {children}
      </StackedButtonInnerText>
    </Button>
  )
}

function StackedButtonInnerText({
  children,
  icon: Icon,
}: Pick<StackedButtonProps, 'icon' | 'children'>) {
  const textStyles = useSharedButtonTextStyles()
  return (
    <>
      <Icon width={24} fill={textStyles.color} />
      <ButtonText>{children}</ButtonText>
    </>
  )
}
