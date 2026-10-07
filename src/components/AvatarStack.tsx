import {View} from 'react-native'
import {moderateProfile} from '@bsky/sdk/moderation'

import {getShapeRadius} from '#/lib/shapes'
import {logger} from '#/logger'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useProfilesQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import type * as bsky from '#/types/bsky'

export function AvatarStack({
  profiles,
  size = 26,
  numPending,
  backgroundColor,
  borderWidth = 1,
  overlap,
}: {
  profiles: bsky.profile.AnyProfileView[]
  size?: number
  numPending?: number
  backgroundColor?: string
  borderWidth?: number
  overlap?: number
}) {
  const translation = overlap ?? size / 3
  const t = useTheme()
  const moderationOpts = useModerationOpts()
  const enableSquareAvatars = useEnableSquareAvatars()

  const isPending = (numPending && profiles.length === 0) || !moderationOpts

  const items = isPending
    ? Array.from({length: numPending ?? profiles.length}).map((_, i) => ({
        key: i,
        profile: null,
        moderation: null,
      }))
    : profiles.map(item => ({
        key: item.did,
        profile: item,
        moderation: moderateProfile(item, moderationOpts),
      }))

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.relative,
        {width: size + (items.length - 1) * (size - translation)},
      ]}>
      {items.map((item, i) => (
        <View
          key={item.key}
          style={[
            t.atoms.bg_contrast_25,
            a.relative,
            {
              width: size,
              height: size,
              left: i * -translation,
              borderWidth,
              borderColor: backgroundColor ?? t.atoms.bg.backgroundColor,
              borderRadius: getShapeRadius(
                enableSquareAvatars,
                size > 32 ? 8 : 3,
                999,
              ),
              zIndex: 3 - i,
            },
          ]}>
          {item.profile && (
            <UserAvatar
              size={size - borderWidth * 2}
              avatar={item.profile.avatar}
              type={item.profile.associated?.labeler ? 'labeler' : 'user'}
              moderation={item.moderation.ui('avatar')}
            />
          )}
        </View>
      ))}
    </View>
  )
}

export function AvatarStackWithFetch({
  profiles,
  size,
  backgroundColor,
}: {
  profiles: string[]
  size?: number
  backgroundColor?: string
}) {
  const {data, error} = useProfilesQuery({handles: profiles})

  if (error) {
    if (error.name !== 'AbortError') {
      logger.error('Error fetching profiles for AvatarStack', {
        safeMessage: error,
      })
    }
    return null
  }

  const orderedProfiles = profiles
    .map(did => data?.profiles?.find(profile => profile.did === did))
    .filter((profile): profile is NonNullable<typeof profile> =>
      Boolean(profile),
    )

  return (
    <AvatarStack
      numPending={profiles.length}
      profiles={orderedProfiles}
      size={size}
      backgroundColor={backgroundColor}
    />
  )
}
