import {
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react'
import {
  Pressable,
  type StyleProp,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import flattenReactChildren from 'react-keyed-flatten-children'

import {getShapeStyle, SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {atoms as a, tokens, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeftIcon} from '#/components/icons/Chevron'
import {
  Context,
  ItemContext,
  useMenuContext,
  useMenuItemContext,
} from '#/components/Menu/context'
import {leadingIcons} from '#/components/Menu/leadingIcons'
import {
  type ContextType,
  type GroupProps,
  type ItemIconProps,
  type ItemProps,
  type ItemTextProps,
  type SubmenuProps,
  type TriggerProps,
} from '#/components/Menu/types'
import {Text} from '#/components/Typography'
import {IS_ANDROID, IS_IOS, IS_NATIVE} from '#/env'

// iOS 26's floaty sheet presentation subtracts the bottom safe-area inset from
// the requested detent, which eats the visible bottom padding of short (e.g.
// single-item) menus. Flooring the native sheet height restores that padding.
const IOS_MENU_MIN_HEIGHT = 128

export {
  type DialogControlProps as MenuControlProps,
  useDialogControl as useMenuControl,
} from '#/components/Dialog'

export {useMenuContext}

export function Root({
  children,
  control,
  modal: _modal = true,
  disableBackdrop: _disableBackdrop = false,
  dismissGuardRef: _dismissGuardRef,
}: React.PropsWithChildren<{
  control?: Dialog.DialogControlProps
  modal?: boolean
  disableBackdrop?: boolean
  dismissGuardRef?: React.MutableRefObject<boolean>
}>) {
  const defaultControl = Dialog.useDialogControl()
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null)
  const submenuRegistry = useMemo<
    NonNullable<ContextType['nativeSubmenu']>['registry']
  >(() => new Map(), [])
  const openSubmenu = useCallback((id: string) => {
    setActiveSubmenuId(id)
  }, [])
  const closeSubmenu = useCallback(() => {
    setActiveSubmenuId(null)
  }, [])
  const context = useMemo<ContextType>(
    () => ({
      control: control || defaultControl,
      nativeSubmenu: {
        activeId: activeSubmenuId,
        registry: submenuRegistry,
        open: openSubmenu,
        close: closeSubmenu,
      },
    }),
    [
      control,
      defaultControl,
      activeSubmenuId,
      submenuRegistry,
      openSubmenu,
      closeSubmenu,
    ],
  )

  return <Context.Provider value={context}>{children}</Context.Provider>
}

export function Trigger({
  children,
  label,
  role = 'button',
  hint,
}: TriggerProps) {
  const context = useMenuContext()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()

  return children({
    IS_NATIVE: true,
    control: context.control,
    state: {
      hovered: false,
      focused,
      pressed,
    },
    props: {
      ref: null,
      onPress: context.control.open,
      onFocus,
      onBlur,
      onPressIn,
      onPressOut,
      accessibilityHint: hint,
      accessibilityLabel: label,
      accessibilityRole: role,
    },
  })
}

export function Outer({
  children,
  showCancel,
}: React.PropsWithChildren<{
  showCancel?: boolean
  style?: StyleProp<ViewStyle>
  onCloseAutoFocus?: (event: Event) => void
}>) {
  const context = useMenuContext()
  const {t: l} = useLingui()

  return (
    <Dialog.Outer
      control={context.control}
      onClose={context.nativeSubmenu?.close}
      nativeOptions={{
        preventExpansion: true,
        minHeight: IS_IOS ? IOS_MENU_MIN_HEIGHT : undefined,
      }}>
      <Dialog.Handle />
      {/* Re-wrap with context since Dialogs are portal-ed to root */}
      <Context.Provider value={context}>
        <Dialog.ScrollableInner label={l`Menu`}>
          <View style={[a.gap_lg]}>
            <View
              style={[
                a.gap_lg,
                context.nativeSubmenu?.activeId ? {display: 'none'} : null,
              ]}>
              {children}
            </View>
            <NativeSubmenuContent />
            {IS_NATIVE && showCancel && <Cancel />}
          </View>
        </Dialog.ScrollableInner>
      </Context.Provider>
    </Dialog.Outer>
  )
}

function NativeSubmenuContent() {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  const {t: l} = useLingui()
  const context = useMenuContext()
  const activeId = context.nativeSubmenu?.activeId
  const submenu = activeId
    ? context.nativeSubmenu?.registry.get(activeId)
    : undefined

  if (!submenu) {
    return null
  }

  return (
    <View style={[a.gap_lg]}>
      <LabelText>{submenu.label}</LabelText>
      <View
        style={[
          getShapeStyle(enableSquareButtons, a.rounded_lg, a.rounded_lg),
          a.curve_continuous,
          a.overflow_hidden,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <Pressable
          accessibilityHint=""
          accessibilityLabel={l`Back`}
          accessibilityRole="button"
          onPress={context.nativeSubmenu?.close}
          style={[
            a.flex_row,
            a.align_center,
            a.gap_sm,
            a.px_md,
            t.atoms.bg_contrast_25,
            {minHeight: 44, paddingVertical: 10},
          ]}>
          <ItemContext.Provider value={{disabled: false, destructive: false}}>
            <ItemIcon icon={ChevronLeftIcon} />
            <ItemText>{l`Back`}</ItemText>
          </ItemContext.Provider>
        </Pressable>
      </View>
      {submenu.children}
    </View>
  )
}

export function Item({
  children,
  label,
  style,
  onPress,
  destructive = false,
  ...rest
}: ItemProps) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  const context = useMenuContext()
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()

  return (
    <Pressable
      {...rest}
      accessibilityHint=""
      accessibilityLabel={label}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={e => {
        if (IS_ANDROID) {
          /**
           * Below fix for iOS doesn't work for Android, this does.
           */
          onPress?.(e)
          context.control.close()
        } else if (IS_IOS) {
          /**
           * Fixes a subtle bug on iOS
           * {@link https://github.com/bluesky-social/social-app/pull/5849/files#diff-de516ef5e7bd9840cd639213301df38cf03acfcad5bda85a1d63efd249ba79deL124-L127}
           */
          context.control.close(() => {
            onPress?.(e)
          })
        }
      }}
      onPressIn={e => {
        onPressIn()
        rest.onPressIn?.(e)
      }}
      onPressOut={e => {
        onPressOut()
        rest.onPressOut?.(e)
      }}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_md,
        getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_md),
        a.overflow_hidden,
        a.border,
        t.atoms.bg_contrast_25,
        t.atoms.border_contrast_low,
        {minHeight: 44, paddingVertical: 10},
        style,
        enableSquareButtons === 'sharp' && SHARP_CORNERS,
        (focused || pressed) && !rest.disabled && [t.atoms.bg_contrast_50],
      ]}>
      <ItemContext.Provider
        value={{disabled: Boolean(rest.disabled), destructive}}>
        {leadingIcons(children, ItemIcon)}
      </ItemContext.Provider>
    </Pressable>
  )
}

/**
 * A nested menu. On native, submenus replace the contents of the current sheet
 * and provide a back action; on web the Radix implementation presents a
 * conventional hover/keyboard submenu.
 */
export function Submenu({children, label, trigger, style}: SubmenuProps) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  const context = useMenuContext()
  const id = useId()
  context.nativeSubmenu?.registry.set(id, {label, children})
  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {
    state: pressed,
    onIn: onPressIn,
    onOut: onPressOut,
  } = useInteractionState()

  return (
    <>
      <Pressable
        accessibilityHint=""
        accessibilityLabel={label}
        accessibilityRole="button"
        onFocus={onFocus}
        onBlur={onBlur}
        onPress={() => context.nativeSubmenu?.open(id)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.px_md,
          getShapeStyle(enableSquareButtons, a.rounded_md, a.rounded_md),
          a.overflow_hidden,
          a.border,
          t.atoms.bg_contrast_25,
          t.atoms.border_contrast_low,
          {minHeight: 44, paddingVertical: 10},
          style,
          enableSquareButtons === 'sharp' && SHARP_CORNERS,
          (focused || pressed) && t.atoms.bg_contrast_50,
        ]}>
        <ItemContext.Provider value={{disabled: false, destructive: false}}>
          {trigger}
        </ItemContext.Provider>
      </Pressable>
    </>
  )
}

export function ItemText({children, style}: ItemTextProps) {
  const t = useTheme()
  const {disabled, destructive} = useMenuItemContext()
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="middle"
      style={[
        a.flex_1,
        a.text_md,
        a.font_semi_bold,
        t.atoms.text_contrast_high,
        style,
        destructive && {color: t.palette.negative_500},
        disabled && t.atoms.text_contrast_low,
      ]}>
      {children}
    </Text>
  )
}

export function ItemIcon({icon: Comp, position = 'left', fill}: ItemIconProps) {
  const t = useTheme()
  const {disabled, destructive} = useMenuItemContext()
  const icon = (
    <Comp
      width={position === 'right' ? 12 : 22}
      fill={
        fill
          ? fill({disabled})
          : disabled
            ? t.atoms.text_contrast_low.color
            : destructive
              ? t.palette.negative_500
              : t.atoms.text_contrast_medium.color
      }
    />
  )
  return position === 'right' ? (
    <View style={[a.align_center, {width: 24, flexShrink: 0}]}>{icon}</View>
  ) : (
    icon
  )
}

export function ItemRadio({selected}: {selected: boolean}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <View
      style={[
        a.justify_center,
        a.align_center,
        getShapeStyle(enableSquareButtons, a.rounded_sm, a.rounded_full),
        t.atoms.border_contrast_high,
        {
          borderWidth: 1,
          height: 20,
          width: 20,
        },
      ]}>
      {selected ? (
        <View
          style={[
            a.absolute,
            getShapeStyle(
              enableSquareButtons,
              {borderRadius: tokens.borderRadius.sm - 3},
              a.rounded_full,
            ),
            {height: 14, width: 14},
            selected
              ? {
                  backgroundColor: t.palette.primary_500,
                }
              : {},
          ]}
        />
      ) : null}
    </View>
  )
}

/**
 * NATIVE ONLY - for adding non-pressable items to the menu
 *
 * @platform ios, android
 */
export function ContainerItem({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.px_md,
        getShapeStyle(enableSquareButtons, a.rounded_lg, a.rounded_lg),
        a.curve_continuous,
        a.border,
        t.atoms.bg_contrast_25,
        t.atoms.border_contrast_low,
        {paddingVertical: 10},
        style,
        enableSquareButtons === 'sharp' && SHARP_CORNERS,
      ]}>
      {children}
    </View>
  )
}

export function LabelText({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<TextStyle>
}) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.font_semi_bold,
        t.atoms.text_contrast_medium,
        {marginBottom: -8},
        style,
      ]}>
      {children}
    </Text>
  )
}

export function Group({children, style}: GroupProps) {
  const t = useTheme()
  const enableSquareButtons = useEnableSquareButtons()
  return (
    <View
      style={[
        getShapeStyle(enableSquareButtons, a.rounded_lg, a.rounded_lg),
        a.curve_continuous,
        a.overflow_hidden,
        a.border,
        t.atoms.border_contrast_low,
        style,
        enableSquareButtons === 'sharp' && SHARP_CORNERS,
      ]}>
      {flattenReactChildren(children).map((child, i) => {
        return isValidElement(child) &&
          (child.type === Item ||
            child.type === ContainerItem ||
            child.type === Submenu) ? (
          <Fragment key={i}>
            {i > 0 ? (
              <View style={[a.border_b, t.atoms.border_contrast_low]} />
            ) : null}
            {cloneElement(child, {
              // @ts-expect-error cloneElement is not aware of the types
              style: {
                borderRadius: 0,
                borderWidth: 0,
              },
            })}
          </Fragment>
        ) : null
      })}
    </View>
  )
}

function Cancel() {
  const {t: l} = useLingui()
  const context = useMenuContext()

  return (
    <Button
      label={l`Close this dialog`}
      size="small"
      variant="ghost"
      color="secondary"
      onPress={() => context.control.close()}>
      <ButtonText>
        <Trans>Cancel</Trans>
      </ButtonText>
    </Button>
  )
}

export function Divider() {
  return null
}
