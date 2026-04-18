import {memo, useCallback} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {type AppBskyActorDefs, type ModerationDecision} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {useQueryClient} from '@tanstack/react-query'

import {makeProfileLink} from '#/lib/routes/links'
import {forceLTR} from '#/lib/strings/bidi'
import {NON_BREAKING_SPACE} from '#/lib/strings/constants'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {sanitizePronouns} from '#/lib/strings/pronouns'
import {niceDate} from '#/lib/strings/time'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {unstableCacheProfileView} from '#/state/queries/profile'
import {atoms as a, platform, useTheme, web} from '#/alf'
import {WebOnlyInlineLinkText} from '#/components/Link'
import {ProfileBadges} from '#/components/ProfileBadges'
import {ProfileHoverCard} from '#/components/ProfileHoverCard'
import {Text} from '#/components/Typography'
import {IS_ANDROID} from '#/env'
import {useActorStatus} from '#/features/liveNow'
import {TimeElapsed} from './TimeElapsed'
import {PreviewableUserAvatar} from './UserAvatar'

interface PostMetaOpts {
  author: AppBskyActorDefs.ProfileViewBasic
  moderation: ModerationDecision | undefined
  postHref: string
  timestamp: string
  linkDisabled?: boolean
  showAvatar?: boolean
  showPronouns?: boolean
  avatarSize?: number
  onOpenAuthor?: () => void
  style?: StyleProp<ViewStyle>
}

let PostMeta = (opts: PostMetaOpts): React.ReactNode => {
  const t = useTheme()
  const {i18n, _} = useLingui()

  const author = useProfileShadow(opts.author)
  const displayName = author.displayName || author.handle
  const handle = author.handle
  // remove dumb typing when you update the atproto api package!!
  const pronouns = (author as {pronouns?: string})?.pronouns
  const profileLink = makeProfileLink(author)
  const queryClient = useQueryClient()
  const onOpenAuthor = opts.onOpenAuthor
  const onBeforePressAuthor = useCallback(() => {
    unstableCacheProfileView(queryClient, author)
    onOpenAuthor?.()
  }, [queryClient, author, onOpenAuthor])
  const onBeforePressPost = useCallback(() => {
    unstableCacheProfileView(queryClient, author)
  }, [queryClient, author])

  const timestampLabel = niceDate(i18n, opts.timestamp)
  const {isActive: live} = useActorStatus(author)

  const MaybeLinkText = opts.linkDisabled ? Text : WebOnlyInlineLinkText

  return (
    <View
      style={[
        IS_ANDROID ? a.flex_1 : a.flex_shrink,
        a.flex_row,
        a.align_center,
        a.pb_xs,
        a.gap_xs,
        a.z_20,
        opts.style,
      ]}>
      {opts.showAvatar && (
        <View style={[a.self_center, a.mr_2xs]}>
          <PreviewableUserAvatar
            size={opts.avatarSize || 16}
            profile={author}
            moderation={opts.moderation?.ui('avatar')}
            type={author.associated?.labeler ? 'labeler' : 'user'}
            live={live}
            hideLiveBadge
            disableNavigation={opts.linkDisabled}
          />
        </View>
      )}
      <View style={[a.flex_row, a.align_end, a.flex_shrink]}>
        <ProfileHoverCard did={author.did}>
          <View style={[a.flex_row, a.align_end, a.flex_shrink]}>
            <MaybeLinkText
              emoji
              numberOfLines={1}
              to={profileLink}
              label={_(msg`View profile`)}
              disableMismatchWarning
              onPress={opts.linkDisabled ? undefined : onBeforePressAuthor}
              style={[
                a.text_md,
                a.font_semi_bold,
                t.atoms.text,
                a.leading_tight,
                a.flex_shrink,
              ]}>
              {forceLTR(
                sanitizeDisplayName(
                  displayName,
                  opts.moderation?.ui('displayName'),
                ),
              )}
            </MaybeLinkText>
            <ProfileBadges
              profile={author}
              size="sm"
              pdsInteractive={false}
              style={[
                a.pl_2xs,
                a.self_center,
                {
                  marginTop: platform({web: 1, ios: 0, android: -1}),
                },
              ]}
            />
            <MaybeLinkText
              emoji
              numberOfLines={1}
              to={profileLink}
              label={_(msg`View profile`)}
              disableMismatchWarning
              disableUnderline
              onPress={opts.linkDisabled ? undefined : onBeforePressAuthor}
              style={[
                a.text_md,
                t.atoms.text_contrast_medium,
                {lineHeight: 1.17},
                {flexBasis: '30%'},
                a.flex_grow,
                a.flex_shrink_0,
                web({maxWidth: 'max-content'}),
              ]}>
              {NON_BREAKING_SPACE + sanitizeHandle(handle, '@')}
            </MaybeLinkText>
            {opts.showPronouns && pronouns && (
              <WebOnlyInlineLinkText
                emoji
                numberOfLines={1}
                to={profileLink}
                label={_(msg`View Profile`)}
                disableMismatchWarning
                disableUnderline
                onPress={onBeforePressAuthor}
                style={[
                  t.atoms.text_contrast_low,
                  a.pl_2xs,
                  a.text_md,
                  {lineHeight: 1.17},
                  {flexShrink: 5},
                ]}>
                {NON_BREAKING_SPACE + sanitizePronouns(pronouns)}
              </WebOnlyInlineLinkText>
            )}
          </View>
        </ProfileHoverCard>

        <TimeElapsed timestamp={opts.timestamp}>
          {({timeElapsed}) => (
            <MaybeLinkText
              to={opts.postHref}
              label={timestampLabel}
              title={timestampLabel}
              disableMismatchWarning
              disableUnderline
              onPress={opts.linkDisabled ? undefined : onBeforePressPost}
              style={[
                a.pl_xs,
                a.text_md,
                a.leading_tight,
                IS_ANDROID && a.flex_grow,
                a.text_right,
                t.atoms.text_contrast_medium,
                web({
                  whiteSpace: 'nowrap',
                }),
              ]}>
              {!opts.showPronouns && (
                <>
                  {!IS_ANDROID && (
                    <Text
                      style={[
                        a.text_md,
                        a.leading_tight,
                        t.atoms.text_contrast_medium,
                      ]}
                      accessible={false}>
                      &middot;{' '}
                    </Text>
                  )}
                  {timeElapsed}
                </>
              )}
            </MaybeLinkText>
          )}
        </TimeElapsed>
      </View>
    </View>
  )
}
PostMeta = memo(PostMeta)
export {PostMeta}
