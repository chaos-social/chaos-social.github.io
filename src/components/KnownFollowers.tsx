import {useLayoutEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {moderateProfile, type ModerationOpts} from '@bsky/sdk/moderation'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {
  type FollowedByMetricsDisplay,
  shouldShowFollowedByExactText,
  shouldShowFollowedByOverflowPlus,
  shouldShowFollowedByText,
} from '#/lib/metrics-display'
import {makeProfileLink} from '#/lib/routes/links'
import {getShapeRadius, type ShapePreference} from '#/lib/shapes'
import {getAuthorPrimaryName} from '#/lib/strings/display-names'
import {useEnableSquareAvatars} from '#/state/preferences/enable-square-avatars'
import {useHideDisplayNames} from '#/state/preferences/hide-display-names'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {PlusSmall_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {Link, type LinkProps} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import type * as bsky from '#/types/bsky'

const AVI_SIZE = 30
const AVI_SIZE_SMALL = 20
const AVI_BORDER = 1

function avatarBorderRadius(size: number, preference: ShapePreference) {
  return getShapeRadius(
    preference,
    size > 32 ? 8 : 3,
    (size + AVI_BORDER * 2) / 2,
  )
}

/**
 * Shared logic to determine if `KnownFollowers` should be shown.
 *
 * Checks the # of actual returned users instead of the `count` value, because
 * `count` includes blocked users and `followers` does not.
 */
export function shouldShowKnownFollowers(
  knownFollowers?: app.bsky.actor.defs.KnownFollowers,
) {
  return knownFollowers && knownFollowers.followers.length > 0
}

export function KnownFollowers({
  profile,
  moderationOpts,
  onLinkPress,
  minimal,
  showIfEmpty,
  followedByDisplay = 'visible',
}: {
  profile: bsky.profile.AnyProfileView
  moderationOpts: ModerationOpts
  onLinkPress?: LinkProps['onPress']
  minimal?: boolean
  showIfEmpty?: boolean
  followedByDisplay?: FollowedByMetricsDisplay
}) {
  const cacheRef = useRef<Map<string, app.bsky.actor.defs.KnownFollowers>>(
    new Map(),
  )
  const [cachedKnownFollowers, setCachedKnownFollowers] = useState<
    app.bsky.actor.defs.KnownFollowers | undefined
  >()
  const knownFollowers = profile.viewer?.knownFollowers

  /*
   * Results for `knownFollowers` are not sorted consistently, so when
   * revalidating we can see a flash of this data updating. This cache prevents
   * this happening for screens that remain in memory. When pushing a new
   * screen, or once this one is popped, this cache is empty, so new data is
   * displayed.
   */
  useLayoutEffect(() => {
    if (knownFollowers && !cacheRef.current.has(profile.did)) {
      cacheRef.current.set(profile.did, knownFollowers)
    }
    setCachedKnownFollowers(cacheRef.current.get(profile.did))
  }, [profile.did, knownFollowers])

  if (cachedKnownFollowers && shouldShowKnownFollowers(cachedKnownFollowers)) {
    return (
      <KnownFollowersInner
        profile={profile}
        cachedKnownFollowers={cachedKnownFollowers}
        moderationOpts={moderationOpts}
        onLinkPress={onLinkPress}
        minimal={minimal}
        showIfEmpty={showIfEmpty}
        followedByDisplay={followedByDisplay}
      />
    )
  }

  return <EmptyFallback show={showIfEmpty} />
}

function KnownFollowersInner({
  profile,
  moderationOpts,
  cachedKnownFollowers,
  onLinkPress,
  minimal,
  showIfEmpty,
  followedByDisplay,
}: {
  profile: bsky.profile.AnyProfileView
  moderationOpts: ModerationOpts
  cachedKnownFollowers: app.bsky.actor.defs.KnownFollowers
  onLinkPress?: LinkProps['onPress']
  minimal?: boolean
  showIfEmpty?: boolean
  followedByDisplay: FollowedByMetricsDisplay
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const enableSquareAvatars = useEnableSquareAvatars()
  const hideDisplayNames = useHideDisplayNames()

  const textStyle = [a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]
  const showText = shouldShowFollowedByText(followedByDisplay)
  const showExactText = shouldShowFollowedByExactText(followedByDisplay)

  const slice = cachedKnownFollowers.followers.slice(0, 3).map(f => {
    const moderation = moderateProfile(f, moderationOpts)
    return {
      profile: {
        ...f,
        displayName: getAuthorPrimaryName(f, {
          hideDisplayNames,
          moderation: moderation.ui('displayName'),
        }),
      },
      moderation,
    }
  })

  // Does not have blocks applied. Always >= slices.length
  const serverCount = cachedKnownFollowers.count

  /*
   * We check above too, but here for clarity and a reminder to _check for
   * valid indices_
   */
  if (slice.length === 0) return <EmptyFallback show={showIfEmpty} />

  const SIZE = minimal ? AVI_SIZE_SMALL : AVI_SIZE
  const dim = SIZE + AVI_BORDER * 2
  const radius = avatarBorderRadius(SIZE, enableSquareAvatars ?? true)
  const showOverflowPlus = shouldShowFollowedByOverflowPlus(
    followedByDisplay,
    serverCount,
    slice.length,
  )

  return (
    <Link
      label={l`Press to view followers of this account that you also follow`}
      onPress={onLinkPress}
      to={makeProfileLink(profile, 'known-followers')}
      style={[
        a.max_w_full,
        a.flex_row,
        minimal ? a.gap_sm : a.gap_md,
        a.align_center,
        {marginLeft: -AVI_BORDER},
      ]}>
      {({hovered, pressed}) => (
        <>
          <View
            style={[
              a.flex_row,
              a.align_center,
              {
                height: dim,
              },
              pressed && {
                opacity: 0.5,
              },
            ]}>
            {slice.map(({profile: prof, moderation}, i) => (
              <View
                key={prof.did}
                style={[
                  {
                    borderWidth: AVI_BORDER,
                    borderColor: t.atoms.bg.backgroundColor,
                    width: dim,
                    height: dim,
                    borderRadius: radius,
                    zIndex: slice.length - i + (showOverflowPlus ? 1 : 0),
                    marginLeft: i > 0 ? -8 : 0,
                    overflow: 'hidden',
                  },
                ]}>
                <UserAvatar
                  size={SIZE}
                  avatar={prof.avatar}
                  moderation={moderation.ui('avatar')}
                  type={prof.associated?.labeler ? 'labeler' : 'user'}
                  noBorder
                />
              </View>
            ))}
            {showOverflowPlus ? (
              <View
                style={[
                  a.align_center,
                  a.justify_center,
                  {
                    borderWidth: AVI_BORDER,
                    borderColor: t.atoms.bg.backgroundColor,
                    width: dim,
                    height: dim,
                    borderRadius: radius,
                    marginLeft: -8,
                    zIndex: 0,
                    backgroundColor: t.atoms.text_contrast_low.color,
                  },
                ]}>
                <Plus
                  fill="white"
                  width={minimal ? 12 : 16}
                  height={minimal ? 12 : 16}
                />
              </View>
            ) : null}
          </View>

          {showText ? (
            <Text
              style={[
                a.flex_shrink,
                textStyle,
                hovered && {
                  textDecorationLine: 'underline',
                  textDecorationColor: t.atoms.text_contrast_medium.color,
                },
                pressed && {
                  opacity: 0.5,
                },
              ]}
              numberOfLines={2}>
              {showExactText && serverCount > 2 ? (
                <FollowedByExactText
                  serverCount={serverCount}
                  slice={slice}
                  textStyle={textStyle}
                />
              ) : (
                <FollowedByNamesText
                  serverCount={serverCount}
                  slice={slice}
                  textStyle={textStyle}
                />
              )}
            </Text>
          ) : null}
        </>
      )}
    </Link>
  )
}

function FollowedByNamesText({
  serverCount,
  slice,
  textStyle,
}: {
  serverCount: number
  slice: Array<{profile: {did: string; displayName: string}}>
  textStyle: object[]
}) {
  if (slice.length >= 2) {
    // 2-n followers, including blocks
    // only 2
    if (serverCount > 2) {
      return (
        <Trans>
          Followed by{' '}
          <Text emoji key={slice[0].profile.did} style={textStyle}>
            {slice[0].profile.displayName}
          </Text>
          ,{' '}
          <Text emoji key={slice[1].profile.did} style={textStyle}>
            {slice[1].profile.displayName}
          </Text>
          , and{' '}
          <Plural value={serverCount - 2} one="# other" other="# others" />
        </Trans>
      )
    }
    return (
      <Trans>
        Followed by{' '}
        <Text emoji key={slice[0].profile.did} style={textStyle}>
          {slice[0].profile.displayName}
        </Text>{' '}
        and{' '}
        <Text emoji key={slice[1].profile.did} style={textStyle}>
          {slice[1].profile.displayName}
        </Text>
      </Trans>
    )
  }

  if (serverCount > 1) {
    // 1-n followers, including blocks
    return (
      <Trans>
        Followed by{' '}
        <Text emoji key={slice[0].profile.did} style={textStyle}>
          {slice[0].profile.displayName}
        </Text>{' '}
        and <Plural value={serverCount - 1} one="# other" other="# others" />
      </Trans>
    )
  }

  // only 1
  return (
    <Trans>
      Followed by{' '}
      <Text emoji key={slice[0].profile.did} style={textStyle}>
        {slice[0].profile.displayName}
      </Text>
    </Trans>
  )
}

function FollowedByExactText({
  serverCount,
  slice,
  textStyle,
}: {
  serverCount: number
  slice: Array<{profile: {did: string; displayName: string}}>
  textStyle: object[]
}) {
  if (slice.length >= 2) {
    return (
      <Trans>
        Followed by{' '}
        <Plural value={serverCount} one="# person" other="# others" />,{' '}
        including{' '}
        <Text emoji key={slice[0].profile.did} style={textStyle}>
          {slice[0].profile.displayName}
        </Text>{' '}
        and{' '}
        <Text emoji key={slice[1].profile.did} style={textStyle}>
          {slice[1].profile.displayName}
        </Text>
      </Trans>
    )
  }

  return (
    <Trans>
      Followed by <Plural value={serverCount} one="# person" other="# others" />
      , including{' '}
      <Text emoji key={slice[0].profile.did} style={textStyle}>
        {slice[0].profile.displayName}
      </Text>
    </Trans>
  )
}

function EmptyFallback({show}: {show?: boolean}) {
  const t = useTheme()

  if (!show) return null

  return (
    <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
      <Trans>Not followed by anyone you’re following</Trans>
    </Text>
  )
}
