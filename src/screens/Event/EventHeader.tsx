import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {toNiceDomain} from '#/lib/strings/url-helpers'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {AvatarStack} from '#/components/AvatarStack'
import {Button, ButtonText} from '#/components/Button'
import {Globe_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {Pin_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/Pin'
import {InlineLinkText} from '#/components/Link'
import * as ProfileCard from '#/components/ProfileCard'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {Poster} from '#/features/events/components/Poster'
import {RsvpButtons} from '#/features/events/components/RsvpButtons'
import {
  eventDateParts,
  eventPhase,
  formatEventTime,
} from '#/features/events/format'
import {type ParsedEvent} from '#/features/events/record'
import {
  type EventView,
  RSVP_GOING,
  RSVP_INTERESTED,
  type RsvpView,
} from '#/features/events/types'
import {type app} from '#/lexicons'

export function EventHeader({
  event,
  parsed,
  going,
  interested,
}: {
  event: EventView
  parsed: ParsedEvent
  going: app.bsky.actor.defs.ProfileViewBasic[]
  interested: app.bsky.actor.defs.ProfileViewBasic[]
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const openLink = useOpenLink()
  const date = eventDateParts(i18n, parsed)
  const localTime = formatEventTime(i18n, parsed)?.local
  const past = eventPhase(parsed, new Date()) === 'past'
  const otherLinks = parsed.links.filter(
    link => link.uri !== parsed.joinUrl && link.uri !== parsed.streamplaceUrl,
  )
  const place =
    parsed.location ??
    (parsed.streamplaceUrl || parsed.mode === 'virtual' ? l`Online` : undefined)

  return (
    <View style={[a.pb_xl]}>
      <View style={[a.align_center, a.px_lg, a.pt_lg, a.gap_lg]}>
        {parsed.cancelled && (
          <View
            style={[
              a.rounded_full,
              a.px_md,
              a.py_xs,
              {backgroundColor: t.palette.negative_500},
            ]}>
            <Text style={[a.text_sm, a.font_bold, {color: t.palette.white}]}>
              <Trans>Cancelled</Trans>
            </Text>
          </View>
        )}
        <Poster event={event} parsed={parsed} size={240} />
        <Text
          emoji
          style={[a.text_3xl, a.font_bold, a.text_center, a.leading_tight]}>
          {parsed.name}
        </Text>
        {date && (
          <View style={[a.align_center, a.gap_2xs]}>
            <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
              {date.longDate}
            </Text>
            <Text
              style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
              {date.timeRange}
            </Text>
            {localTime && (
              <Text
                style={[a.text_sm, a.text_center, t.atoms.text_contrast_low]}>
                <Trans>{localTime} your time</Trans>
              </Text>
            )}
          </View>
        )}
        {place && (
          <View style={[a.flex_row, a.align_center, a.gap_xs]}>
            {parsed.location ? (
              <PinIcon size="sm" style={[t.atoms.text_contrast_medium]} />
            ) : (
              <GlobeIcon size="sm" style={[t.atoms.text_contrast_medium]} />
            )}
            <Text emoji style={[a.text_md, t.atoms.text_contrast_medium]}>
              {place}
            </Text>
          </View>
        )}
        {parsed.joinUrl && !parsed.cancelled && !past && (
          <Button
            label={l`Join online at ${toNiceDomain(parsed.joinUrl)}`}
            size="large"
            color="primary"
            onPress={() => openLink(parsed.joinUrl!, undefined, true)}>
            <ButtonText>
              <Trans>Join · {toNiceDomain(parsed.joinUrl)}</Trans>
            </ButtonText>
          </Button>
        )}
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <UserAvatar avatar={event.creator.avatar} size={28} type="user" />
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            <Trans>
              Hosted by{' '}
              <InlineLinkText
                label={l`View host's profile`}
                to={`/profile/${event.creator.handle || event.creator.did}`}
                style={[a.text_md, a.font_semi_bold]}>
                {event.creator.displayName || `@${event.creator.handle}`}
              </InlineLinkText>
            </Trans>
          </Text>
        </View>
        {!parsed.cancelled && !past && (
          <View style={[a.w_full, {maxWidth: 420}]}>
            <RsvpButtons event={event} size="large" fill />
          </View>
        )}
        <GuestCounts event={event} going={going} interested={interested} />
      </View>
      {parsed.description && (
        <View
          style={[
            a.mx_lg,
            a.mt_xl,
            a.p_lg,
            a.rounded_lg,
            a.gap_sm,
            t.atoms.bg_contrast_25,
          ]}>
          <Text style={[a.text_md, a.font_bold]}>
            <Trans>About</Trans>
          </Text>
          <RichText
            value={parsed.description}
            style={[a.text_md, a.leading_snug]}
          />
        </View>
      )}
      {otherLinks.length > 0 && (
        <View
          style={[
            a.mx_lg,
            a.mt_md,
            a.p_lg,
            a.rounded_lg,
            a.gap_sm,
            t.atoms.bg_contrast_25,
          ]}>
          <Text style={[a.text_md, a.font_bold]}>
            <Trans>Links</Trans>
          </Text>
          {otherLinks.map(link => (
            <InlineLinkText
              key={link.uri}
              label={link.name || link.uri}
              to={link.uri}
              style={[a.text_md]}>
              {link.name || toNiceDomain(link.uri)}
            </InlineLinkText>
          ))}
        </View>
      )}
    </View>
  )
}

/** The counts, each with the avatars of only that status beside it. */
function GuestCounts({
  event,
  going,
  interested,
}: {
  event: EventView
  going: app.bsky.actor.defs.ProfileViewBasic[]
  interested: app.bsky.actor.defs.ProfileViewBasic[]
}) {
  if (event.goingCount + event.interestedCount === 0) return null
  return (
    <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_xl]}>
      <CountRow
        label={plural(event.goingCount, {one: '# going', other: '# going'})}
        avatars={going}
      />
      {event.interestedCount > 0 && (
        <CountRow
          label={plural(event.interestedCount, {
            one: '# interested',
            other: '# interested',
          })}
          avatars={interested}
        />
      )}
    </View>
  )
}

function CountRow({
  label,
  avatars,
}: {
  label: string
  avatars: app.bsky.actor.defs.ProfileViewBasic[]
}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {avatars.length > 0 && <AvatarStack profiles={avatars} size={28} />}
      <Text style={[a.text_md, a.font_semi_bold, t.atoms.text_contrast_high]}>
        {label}
      </Text>
    </View>
  )
}

export function GuestRow({
  rsvp,
  noBorder,
}: {
  rsvp: RsvpView
  noBorder?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  if (!moderationOpts) return null
  const label =
    rsvp.status === RSVP_GOING
      ? l`Going`
      : rsvp.status === RSVP_INTERESTED
        ? l`Interested`
        : l`Not going`

  return (
    <View
      style={[
        a.py_md,
        a.px_xl,
        !noBorder && [a.border_t, t.atoms.border_contrast_low],
      ]}>
      <ProfileCard.Link profile={rsvp.actor} accessibilityHint={label}>
        <ProfileCard.Outer>
          <ProfileCard.Header>
            <ProfileCard.Avatar
              profile={rsvp.actor}
              moderationOpts={moderationOpts}
            />
            <ProfileCard.NameAndHandle
              profile={rsvp.actor}
              moderationOpts={moderationOpts}
            />
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.gap_sm,
                a.rounded_full,
                a.px_md,
                a.py_xs,
                rsvp.status === RSVP_GOING
                  ? {backgroundColor: t.palette.primary_100}
                  : t.atoms.bg_contrast_50,
              ]}>
              <Text style={[a.text_sm, a.font_semi_bold]}>{label}</Text>
            </View>
          </ProfileCard.Header>
        </ProfileCard.Outer>
      </ProfileCard.Link>
    </View>
  )
}
