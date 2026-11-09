import {useEffect, useState} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {SHARP_CORNERS} from '#/lib/shapes'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {useSession} from '#/state/session'
import {formatCount} from '#/view/com/util/numeric/format'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Poll_Stroke2_Corner0_Rounded as PollIcon} from '#/components/icons/Poll'
import {PollBar} from '#/components/Poll/PollBar'
import {ExternalEmbed} from '#/components/Post/Embed/ExternalEmbed'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {useTokimekiPoll} from '../api'
import {useTokimekiVoteMutation} from '../mutations'
import {type TokimekiPoll, type TokimekiPollRef} from '../types'

const POLL_PAGE = 'https://poll.tokimeki.tech/p'

/**
 * Renders a TOKIMEKI poll where a post has one as its link card. Falls back to
 * the ordinary link card when the poll cannot be read, so a dead poll or a
 * plain link to the same host leaves no blank gap.
 */
export function TokimekiPollEmbed({
  ref: pollRef,
  link,
  onOpen,
  style,
}: {
  ref: TokimekiPollRef
  link: app.bsky.embed.external.ViewExternal
  onOpen?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const {data, isLoading, isError} = useTokimekiPoll({
    ref: pollRef,
    enabled: true,
  })
  if (isError || (data === null && !isLoading)) {
    return <ExternalEmbed link={link} onOpen={onOpen} style={style} />
  }
  return <PollBody poll={data} pollRef={pollRef} style={style} />
}

function PollBody({
  poll,
  pollRef,
  style,
}: {
  poll: TokimekiPoll | null | undefined
  pollRef: TokimekiPollRef
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const openLink = useOpenLink()
  const shapePreference = useEnableSquareButtons()
  const {hasSession, currentAccount} = useSession()
  const vote = useTokimekiVoteMutation(poll, currentAccount?.did ?? '')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!poll?.endsAt) return
    const end = new Date(poll.endsAt).getTime()
    if (end <= now) return
    const timer = setTimeout(() => setNow(Date.now()), end - now)
    return () => clearTimeout(timer)
  }, [poll?.endsAt, now])

  if (!poll) {
    return (
      <View style={[cardStyle(t, shapePreference), style]}>
        <CardHeader />
        <Text
          style={[
            a.text_sm,
            a.leading_snug,
            a.mt_sm,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>Loading poll…</Trans>
        </Text>
      </View>
    )
  }

  const pollUrl = `${POLL_PAGE}/${encodeURIComponent(
    pollRef.did,
  )}/${encodeURIComponent(pollRef.rkey)}`
  const total = poll.totalVotes
  const ended = poll.endsAt ? now >= new Date(poll.endsAt).getTime() : false
  const canVoteHere = hasSession && !ended && poll.myVote === undefined

  return (
    <View style={[cardStyle(t, shapePreference), style]}>
      <CardHeader />

      <View style={[a.mt_sm, a.gap_xs]}>
        {poll.options.map((option, i) => {
          const count = poll.counts[i] ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const mine = poll.myVote === i
          return canVoteHere ? (
            <Button
              key={i}
              testID={`tokimekiPollOption_${i}`}
              label={option}
              onPress={() => vote.mutate(i)}
              disabled={vote.isPending}
              size="small"
              color={mine ? 'primary' : 'secondary'}
              style={[a.justify_start]}>
              <ButtonText>{option}</ButtonText>
            </Button>
          ) : (
            <PollBar key={i} label={option} pct={pct} mine={mine} />
          )
        })}
      </View>

      {vote.isError ? (
        <Text style={[a.text_xs, a.mt_xs, {color: t.palette.negative_500}]}>
          {vote.error.message}
        </Text>
      ) : null}

      <View
        style={[
          a.mt_md,
          a.pt_sm,
          a.flex_row,
          a.flex_wrap,
          a.justify_between,
          a.align_center,
          a.gap_md,
          a.border_t,
          t.atoms.border_contrast_low,
        ]}>
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {total === 1 ? (
            <Trans>Poll · 1 vote</Trans>
          ) : (
            <Trans>Poll · {formatCount(i18n, total)} votes</Trans>
          )}
          {ended ? (
            <>
              {' '}
              <Trans>· Ended</Trans>
            </>
          ) : null}
        </Text>
        <Button
          testID="tokimekiPollOpenBtn"
          label={l`Open poll`}
          accessibilityHint={l`Opens the poll on TOKIMEKI`}
          onPress={() => openLink(pollUrl)}
          size="tiny"
          color="primary_subtle">
          <ButtonText>
            <Trans>Open poll</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}

function cardStyle(
  t: ReturnType<typeof useTheme>,
  shapePreference: ReturnType<typeof useEnableSquareButtons>,
) {
  return [
    a.mt_sm,
    a.p_md,
    a.rounded_md,
    a.border,
    a.overflow_hidden,
    t.atoms.bg_contrast_25,
    t.atoms.border_contrast_low,
    shapePreference === 'sharp' && SHARP_CORNERS,
  ]
}

function CardHeader() {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
      <PollIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
      <Text
        style={[
          a.text_xs,
          a.font_medium,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        <Trans comment="Label on a poll shared from TOKIMEKI">TOKIMEKI</Trans>
      </Text>
    </View>
  )
}
