import {useEffect, useState} from 'react'
import {Pressable, View} from 'react-native'
import {type GestureResponderEvent} from 'react-native'
import * as ExpoClipboard from 'expo-clipboard'
import {Trans, useLingui} from '@lingui/react/macro'

import {isInvalidHandle, sanitizeHandle} from '#/lib/strings/handles'
import {type Shadow} from '#/state/cache/types'
import {useHideDisplayNames} from '#/state/preferences/hide-display-names'
import {useShowFollowsYouBadge} from '#/state/preferences/show-follows-you-badge'
import {atoms as a, useTheme, web} from '#/alf'
import {NewskieDialog} from '#/components/dialogs/NewskieDialog'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as OutlinkIcon} from '#/components/icons/SquareArrowTopRight'
import {Link} from '#/components/Link'
import {PronounPill} from '#/components/PronounPill'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_IOS, IS_NATIVE} from '#/env'
import {type app} from '#/lexicons'
import {useProfileHandleLink} from './useProfileHandleLink'

export function ProfileHeaderHandle({
  profile,
  disableTaps,
  disableAuxiliaryTaps,
  showPronouns = true,
  truncate = false,
  onLinkPress,
  verticalPadding = 0,
}: {
  profile: Shadow<app.bsky.actor.defs.ProfileViewDetailed>
  disableTaps?: boolean
  disableAuxiliaryTaps?: boolean
  showPronouns?: boolean
  truncate?: boolean
  onLinkPress?: (e: GestureResponderEvent) => void | false
  verticalPadding?: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [copied, setCopied] = useState<{handle: string} | null>(null)
  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(timeout)
  }, [copied])
  const hideDisplayNames = useHideDisplayNames()
  const invalidHandle = isInvalidHandle(profile.handle)
  const pronouns = profile.pronouns
  const blockHide = profile.viewer?.blocking || profile.viewer?.blockedBy
  const showFollowsYouBadge = useShowFollowsYouBadge()
  const shouldShowProfileLink = useProfileHandleLink(profile.handle)
  const disableNewskieDialog = disableTaps || disableAuxiliaryTaps
  const sanitized = sanitizeHandle(
    profile.handle,
    '',
    // forceLTR handled by CSS above on web
    IS_NATIVE,
  )
  const handleTextStyle = [
    invalidHandle
      ? [
          a.border,
          a.text_xs,
          a.px_sm,
          a.py_xs,
          a.rounded_xs,
          {borderColor: t.palette.contrast_200},
        ]
      : [a.text_md, a.leading_tight, t.atoms.text_contrast_medium],
    web({
      wordBreak: 'break-all',
      direction: 'ltr',
      unicodeBidi: 'isolate',
    }),
  ]
  const HandleArea = IS_NATIVE ? Pressable : View
  const AtSection = IS_NATIVE ? View : Pressable
  const copyProps = {
    testID: 'profileHeaderCopyHandleBtn',
    accessibilityRole: 'button' as const,
    accessibilityLabel: l`Copy handle`,
    accessibilityHint: l`Copy this handle to the clipboard`,
    accessibilityState: {
      disabled: Boolean(disableTaps || disableAuxiliaryTaps),
    },
    disabled: disableTaps || disableAuxiliaryTaps,
    onPress: async () => {
      const handle = `@${profile.handle}`
      await ExpoClipboard.setStringAsync(handle)
      setCopied({handle: profile.handle})
      Toast.show(l`Copied ${handle}`, {type: 'success'})
    },
  }
  return (
    <View
      style={[
        a.flex_row,
        a.gap_sm,
        a.align_center,
        {maxWidth: '100%', paddingVertical: verticalPadding},
      ]}
      pointerEvents={disableTaps ? 'none' : IS_IOS ? 'auto' : 'box-none'}>
      <NewskieDialog profile={profile} disabled={disableNewskieDialog} />
      {showFollowsYouBadge && profile.viewer?.followedBy && !blockHide ? (
        <View style={[t.atoms.bg_contrast_50, a.rounded_xs, a.px_sm, a.py_xs]}>
          <Text style={[t.atoms.text, a.text_sm]}>
            <Trans>Follows you</Trans>
          </Text>
        </View>
      ) : undefined}
      <View
        style={[
          a.flex_row,
          !truncate && a.flex_wrap,
          a.flex_shrink,
          a.align_center,
          {gap: 6},
          truncate && {minWidth: 0},
        ]}>
        {!hideDisplayNames &&
          (invalidHandle ? (
            <Text emoji numberOfLines={1} style={handleTextStyle}>
              {l`⚠Invalid Handle`}
            </Text>
          ) : (
            <View style={[a.flex_row, a.align_center, a.flex_shrink]}>
              <HandleArea
                {...(IS_NATIVE ? copyProps : {})}
                style={[a.flex_row, a.align_center, a.flex_shrink]}>
                <AtSection
                  {...(!IS_NATIVE ? copyProps : {})}
                  style={[a.align_center, a.justify_center]}>
                  <Text
                    style={[
                      handleTextStyle,
                      a.text_center,
                      copied?.handle === profile.handle && {opacity: 0},
                    ]}>
                    @
                  </Text>
                  {copied?.handle === profile.handle && (
                    <View
                      pointerEvents="none"
                      style={[
                        a.absolute,
                        a.inset_0,
                        a.align_center,
                        a.justify_center,
                      ]}>
                      <Text style={handleTextStyle}>✓</Text>
                    </View>
                  )}
                </AtSection>
                <Text
                  emoji
                  numberOfLines={1}
                  style={[a.flex_shrink, handleTextStyle]}>
                  {sanitized}
                </Text>
              </HandleArea>
              {shouldShowProfileLink && (
                <Link
                  testID="profileHeaderHandleWebsiteBtn"
                  to={`https://${profile.handle}`}
                  label={l`Visit ${profile.handle}`}
                  style={[
                    a.p_0,
                    {
                      backgroundColor: 'transparent',
                      marginLeft: 4,
                    },
                  ]}
                  hoverStyle={{backgroundColor: 'transparent'}}
                  onPress={e => {
                    if (disableTaps || disableAuxiliaryTaps) return false
                    return onLinkPress?.(e)
                  }}>
                  <OutlinkIcon
                    size="xs"
                    fill={t.atoms.text_contrast_medium.color}
                  />
                </Link>
              )}
            </View>
          ))}
        {showPronouns && (
          <PronounPill
            pronouns={pronouns}
            style={truncate ? {flexShrink: 0, maxWidth: '45%'} : undefined}
          />
        )}
      </View>
    </View>
  )
}
