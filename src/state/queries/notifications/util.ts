import {TID} from '@atproto/common-web'
import {type Client} from '@atproto/lex'
import {type AtUriString} from '@atproto/syntax'
import {
  hasMutedWord,
  moderateNotification,
  type ModerationOpts,
} from '@bsky/sdk/moderation'
import {type QueryClient} from '@tanstack/react-query'
import chunk from 'lodash.chunk'

import {labelIsHideableOffense} from '#/lib/moderation'
import * as persisted from '#/state/persisted'
import {isInGroupedFeed} from '#/state/queries/notifications/grouped/membership'
import {type GroupedNotificationsFeed} from '#/state/queries/notifications/grouped/types'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {
  asyncGenCollect,
  asyncGenDedupe,
  asyncGenTake,
  type ConstellationLink,
  constellationLinks,
} from '../constellation'
import {precacheProfile} from '../profile'
import {fetchNotificationPosts} from './fetch-posts'
import {
  type FeedNotification,
  type FeedPage,
  type Notification,
  type NotificationType,
  type UnreadCheck,
} from './types'

const GROUPABLE_REASONS = [
  'like',
  'post-bite',
  'repost',
  'follow',
  'user-bite',
  'like-via-repost',
  'repost-via-repost',
  'bite-via-repost',
  'subscribed-post',
]
const MS_1HR = 1e3 * 60 * 60
const MS_2DAY = MS_1HR * 48

/**
 * Bites pulled from Constellation, newest first. A Constellation link gives
 * us everything a bite notification shows, so the records aren't read.
 */
const BITE_LINKS_LIMIT = 100
/**
 * `app.bsky.actor.getProfiles` takes at most this many actors per call.
 */
const GET_PROFILES_MAX_ACTORS = 25
const BITE_COLLECTION = 'net.wafrn.feed.bite'

// exported api
// =

export async function fetchPage({
  client,
  cursor,
  limit,
  queryClient,
  moderationOpts,
  fetchAdditionalData,
  reasons,
}: {
  client: Client
  cursor: string | undefined
  limit: number
  queryClient: QueryClient
  moderationOpts: ModerationOpts | undefined
  fetchAdditionalData: boolean
  reasons: string[]
}): Promise<{
  page: FeedPage
  indexedAt: string | undefined
}> {
  const data = await client.call(app.bsky.notification.listNotifications, {
    limit,
    cursor,
    reasons,
  })

  const indexedAt = data.notifications[0]?.indexedAt

  // filter out notifs by mod rules
  const notifs = data.notifications.filter(
    notif => !shouldFilterNotif(notif, moderationOpts),
  )

  /*
   * Bites are wafrn records the appview doesn't index, so they're found
   * through Constellation. Only the first page of the unfiltered feed shows
   * them: every page would show the same bites again, and the unread poll
   * doesn't need them, since they're never unread.
   */
  const viewerDid = client.did
  const bites =
    fetchAdditionalData && !cursor && !reasons.length && viewerDid
      ? await fetchBites(client, viewerDid)
      : []
  for (const {author, link} of bites) {
    notifs.unshift({
      uri: `at://${link.did}/${BITE_COLLECTION}/${link.rkey}`,
      // Nothing reads a bite notification's cid, and the link has none.
      cid: '',
      author,
      reason: 'user-bite',
      record: {$type: BITE_COLLECTION},
      isRead: true,
      // A TID's first 11 characters are its creation time in microseconds.
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- toISOString() types as `string`, not the datetime template
      indexedAt: new Date(
        Math.floor(TID.fromStr(link.rkey).timestamp() / 1000),
      ).toISOString() as Notification['indexedAt'],
      labels: [],
    })
  }

  // group notifications which are essentially similar (follows, likes on a post)
  let notifsGrouped = groupNotifications(notifs)

  // we fetch subjects of notifications (usually posts) now instead of lazily
  // in the UI to avoid relayouts
  if (fetchAdditionalData) {
    const subjects = await fetchSubjects(client, notifsGrouped)
    for (const notif of notifsGrouped) {
      if (notif.subjectUri) {
        if (
          notif.type === 'starterpack-joined' &&
          notif.notification.reasonSubject
        ) {
          notif.subject = subjects.starterPacks.get(
            notif.notification.reasonSubject,
          )
        } else {
          notif.subject = subjects.posts.get(notif.subjectUri)
          if (notif.subject) {
            precacheProfile(queryClient, notif.subject.author)
          }
        }
      }
    }
  }

  let seenAt = data.seenAt ? new Date(data.seenAt) : new Date()
  if (Number.isNaN(seenAt.getTime())) {
    seenAt = new Date()
  }

  return {
    page: {
      cursor: data.cursor,
      seenAt,
      items: notifsGrouped,
    },
    indexedAt,
  }
}

/**
 * Summarizes an unread check's page for the grouped notifications feeds; see
 * `UnreadCheck`.
 */
export function summarizeUnreadCheck(
  page: FeedPage,
  requestedAt: number,
): UnreadCheck {
  const newestUnreadAt: UnreadCheck['newestUnreadAt'] = {
    all: undefined,
    'people-i-follow': undefined,
    followers: undefined,
    conversations: undefined,
    activity: undefined,
  }
  const feeds = Object.keys(newestUnreadAt) as GroupedNotificationsFeed[]
  for (const item of page.items) {
    for (const notif of [item.notification, ...(item.additional ?? [])]) {
      if (notif.isRead) continue
      const indexedAt = Date.parse(notif.indexedAt)
      for (const feed of feeds) {
        if (
          indexedAt > (newestUnreadAt[feed] ?? -Infinity) &&
          isInGroupedFeed(feed, notif)
        ) {
          newestUnreadAt[feed] = indexedAt
        }
      }
    }
  }
  return {requestedAt, newestUnreadAt}
}

/**
 * An unread check once everything indexed up to `seenAt` has been marked
 * read, as the next check would find it.
 */
export function markUnreadCheckSeen(
  check: UnreadCheck | undefined,
  seenAt: number,
): UnreadCheck | undefined {
  if (!check) return check
  const newestUnreadAt = {...check.newestUnreadAt}
  for (const feed of Object.keys(
    newestUnreadAt,
  ) as GroupedNotificationsFeed[]) {
    if ((newestUnreadAt[feed] ?? -Infinity) <= seenAt) {
      newestUnreadAt[feed] = undefined
    }
  }
  return {...check, newestUnreadAt}
}

// internal methods
// =

export function shouldFilterNotif(
  notif: Notification,
  moderationOpts: ModerationOpts | undefined,
): boolean {
  const containsImperative = !!notif.author.labels?.some(labelIsHideableOffense)
  if (containsImperative) {
    return true
  }
  if (!moderationOpts) {
    return false
  }
  if (
    notif.reason === 'subscribed-post' &&
    bsky.isType(app.bsky.feed.post, notif.record) &&
    hasMutedWord({
      mutedWords: moderationOpts.prefs.mutedWords,
      text: notif.record.text,
      facets: notif.record.facets,
      outlineTags: notif.record.tags,
      languages: notif.record.langs,
      actor: notif.author,
    })
  ) {
    return true
  }
  if (notif.author.viewer?.following) {
    return false
  }
  return moderateNotification(notif, moderationOpts).ui('contentList').filter
}

export function groupNotifications(notifs: Notification[]): FeedNotification[] {
  const groupedNotifs: FeedNotification[] = []
  for (const notif of notifs) {
    const ts = +new Date(notif.indexedAt)
    let grouped = false
    if (GROUPABLE_REASONS.includes(notif.reason)) {
      for (const groupedNotif of groupedNotifs) {
        const ts2 = +new Date(groupedNotif.notification.indexedAt)
        if (
          Math.abs(ts2 - ts) < MS_2DAY &&
          notif.reason === groupedNotif.notification.reason &&
          notif.reasonSubject === groupedNotif.notification.reasonSubject &&
          (notif.reason !== 'follow' ||
            notif.starterPack?.uri ===
              groupedNotif.notification.starterPack?.uri) &&
          (notif.author.did !== groupedNotif.notification.author.did ||
            notif.reason === 'subscribed-post')
        ) {
          const nextIsFollowBack =
            notif.reason === 'follow' && notif.author.viewer?.following
          const prevIsFollowBack =
            groupedNotif.notification.reason === 'follow' &&
            groupedNotif.notification.author.viewer?.following
          const shouldUngroup = nextIsFollowBack || prevIsFollowBack
          if (!shouldUngroup) {
            groupedNotif.additional = groupedNotif.additional || []
            groupedNotif.additional.push(notif)
            grouped = true
            break
          }
        }
      }
    }
    if (!grouped) {
      const type = toKnownType(notif)
      if (type !== 'starterpack-joined') {
        groupedNotifs.push({
          _reactKey: `notif-${notif.uri}-${notif.reason}`,
          type,
          notification: notif,
          subjectUri: getSubjectUri(type, notif),
        })
      } else {
        groupedNotifs.push({
          _reactKey: `notif-${notif.uri}-${notif.reason}`,
          type: 'starterpack-joined',
          notification: notif,
          subjectUri: notif.uri,
        })
      }
    }
  }
  return groupedNotifs
}

/**
 * Everyone who bit `did`, newest bite first, with the profile of each.
 *
 * A Constellation link carries who bit and when, which is all a bite
 * notification shows, so this is one Constellation page plus one batched
 * `getProfiles`, not a read per bite.
 */
async function fetchBites(
  client: Client,
  did: string,
): Promise<
  {author: app.bsky.actor.defs.ProfileView; link: ConstellationLink}[]
> {
  const instance =
    persisted.get('constellationInstance') ||
    persisted.defaults.constellationInstance!
  const links = await asyncGenCollect(
    asyncGenTake(
      asyncGenDedupe(
        constellationLinks(instance, {
          target: `at://${did}`,
          collection: BITE_COLLECTION,
          path: '.subject',
        }),
        link => link.did,
      ),
      BITE_LINKS_LIMIT,
    ),
  )
  if (!links.length) return []

  const profiles = new Map<string, app.bsky.actor.defs.ProfileView>()
  for (const actors of chunk(
    links.map(link => link.did),
    GET_PROFILES_MAX_ACTORS,
  )) {
    const res = await client.call(app.bsky.actor.getProfiles, {actors})
    for (const profile of res.profiles) {
      // A detailed profile has everything a basic one does, minus the type tag.
      profiles.set(profile.did, profile as app.bsky.actor.defs.ProfileView)
    }
  }

  // Bites from accounts that don't resolve, e.g. deleted, have no one to show.
  return links.flatMap(link => {
    const author = profiles.get(link.did)
    return author ? [{author, link}] : []
  })
}

async function fetchSubjects(
  client: Client,
  groupedNotifs: FeedNotification[],
): Promise<{
  posts: Map<string, app.bsky.feed.defs.PostView>
  starterPacks: Map<string, app.bsky.graph.defs.StarterPackViewBasic>
}> {
  const postUris = new Set<string>()
  const packUris = new Set<string>()
  for (const notif of groupedNotifs) {
    if (notif.subjectUri?.includes('app.bsky.feed.post')) {
      postUris.add(notif.subjectUri)
    } else if (
      notif.notification.reasonSubject?.includes('app.bsky.graph.starterpack')
    ) {
      packUris.add(notif.notification.reasonSubject)
    }
  }
  /*
   * Both uri sets are collected from notification fields the server already
   * validated as at-uris, so the branded cast reflects what the values are.
   */
  const postUriChunks = chunk(Array.from(postUris) as AtUriString[], 25)
  const packUriChunks = chunk(Array.from(packUris) as AtUriString[], 25)
  const postsChunks = await Promise.all(
    postUriChunks.map(uris => fetchNotificationPosts(client, uris)),
  )
  const packsChunks = await Promise.all(
    packUriChunks.map(uris =>
      client
        .call(app.bsky.graph.getStarterPacks, {uris})
        .then(data => data.starterPacks),
    ),
  )
  const postsMap = new Map<string, app.bsky.feed.defs.PostView>()
  const packsMap = new Map<string, app.bsky.graph.defs.StarterPackViewBasic>()
  for (const post of postsChunks.flat()) {
    if (bsky.isType(app.bsky.feed.post, post.record)) {
      postsMap.set(post.uri, post)
    }
  }
  for (const pack of packsChunks.flat()) {
    if (bsky.isType(app.bsky.graph.starterpack, pack.record)) {
      packsMap.set(pack.uri, pack)
    }
  }
  return {
    posts: postsMap,
    starterPacks: packsMap,
  }
}

function toKnownType(notif: Notification): NotificationType {
  if (notif.reason === 'like') {
    if (notif.reasonSubject?.includes('feed.generator')) {
      return 'feedgen-like'
    }
    return 'post-like'
  }
  if (
    notif.reason === 'post-bite' ||
    notif.reason === 'repost' ||
    notif.reason === 'mention' ||
    notif.reason === 'reply' ||
    notif.reason === 'quote' ||
    notif.reason === 'follow' ||
    notif.reason === 'user-bite' ||
    notif.reason === 'starterpack-joined' ||
    notif.reason === 'verified' ||
    notif.reason === 'unverified' ||
    notif.reason === 'like-via-repost' ||
    notif.reason === 'repost-via-repost' ||
    notif.reason === 'bite-via-repost' ||
    notif.reason === 'subscribed-post' ||
    notif.reason === 'contact-match'
  ) {
    return notif.reason as NotificationType
  }
  return 'unknown'
}

function getSubjectUri(
  type: NotificationType,
  notif: Notification,
): string | undefined {
  if (
    type === 'reply' ||
    type === 'quote' ||
    type === 'mention' ||
    type === 'subscribed-post'
  ) {
    return notif.uri
  } else if (
    type === 'post-like' ||
    type === 'post-bite' ||
    type === 'repost' ||
    type === 'like-via-repost' ||
    type === 'repost-via-repost' ||
    type === 'bite-via-repost'
  ) {
    if (
      bsky.isType(app.bsky.feed.repost, notif.record) ||
      bsky.isType(app.bsky.feed.like, notif.record)
    ) {
      return typeof notif.record.subject?.uri === 'string'
        ? notif.record.subject?.uri
        : undefined
    }
  } else if (type === 'feedgen-like') {
    return notif.reasonSubject
  }
}
