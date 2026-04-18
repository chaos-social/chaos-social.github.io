import {type GestureResponderEvent, View} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {isInvalidHandle, sanitizeHandle} from '#/lib/strings/handles'
import {sanitizePronouns} from '#/lib/strings/pronouns'
import {type Shadow} from '#/state/cache/types'
import {useShowFollowsYouBadge} from '#/state/preferences/show-follows-you-badge'
import {useShowLinkInHandle} from '#/state/preferences/show-link-in-handle.tsx'
import {useShowLinkInHandleOnlyOnWorkingLinks} from '#/state/preferences/show-link-in-handle-only-on-working-links'
import {useHandleLinkQuery} from '#/state/queries/handle-link'
import {atoms as a, useTheme, web} from '#/alf'
import {InlineLinkText} from '#/components/Link.tsx'
import {NewskieDialog} from '#/components/NewskieDialog'
import {Text} from '#/components/Typography'
import {IS_IOS, IS_NATIVE} from '#/env'

export function ProfileHeaderHandle({
  profile,
  disableTaps,
  disableAuxiliaryTaps,
  onLinkPress,
}: {
  profile: Shadow<AppBskyActorDefs.ProfileViewDetailed>
  disableTaps?: boolean
  disableAuxiliaryTaps?: boolean
  onLinkPress?: (e: GestureResponderEvent) => void | false
}) {
  const t = useTheme()
  const {_} = useLingui()
  const invalidHandle = isInvalidHandle(profile.handle)
  const pronouns = profile.pronouns
  const blockHide = profile.viewer?.blocking || profile.viewer?.blockedBy
  const isBskySocialHandle = profile.handle.endsWith('.bsky.social')
  const showFollowsYouBadge = useShowFollowsYouBadge()
  const showProfileInHandle = useShowLinkInHandle()
  const showLinkInHandleOnlyOnWorkingLinks =
    useShowLinkInHandleOnlyOnWorkingLinks()
  const shouldCheckHandleLink =
    showProfileInHandle &&
    showLinkInHandleOnlyOnWorkingLinks &&
    !invalidHandle &&
    !isBskySocialHandle
  const {data: hasWorkingHandleLink = false} = useHandleLinkQuery(
    profile.handle,
    shouldCheckHandleLink,
  )
  const shouldShowProfileLink =
    showProfileInHandle &&
    !isBskySocialHandle &&
    (!showLinkInHandleOnlyOnWorkingLinks || hasWorkingHandleLink)
  const disableNewskieDialog = disableTaps || disableAuxiliaryTaps
  const sanitized = sanitizeHandle(
    profile.handle,
    '@',
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
  return (
    <View
      style={[a.flex_row, a.gap_sm, a.align_center, {maxWidth: '100%'}]}
      pointerEvents={disableTaps ? 'none' : IS_IOS ? 'auto' : 'box-none'}>
      <NewskieDialog profile={profile} disabled={disableNewskieDialog} />
      {showFollowsYouBadge && profile.viewer?.followedBy && !blockHide ? (
        <View style={[t.atoms.bg_contrast_50, a.rounded_xs, a.px_sm, a.py_xs]}>
          <Text style={[t.atoms.text, a.text_sm]}>
            <Trans>Follows you</Trans>
          </Text>
        </View>
      ) : undefined}
      <View style={[a.flex_row, a.flex_wrap, {gap: 6}]}>
        {invalidHandle ? (
          <Text emoji numberOfLines={1} style={handleTextStyle}>
            {_(msg`⚠Invalid Handle`)}
          </Text>
        ) : shouldShowProfileLink ? (
          <InlineLinkText
            to={`https://${profile.handle}`}
            label={profile.handle}
            numberOfLines={1}
            style={[a.text_md, a.leading_tight, web({direction: 'ltr'})]}
            onPress={onLinkPress}>
            {sanitized}
          </InlineLinkText>
        ) : (
          <Text emoji numberOfLines={1} style={handleTextStyle}>
            {sanitized}
          </Text>
        )}
        {pronouns && (
          <Text style={[t.atoms.text_contrast_low, a.text_md, a.leading_tight]}>
            {sanitizePronouns(pronouns, IS_NATIVE)}
          </Text>
        )}
      </View>
    </View>
  )
}
