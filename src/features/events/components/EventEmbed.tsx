import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {SHARP_CORNERS} from '#/lib/shapes'
import {toNiceDomain} from '#/lib/strings/url-helpers'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {Earth_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {Link} from '#/components/Link'
import {ExternalEmbed} from '#/components/Post/Embed/ExternalEmbed'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {eventLinkLabel, eventPhase} from '../format'
import {useEventQuery} from '../queries'
import {parseEventRecord} from '../record'
import {eventAtUri, type EventRef, makeEventLink} from '../url'
import {EventMeta} from './EventMeta'
import {Poster} from './Poster'
import {RsvpButtons} from './RsvpButtons'

export function EventEmbed({
  eventRef,
  link,
  onOpen,
  style,
}: {
  eventRef: EventRef
  link: app.bsky.embed.external.ViewExternal
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const openLink = useOpenLink()
  const shapePreference = useEnableSquareButtons()
  const {data: did} = useResolveDidQuery(eventRef.actor)
  const {data: event} = useEventQuery(
    did ? eventAtUri(did, eventRef.rkey) : undefined,
  )
  const parsed = event ? parseEventRecord(event.record) : undefined

  if (!event || !parsed) {
    return <ExternalEmbed link={link} onOpen={onOpen} style={style} />
  }

  const phase = eventPhase(parsed, new Date())
  const sharp = shapePreference === 'sharp' && SHARP_CORNERS
  const showActions = !parsed.cancelled && phase !== 'past'

  return (
    <View
      style={[
        a.rounded_md,
        a.border,
        a.overflow_hidden,
        t.atoms.border_contrast_low,
        sharp,
        style,
      ]}>
      <Link
        to={makeEventLink(event.creator, eventRef.rkey)}
        label={eventLinkLabel(i18n, event, parsed, phase)}
        onPress={onOpen}>
        <View style={[a.flex_row, a.gap_md, a.p_md]}>
          <Poster event={event} parsed={parsed} size={64} style={sharp} />
          <View style={[a.flex_1, a.gap_xs]}>
            {(parsed.cancelled || phase === 'current') && (
              <Text
                style={[
                  a.text_xs,
                  a.font_bold,
                  {
                    color: parsed.cancelled
                      ? t.palette.negative_500
                      : t.palette.primary_500,
                  },
                ]}>
                {parsed.cancelled ? (
                  <Trans>Cancelled</Trans>
                ) : (
                  <Trans>Happening now</Trans>
                )}
              </Text>
            )}
            <Text
              emoji
              numberOfLines={2}
              style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
              {parsed.name}
            </Text>
            <EventMeta event={event} parsed={parsed} />
          </View>
        </View>
      </Link>
      {showActions && (
        <View style={[a.px_md, a.gap_sm, a.pb_md]}>
          <Divider />
          {parsed.joinUrl ? (
            <Button
              label={l`Join online at ${toNiceDomain(parsed.joinUrl)}`}
              size="small"
              color={phase === 'current' ? 'primary' : 'secondary'}
              onPress={() => openLink(parsed.joinUrl!, undefined, true)}>
              <ButtonText>
                <Trans>Join · {toNiceDomain(parsed.joinUrl)}</Trans>
              </ButtonText>
            </Button>
          ) : (
            <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
              <GlobeIcon
                size="xs"
                style={[a.transition_color, t.atoms.text_contrast_low]}
              />
              <Text
                numberOfLines={1}
                style={[a.text_xs, t.atoms.text_contrast_medium]}>
                {toNiceDomain(link.uri)}
              </Text>
            </View>
          )}
          <RsvpButtons event={event} />
        </View>
      )}
    </View>
  )
}
