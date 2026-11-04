import {useCallback, useEffect, useRef, useState} from 'react'
import {Image, View} from 'react-native'
import {RichText} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'

import {assemblyReportUrl, assemblyUrl} from '#/lib/api/assembly'
import {pollTopicFromText, type PollVoteValue} from '#/lib/api/poll'
import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {SHARP_CORNERS} from '#/lib/shapes'
import {type EmbedPlayerParams} from '#/lib/strings/embed-player'
import {expandLinks} from '#/lib/strings/rich-text-manip'
import {useEnableSquareButtons} from '#/state/preferences/enable-square-buttons'
import {usePdsClient, useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Poll_Stroke2_Corner0_Rounded as PollIcon} from '#/components/icons/Poll'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {ASSEMBLY_URL} from '#/env'
import {com} from '#/lexicons'
import {type app} from '#/lexicons'
import {VoteButtons} from './VoteButtons'

const ASSEMBLY_API = `${ASSEMBLY_URL.replace(/\/+$/, '')}/api/v3`

const VOTE_NUMBERS: Record<PollVoteValue, -1 | 0 | 1> = {
  agree: -1,
  disagree: 1,
  pass: 0,
}

interface Statement {
  tid: number
  txt: string
  remaining?: number
  is_seed?: boolean
  author_name?: string
  author_avatar?: string
  author_is_blacksky_member?: boolean
  author_is_funder?: boolean
  author_is_team?: boolean
  author_is_oss_supporter?: boolean
  at_uri?: string
  at_cid?: string
}

interface ConversationMeta {
  conversation_id: string
  topic: string
  description?: string
  is_active: boolean
  auth_needed_to_vote: boolean
  at_uri?: string
  at_cid?: string
}

interface EmbedConversationResponse {
  conversation: ConversationMeta
  nextComment: Statement | null
  report_id?: string | null
}

interface ParticipationInitResponse {
  auth?: {token: string}
  nextComment?: Statement
}

interface VoteResponse {
  auth?: {token: string}
  nextComment?: Statement
}

function repeatsTopic(
  topic: string,
  text: string | undefined,
  facets: app.bsky.richtext.facet.Main[] | undefined,
): boolean {
  if (!text) return false
  if (pollTopicFromText(text) === topic) return true
  if (!facets?.length) return false
  return (
    pollTopicFromText(expandLinks(new RichText({text, facets})).text) === topic
  )
}

function extractConversationId(uri: string): string {
  try {
    const url = new URL(uri)
    return url.pathname.slice(1)
  } catch {
    return ''
  }
}

export function AssemblyEmbed({
  link,
  postText,
  postFacets,
}: {
  link: app.bsky.embed.external.ViewExternal
  params: EmbedPlayerParams
  postText?: string
  postFacets?: app.bsky.richtext.facet.Main[]
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const pdsClient = usePdsClient()
  const openLink = useOpenLink()
  const shapePreference = useEnableSquareButtons()
  const {currentAccount, hasSession} = useSession()
  const conversationId = extractConversationId(link.uri)
  const hasCompleted = useRef(false)

  const [data, setData] = useState<EmbedConversationResponse | null>(null)
  const [statement, setStatement] = useState<Statement | null>(null)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allVoted, setAllVoted] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [participation, setParticipation] = useState<{
    did: string
    token: string
  } | null>(null)

  const viewerDid = currentAccount?.did
  const isAuthenticated = hasSession
  const participationToken =
    participation && participation.did === viewerDid
      ? participation.token
      : null

  useEffect(() => {
    if (!conversationId) return
    let cancelled = false

    const init = async () => {
      try {
        const convResp = await fetch(
          `${ASSEMBLY_API}/embed/conversation?conversation_id=${conversationId}`,
        )
        if (cancelled) return
        if (!convResp.ok) {
          if (convResp.status === 400 || convResp.status === 404) {
            setNotFound(true)
          }
          return
        }
        const convData = (await convResp.json()) as EmbedConversationResponse
        if (cancelled) return
        setData(convData)
        setStatement(convData.nextComment)
        setAllVoted(!convData.nextComment)
        if (!convData.conversation.is_active) return
      } catch {
        if (!cancelled) setError('Failed to load conversation')
        return
      }

      if (hasSession && viewerDid) {
        try {
          const xidParams = new URLSearchParams({
            conversation_id: conversationId,
            includePCA: 'false',
            xid: viewerDid,
          })

          const initResp = await fetch(
            `${ASSEMBLY_API}/participationInit?${xidParams.toString()}`,
          )

          if (initResp.ok) {
            const initData =
              (await initResp.json()) as ParticipationInitResponse
            if (cancelled) return

            if (initData.auth?.token) {
              setParticipation({did: viewerDid, token: initData.auth.token})
            }

            if (initData.nextComment) {
              setStatement(initData.nextComment)
            } else {
              setStatement(null)
              setAllVoted(true)
            }
          }
        } catch {}
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [conversationId, hasSession, viewerDid])

  const handleVote = useCallback(
    async (value: PollVoteValue) => {
      if (!statement || voting) return
      setVoting(true)
      setError(null)

      try {
        const vote = VOTE_NUMBERS[value]
        let voteAtUri: string | undefined

        /*
         * The signed record is the proof of identity: the assembly fetches it
         * from the account's PDS and checks it before counting the vote. An
         * OAuth session has no `agent.session`, so this must go through the
         * pds client rather than the legacy agent.
         */
        if (hasSession && statement.at_uri && statement.at_cid) {
          const createResult = await pdsClient.call(
            com.atproto.repo.createRecord,
            {
              repo: pdsClient.assertDid,
              collection: 'community.blacksky.assembly.vote',
              record: {
                $type: 'community.blacksky.assembly.vote',
                subject: {
                  uri: statement.at_uri,
                  cid: statement.at_cid,
                },
                value: vote,
                createdAt: new Date().toISOString(),
              },
            },
          )
          voteAtUri = createResult.uri
        }

        const voteHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (participationToken) {
          voteHeaders.Authorization = `Bearer ${participationToken}`
        }
        const voteResp = await fetch(`${ASSEMBLY_API}/embed/vote`, {
          method: 'POST',
          headers: voteHeaders,
          body: JSON.stringify({
            conversation_id: conversationId,
            tid: statement.tid,
            vote,
            ...(voteAtUri ? {vote_at_uri: voteAtUri} : {}),
          }),
        })

        if (!voteResp.ok) {
          const errBody = await voteResp.text()
          if (errBody.includes('polis_err_post_votes_social_needed')) {
            setError('Sign in required to vote.')
          } else {
            throw new Error('Vote submission failed')
          }
          return
        }

        const voteResult = (await voteResp.json()) as VoteResponse

        ax.metric('assembly:vote', {
          conversationId,
          tid: statement.tid,
          value,
          remaining: voteResult.nextComment?.remaining ?? 0,
        })

        if (voteResult.nextComment) {
          setStatement(voteResult.nextComment)
        } else {
          setAllVoted(true)
          setStatement(null)
          if (!hasCompleted.current) {
            hasCompleted.current = true
            ax.metric('assembly:complete', {conversationId})
          }
        }
      } catch {
        setError('Vote failed. Please try again.')
      } finally {
        setVoting(false)
      }
    },
    [
      hasSession,
      pdsClient,
      ax,
      statement,
      conversationId,
      voting,
      participationToken,
    ],
  )

  const onVote = useCallback(
    (value: PollVoteValue) => {
      void handleVote(value)
    },
    [handleVote],
  )

  const openAssembly = useCallback(() => {
    openLink(assemblyUrl(conversationId))
  }, [openLink, conversationId])

  const reportId = data?.report_id
  const openResults = useCallback(() => {
    if (reportId) openLink(assemblyReportUrl(reportId))
  }, [openLink, reportId])

  const cardStyle = [
    a.mt_sm,
    a.p_md,
    a.rounded_md,
    a.border,
    a.overflow_hidden,
    t.atoms.bg_contrast_25,
    t.atoms.border_contrast_low,
    shapePreference === 'sharp' && SHARP_CORNERS,
  ]

  if (notFound) {
    return (
      <View style={cardStyle}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>This conversation is no longer available.</Trans>
        </Text>
      </View>
    )
  }

  if (error && !data) {
    return (
      <View style={cardStyle}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {error}
        </Text>
      </View>
    )
  }

  if (!data) {
    return (
      <View style={[cardStyle, a.gap_sm]}>
        <AssemblyLabel />
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Loading...</Trans>
        </Text>
      </View>
    )
  }

  const topic = repeatsTopic(data.conversation.topic, postText, postFacets)
    ? undefined
    : data.conversation.topic
  const footer = (
    <AssemblyFooter
      onPress={openAssembly}
      onPressResults={reportId ? openResults : undefined}
    />
  )

  if (!data.conversation.is_active) {
    return (
      <View style={cardStyle}>
        <AssemblyHeader
          topic={topic}
          description={data.conversation.description}
        />
        <Text
          style={[
            a.text_sm,
            a.leading_snug,
            a.mt_sm,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>This conversation is closed.</Trans>
        </Text>
        {footer}
      </View>
    )
  }

  if (data.conversation.auth_needed_to_vote && !isAuthenticated) {
    return (
      <View style={cardStyle}>
        <AssemblyHeader
          topic={topic}
          description={data.conversation.description}
        />
        <Button
          testID="assemblySignInBtn"
          label={l`Sign in to vote`}
          accessibilityHint={l`Opens the assembly page to sign in and vote`}
          onPress={openAssembly}
          size="small"
          color="primary"
          style={[a.mt_md]}>
          <ButtonText>
            <Trans>Sign in to vote</Trans>
          </ButtonText>
        </Button>
        {footer}
      </View>
    )
  }

  return (
    <View style={cardStyle}>
      <AssemblyHeader
        topic={topic}
        description={data.conversation.description}
      />

      {allVoted ? (
        <Text
          style={[
            a.text_sm,
            a.leading_snug,
            a.mt_sm,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>You've voted on all statements.</Trans>
        </Text>
      ) : statement ? (
        <>
          <View style={[a.mt_sm, a.gap_xs]}>
            <View
              style={[
                a.p_md,
                a.rounded_md,
                a.border,
                t.atoms.bg,
                t.atoms.border_contrast_low,
              ]}>
              {!statement.is_seed && (
                <View style={[a.flex_row, a.align_center, a.gap_xs, a.mb_xs]}>
                  {statement.author_avatar ? (
                    <Image
                      source={{uri: statement.author_avatar}}
                      style={[
                        {width: 20, height: 20, borderRadius: 10},
                        t.atoms.bg_contrast_50,
                      ]}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View
                      style={[
                        {width: 20, height: 20, borderRadius: 10},
                        t.atoms.bg_contrast_50,
                      ]}
                    />
                  )}
                  <View style={[a.flex_1, a.gap_2xs]}>
                    <Text
                      style={[
                        a.text_xs,
                        a.leading_snug,
                        t.atoms.text_contrast_medium,
                      ]}>
                      <Trans>
                        {statement.author_name || 'Anonymous'} wrote:
                      </Trans>
                    </Text>
                    <AuthorBadges statement={statement} />
                  </View>
                </View>
              )}
              <Text emoji style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
                {statement.txt}
              </Text>
              {statement.remaining != null && statement.remaining > 0 && (
                <Text
                  style={[
                    a.text_xs,
                    a.mt_xs,
                    a.text_right,
                    t.atoms.text_contrast_low,
                  ]}>
                  <Trans>
                    {statement.remaining > 100 ? '100+' : statement.remaining}{' '}
                    remaining
                  </Trans>
                </Text>
              )}
            </View>
          </View>

          <View style={[a.mt_sm]}>
            <VoteButtons
              pending={voting}
              disabled={voting}
              passLabel={l`Pass / Unsure`}
              onVote={onVote}
            />
          </View>

          {error ? (
            <Text style={[a.text_xs, a.mt_xs, {color: t.palette.negative_500}]}>
              {error}
            </Text>
          ) : null}
        </>
      ) : null}

      {footer}
    </View>
  )
}

function AuthorBadges({statement}: {statement: Statement}) {
  const t = useTheme()
  const badges = [
    statement.author_is_team && {
      label: 'Admin',
      color: t.atoms.text_contrast_high.color,
      background: t.palette.primary_100,
    },
    statement.author_is_blacksky_member && {
      label: 'Member',
      color: t.atoms.text_contrast_high.color,
      background: t.palette.primary_100,
    },
    statement.author_is_funder && {
      label: 'Funder',
      color: t.atoms.text_contrast_high.color,
      background: t.palette.primary_100,
    },
    statement.author_is_oss_supporter && {
      label: 'OSS',
      color: t.atoms.text_contrast_high.color,
      background: t.palette.primary_100,
    },
  ].filter(Boolean) as {label: string; color: string; background: string}[]

  if (!badges.length) return null

  return (
    <View style={[a.flex_row, a.gap_2xs]}>
      {badges.map(badge => (
        <Text
          key={badge.label}
          style={[
            a.text_2xs,
            a.font_medium,
            a.rounded_xs,
            a.px_2xs,
            a.py_2xs,
            {color: badge.color, backgroundColor: badge.background},
          ]}>
          {badge.label}
        </Text>
      ))}
    </View>
  )
}

function AssemblyLabel() {
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
        <Trans comment="Name of the People's Assembly poll shown in a post">
          People's Assembly
        </Trans>
      </Text>
    </View>
  )
}

function AssemblyHeader({
  topic,
  description,
}: {
  topic?: string
  description?: string
}) {
  const t = useTheme()
  return (
    <View style={[a.gap_2xs]}>
      <AssemblyLabel />
      {topic ? (
        <Text
          emoji
          style={[a.text_md, a.font_semi_bold, a.leading_snug, a.mt_2xs]}
          numberOfLines={2}>
          {topic}
        </Text>
      ) : null}
      {description ? (
        <Text
          emoji
          style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}
          numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </View>
  )
}

function AssemblyFooter({
  onPress,
  onPressResults,
}: {
  onPress: () => void
  onPressResults?: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  return (
    <View
      style={[
        a.mt_md,
        a.pt_sm,
        a.flex_row,
        a.flex_wrap,
        a.justify_end,
        a.gap_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      {onPressResults ? (
        <Button
          testID="assemblyResultsBtn"
          label={l`See results`}
          accessibilityHint={l`Opens the assembly results page`}
          onPress={onPressResults}
          size="tiny"
          color="primary_subtle">
          <ButtonText>
            <Trans>See results</Trans>
          </ButtonText>
        </Button>
      ) : null}
      <Button
        testID="assemblyOpenBtn"
        label={l`Submit a statement`}
        accessibilityHint={l`Opens the assembly conversation page`}
        onPress={onPress}
        size="tiny"
        color="primary_subtle">
        <ButtonText>
          <Trans>Submit a statement →</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
