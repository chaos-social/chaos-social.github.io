import {useEffect, useState} from 'react'
import {View} from 'react-native'
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
import {Text} from '#/components/Typography'
import {usePollBluePoll, usePollBlueVotes} from '../api'
import {usePollBlueVoteMutation} from '../mutations'
import {type PollRecord} from '../types'

/**
 * Renders the poll.blue card for a post body. Returns null unless the post's
 * own facets mark it as a poll, so ordinary posts are untouched.
 */
export function PollBlueCard({
  uri,
  record,
}: {
  uri: string
  record: {text?: string; facets?: unknown}
}) {
  const {data, isLoading} = usePollBluePoll({uri, record})
  if (!data && !isLoading) return null
  return <PollBody poll={data} />
}

function PollBody({poll}: {poll: PollRecord | null | undefined}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {i18n} = useLingui()
  const openLink = useOpenLink()
  const shapePreference = useEnableSquareButtons()
  const {hasSession} = useSession()
  const {data: votes} = usePollBlueVotes(poll)
  const vote = usePollBlueVoteMutation(poll)
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
      <View style={cardStyle(t, shapePreference)}>
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

  /*
   * A public poll counts votes from Constellation and can be voted on here.
   * A centralized poll carries its tallies from the poll.blue API but has no
   * option URIs, so voting has to happen on poll.blue itself.
   */
  const isPublic = poll.mode === 'public'
  const counts = isPublic
    ? (votes?.counts ?? poll.options.map(() => 0))
    : (poll.results?.slice(1) ?? poll.options.map(() => 0))
  const total = counts.reduce((sum, n) => sum + n, 0)
  const viewerIndex = votes?.viewerIndex
  const ended = poll.endsAt ? now >= new Date(poll.endsAt).getTime() : false
  const canVoteHere = isPublic && hasSession && !!poll.options[0]?.uri && !ended

  const pollUrl = poll.visibleId
    ? `https://poll.blue/p/${poll.visibleId}`
    : `https://poll.blue/p/${poll.uri.split('/').pop()}`

  // Bars once the viewer has voted, or when they cannot vote here at all.
  const showBars = !canVoteHere || !!viewerIndex

  const onOption = (index: number) => {
    if (canVoteHere && !viewerIndex) vote.mutate(index)
    else openLink(`${pollUrl}/${index}`)
  }

  return (
    <View style={cardStyle(t, shapePreference)}>
      <CardHeader />

      <Text
        emoji
        style={[a.text_md, a.font_semi_bold, a.leading_snug, a.mt_sm]}>
        {poll.question}
      </Text>

      <View style={[a.mt_sm, a.gap_xs]}>
        {poll.options.map((option, i) => {
          const index = i + 1
          const count = counts[i] ?? 0
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const mine = viewerIndex === index
          return showBars ? (
            <PollBar key={index} label={option.text} pct={pct} mine={mine} />
          ) : (
            <Button
              key={index}
              testID={`pollBlueOption_${index}`}
              label={option.text}
              onPress={() => onOption(index)}
              disabled={vote.isPending}
              size="small"
              color={mine ? 'primary' : 'secondary'}
              style={[a.justify_start]}>
              <ButtonText>{option.text}</ButtonText>
            </Button>
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
          {total > 0 ? (
            <Trans>Poll · {formatCount(i18n, total)} votes</Trans>
          ) : (
            <Trans>Poll</Trans>
          )}
          {ended ? (
            <>
              {' '}
              <Trans>· Ended</Trans>
            </>
          ) : null}
        </Text>
        <View style={[a.flex_row, a.gap_md]}>
          {!canVoteHere && !ended ? (
            <Button
              testID="pollBlueVoteOutBtn"
              label={l`Vote on poll.blue`}
              accessibilityHint={l`Opens the poll in your browser to vote`}
              onPress={() => openLink(pollUrl)}
              size="tiny"
              color="primary_subtle">
              <ButtonText>
                <Trans>Vote on poll.blue →</Trans>
              </ButtonText>
            </Button>
          ) : null}
          <Button
            testID="pollBlueOpenBtn"
            label={l`Open poll`}
            accessibilityHint={l`Opens the poll.blue page`}
            onPress={() => openLink(pollUrl)}
            size="tiny"
            color="primary_subtle">
            <ButtonText>
              <Trans>Open poll</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
    </View>
  )
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
        <Trans comment="Label on a poll shared from poll.blue">poll.blue</Trans>
      </Text>
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
