import {useEffect} from 'react'
import {AtUri} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {logger} from '#/logger'
import {useHideBluemojiReactions} from '#/state/preferences/hide-bluemoji-reactions'
import {useAppviewClient, useSession} from '#/state/session'
import * as Toast from '#/components/Toast'
import {fetchBluemojiItem} from '#/features/bluemoji/queries'
import {readReaction} from '#/features/bluemoji/reactions/constellation'
import {
  getReactionEmojiAlt,
  REACTION_COLLECTION,
  type ReactionEmoji,
} from '#/features/bluemoji/reactions/util'
import {app} from '#/lexicons'
import {navigate} from '#/Navigation'

const SPACEDUST_HOST = 'wss://spacedust.microcosm.blue'
const RECONNECT_DELAY = 5000

/** A link event, as spacedust frames it. */
type LinkEvent = {
  kind: 'link'
  link: {
    operation: string
    /** `collection:path`, e.g. `blue.moji.feed.reaction:subject`. */
    source: string
    /** at-uri of the record that made the link, i.e. the reaction. */
    source_record: string
    /** The at-uri being linked to, i.e. the reacted-to post. */
    subject: string
  }
}

export function parseLinkEvent(value: unknown): LinkEvent | undefined {
  const event = value as Partial<LinkEvent>
  if (event?.kind !== 'link' || !event.link) return undefined
  const {source_record, subject} = event.link
  return typeof source_record === 'string' && typeof subject === 'string'
    ? (event as LinkEvent)
    : undefined
}

function ReactionToast({
  emoji,
  subject,
  handle,
}: {
  emoji: ReactionEmoji
  subject: string
  handle?: string
}) {
  const {t: l} = useLingui()
  const author = new AtUri(subject)
  return (
    <Toast.Outer>
      <Toast.Text>
        {handle ? (
          <Trans>
            @{handle} reacted with {getReactionEmojiAlt(emoji)}
          </Trans>
        ) : (
          <Trans>Someone reacted with {getReactionEmojiAlt(emoji)}</Trans>
        )}
      </Toast.Text>
      <Toast.Action
        label={l`View post`}
        onPress={() =>
          navigate('PostThread', {name: author.host, rkey: author.rkey})
        }>
        <Trans>View</Trans>
      </Toast.Action>
    </Toast.Outer>
  )
}

/**
 * Live reaction notifications.
 *
 * spacedust is a links firehose with no history, so this only reports reactions
 * that land while the app is open. The filter is applied server-side: links
 * whose subject is one of our own DIDs, from the reaction collection. Each
 * claim is then read back from the reactor's PDS and the emoji verified, so a
 * notification can only ever describe a reaction that really exists.
 */
export function useReactionNotifications() {
  const {currentAccount} = useSession()
  const appview = useAppviewClient()
  const queryClient = useQueryClient()
  // Hiding reactions also means not opening a socket to notice them.
  const hidden = useHideBluemojiReactions()
  const did = currentAccount?.did

  useEffect(() => {
    if (!did || hidden) return

    let socket: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let closed = false

    const notify = async (event: LinkEvent) => {
      const reactionUri = new AtUri(event.link.source_record)
      const reactor = reactionUri.host
      if (!reactor.startsWith('did:') || reactor === did) return

      const reaction = await readReaction(reactor, reactionUri.rkey)
      if (!reaction || closed) return
      // Reactors' emoji refs are self-attested until the owner's PDS agrees.
      if (!(await fetchBluemojiItem(reaction.emoji.uri))) return

      const handle = await appview
        .call(app.bsky.actor.getProfile, {actor: reactor})
        .then(res => res.handle)
        .catch(() => undefined)
      if (closed) return

      const subject = event.link.subject
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-reaction-counts', {uri: subject}],
      })
      void queryClient.invalidateQueries({
        queryKey: ['bluemoji-reactions', {uri: subject}],
      })
      Toast.show(
        <ReactionToast
          emoji={reaction.emoji}
          subject={subject}
          handle={handle}
        />,
      )
    }

    const connect = () => {
      const url = new URL(`${SPACEDUST_HOST}/subscribe`)
      url.searchParams.set('instant', 'true')
      url.searchParams.set('wantedSources', `${REACTION_COLLECTION}:subject`)
      url.searchParams.set('wantedSubjectDids', did)
      const ws = new WebSocket(url.toString())
      socket = ws

      ws.onmessage = evt => {
        try {
          const event = parseLinkEvent(JSON.parse(String(evt.data)))
          if (event) void notify(event)
        } catch (error) {
          logger.debug('spacedust: unreadable message', {safeMessage: error})
        }
      }
      // A drop just means links missed: this firehose has no replay window, so
      // there is nothing to catch up on when the socket comes back.
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, RECONNECT_DELAY)
      }
    }

    connect()

    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      socket?.close()
    }
  }, [did, hidden, appview, queryClient])
}
