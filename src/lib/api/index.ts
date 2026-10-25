import {TID} from '@atproto/common-web'
import {type $Typed, type Client} from '@atproto/lex'
import {
  type AtUriString,
  toDatetimeString,
  type UriString,
} from '@atproto/syntax'
import {RichText} from '@bsky/sdk/richtext'
import {t} from '@lingui/core/macro'
import {type QueryClient} from '@tanstack/react-query'

import {type LinkResolvers} from '#/lib/api/resolve'
import {withCreator} from '#/lib/at-card'
import {IMAGE_SIZE_CONFIG_POSTS} from '#/lib/constants'
import {MAX_TAGS} from '#/lib/constants'
import {isNetworkError} from '#/lib/strings/errors'
import {
  applyFacetSyntax,
  parseMarkdownLinks,
  resolveSyntaxMentions,
  shortenLinks,
  stripInvalidMentions,
} from '#/lib/strings/rich-text-manip'
import {logger} from '#/logger'
import {compressImage} from '#/state/gallery'
import {
  fetchResolveGifQuery,
  fetchResolveLinkQuery,
} from '#/state/queries/resolve-link'
import {
  createThreadgateRecord,
  threadgateAllowUISettingToAllowRecordValue,
} from '#/state/queries/threadgate'
import {
  type EmbedDraft,
  type PostDraft,
  type ThreadDraft,
} from '#/view/com/composer/state/composer'
import {IS_IOS, IS_WEB} from '#/env'
import {app, chat, com} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {createGIFDescription} from '../gif-alt-text'
import {computeCid} from './computeCid'
import {reuseGalleryImageBlob} from './resolve-gallery'
import {uploadBlob} from './upload-blob'

export {uploadBlob}

interface PostOpts {
  thread: ThreadDraft
  replyTo?: string
  onStateChange?: (state: string) => void
  langs?: string[]
  /*
   * Facet/mention resolution and reply-root lookup are appview jobs - they
   * resolve handles and read posts through the appview, and the public
   * fallback keeps facet detection working when logged out.
   */
  appviewClient: Client
  /*
   * A quoted chat invite link resolves its preview through the chat service, so
   * the embed resolver needs the chat client alongside the appview one.
   */
  chatClient: Client
  /*
   * The repo write itself (applyWrites) plus every record blob (images,
   * gallery items, link thumbnails, video captions) goes to the account's own
   * PDS, never the appview.
   */
  pdsClient: Client
  omitViaField?: boolean
  tidSuffix?: string
}

const MAX_TID_SUFFIX_LEN = 6

function nextPostTid(prev: TID | undefined, tidSuffix?: string): TID {
  if (prev) return TID.next(prev)
  if (!tidSuffix) return TID.next(prev)

  const suffix = tidSuffix.slice(0, MAX_TID_SUFFIX_LEN)
  const tid = TID.next(prev).toString()
  return TID.fromStr(`${tid.slice(0, -suffix.length)}${suffix}`)
}

export async function post(queryClient: QueryClient, opts: PostOpts) {
  const thread = opts.thread
  opts.onStateChange?.(t`Processing...`)

  let replyPromise:
    | Promise<app.bsky.feed.post.Main['reply']>
    | app.bsky.feed.post.Main['reply']
    | undefined
  if (opts.replyTo) {
    // Not awaited to avoid waterfalls.
    replyPromise = resolveReply(opts.appviewClient, opts.replyTo)
  }

  // add top 3 languages from user preferences if langs is provided
  let langs = opts.langs
  if (opts.langs) {
    langs = opts.langs.slice(0, 3)
  }

  const did = opts.pdsClient.assertDid
  const writes: com.atproto.repo.applyWrites.$InputBody['writes'] = []
  const uris: string[] = []
  const via = IS_WEB
    ? 'Witchsky Web App'
    : IS_IOS
      ? 'Witchsky for iPhone'
      : 'Witchsky for Android'

  let now = new Date()
  let tid: TID | undefined

  for (let i = 0; i < thread.posts.length; i++) {
    const draft = thread.posts[i]

    // Not awaited to avoid waterfalls.
    const rtPromise = resolveRT(opts.appviewClient, draft.richtext)
    const embedPromise = resolveEmbed(
      opts.appviewClient,
      opts.chatClient,
      opts.pdsClient,
      queryClient,
      draft,
      opts.onStateChange,
    )
    let labels: $Typed<com.atproto.label.defs.SelfLabels> | undefined
    if (draft.labels.length) {
      labels = {
        $type: 'com.atproto.label.defs#selfLabels',
        values: draft.labels.map(val => ({val})),
      }
    }
    const tags = draft.tags.length ? draft.tags.slice(0, MAX_TAGS) : undefined

    // The sorting behavior for multiple posts sharing the same createdAt time is
    // undefined, so what we'll do here is increment the time by 1 for every post
    now.setMilliseconds(now.getMilliseconds() + 1)
    tid = nextPostTid(tid, opts.tidSuffix)
    const rkey = tid.toString()
    const uri = `at://${did}/app.bsky.feed.post/${rkey}` as AtUriString
    uris.push(uri)

    const rt = await rtPromise
    const embed = await embedPromise
    const reply = await replyPromise
    const record: app.bsky.feed.post.Main = {
      // IMPORTANT: $type has to exist, CID is calculated with the `$type` field
      // present and will produce the wrong CID if you omit it.
      $type: 'app.bsky.feed.post',
      createdAt: toDatetimeString(now),
      text: rt.text,
      facets: rt.facets,
      reply,
      embed,
      langs,
      labels,
      tags,
    }
    if (!opts.omitViaField) {
      ;(record as app.bsky.feed.post.Main & {via?: string}).via = via
    }
    writes.push({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.feed.post',
      rkey: rkey,
      value: record,
    })

    if (i === 0 && thread.threadgate.some(tg => tg.type !== 'everybody')) {
      writes.push({
        $type: 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.feed.threadgate',
        rkey: rkey,
        value: createThreadgateRecord({
          createdAt: toDatetimeString(now),
          post: uri,
          allow: threadgateAllowUISettingToAllowRecordValue(thread.threadgate),
        }),
      })
    }

    if (
      thread.postgate.embeddingRules?.length ||
      thread.postgate.detachedEmbeddingUris?.length
    ) {
      writes.push({
        $type: 'com.atproto.repo.applyWrites#create',
        collection: 'app.bsky.feed.postgate',
        rkey: rkey,
        value: {
          ...thread.postgate,
          $type: 'app.bsky.feed.postgate',
          createdAt: toDatetimeString(now),
          post: uri,
        },
      })
    }

    // Prepare a ref to the current post for the next post in the thread.
    const ref = {
      cid: await computeCid(record),
      uri,
    }
    replyPromise = {
      root: reply?.root ?? ref,
      parent: ref,
    }
  }

  try {
    await opts.pdsClient.call(com.atproto.repo.applyWrites, {
      repo: did,
      writes: writes,
      validate: true,
    })
  } catch (err) {
    const e = err as Error
    logger.error(`Failed to create post`, {
      safeMessage: e.message,
    })
    if (isNetworkError(e)) {
      throw new Error(
        t`Post failed to upload. Please check your Internet connection and try again.`,
      )
    } else {
      throw e
    }
  }

  return {uris}
}

async function resolveRT(appviewClient: Client, richtext: RichText) {
  const trimmedText = richtext.text
    // Trim leading whitespace-only lines (but don't break ASCII art).
    .replace(/^(\s*\n)+/, '')
    // Trim any trailing whitespace.
    .trimEnd()
  const {text: parsedText, facets: markdownFacets} = parseMarkdownLinks(
    new RichText({text: trimmedText}, {cleanNewlines: true}).text,
  )
  let rt = new RichText({text: parsedText})
  await rt.detectFacets(appviewClient)

  if (markdownFacets.length > 0) {
    const nonOverlapping = (rt.facets || []).filter(f => {
      return !markdownFacets.some(mf => {
        return (
          (f.index.byteStart >= mf.index.byteStart &&
            f.index.byteStart < mf.index.byteEnd) ||
          (f.index.byteEnd > mf.index.byteStart &&
            f.index.byteEnd <= mf.index.byteEnd) ||
          (mf.index.byteStart >= f.index.byteStart &&
            mf.index.byteStart < f.index.byteEnd)
        )
      })
    })
    rt.facets = [...nonOverlapping, ...markdownFacets].sort(
      (a, b) => a.index.byteStart - b.index.byteStart,
    ) as typeof rt.facets
  }

  rt = applyFacetSyntax(rt, {removeSyntax: true})
  await resolveSyntaxMentions(rt, appviewClient)

  if (rt.facets?.length === 0) {
    delete rt.facets
  }

  rt = shortenLinks(rt, true, markdownFacets)
  rt = stripInvalidMentions(rt)
  return rt
}

export class ReplyDeletedError extends Error {
  constructor() {
    super('Could not resolve reply')
  }
}

async function resolveReply(appviewClient: Client, replyTo: string) {
  const data = await appviewClient.call(app.bsky.feed.getPosts, {
    uris: [replyTo as AtUriString],
  })
  const parentPost = data.posts[0]
  if (!parentPost) {
    throw new ReplyDeletedError()
  }

  const parentRef = {
    uri: parentPost.uri,
    cid: parentPost.cid,
  }
  let rootRef: com.atproto.repo.strongRef.Main = parentRef

  if (bsky.isType(app.bsky.feed.post, parentPost.record)) {
    if (parentPost.record.reply) {
      rootRef = parentPost.record.reply.root
    }
  }

  return {
    root: rootRef,
    parent: parentRef,
  }
}

async function resolveEmbed(
  appviewClient: Client,
  chatClient: Client,
  pdsClient: Client,
  queryClient: QueryClient,
  draft: PostDraft,
  onStateChange: ((state: string) => void) | undefined,
): Promise<app.bsky.feed.post.Main['embed']> {
  if (draft.embed.quote) {
    const [resolvedMedia, resolvedQuote] = await Promise.all([
      resolveMedia(
        appviewClient,
        chatClient,
        pdsClient,
        queryClient,
        draft.embed,
        onStateChange,
      ),
      resolveRecord(
        {appviewClient, chatClient},
        queryClient,
        draft.embed.quote.uri,
      ),
    ])
    if (resolvedMedia) {
      return {
        $type: 'app.bsky.embed.recordWithMedia',
        record: {
          $type: 'app.bsky.embed.record',
          record: resolvedQuote,
        },
        media: resolvedMedia,
      }
    }
    return {
      $type: 'app.bsky.embed.record',
      record: resolvedQuote,
    }
  }
  const resolvedMedia = await resolveMedia(
    appviewClient,
    chatClient,
    pdsClient,
    queryClient,
    draft.embed,
    onStateChange,
  )
  if (resolvedMedia) {
    return resolvedMedia
  }
  if (draft.embed.link) {
    const resolvedLink = await fetchResolveLinkQuery(
      queryClient,
      {appviewClient, chatClient},
      draft.embed.link.uri,
    )
    if (resolvedLink.type === 'record') {
      return {
        $type: 'app.bsky.embed.record',
        record: resolvedLink.record,
      }
    }
  }
  return undefined
}

async function resolveMedia(
  appviewClient: Client,
  chatClient: Client,
  pdsClient: Client,
  queryClient: QueryClient,
  embedDraft: EmbedDraft,
  onStateChange: ((state: string) => void) | undefined,
): Promise<
  | $Typed<app.bsky.embed.external.Main>
  | $Typed<app.bsky.embed.images.Main>
  | $Typed<app.bsky.embed.gallery.Main>
  | $Typed<app.bsky.embed.video.Main>
  | undefined
> {
  if (embedDraft.media?.type === 'images') {
    const imagesDraft = embedDraft.media.images
    logger.debug(`Uploading images`, {
      count: imagesDraft.length,
    })
    onStateChange?.(t`Uploading images...`)
    const images: app.bsky.embed.images.Image[] = await Promise.all(
      imagesDraft.map(async (image, i) => {
        if (image.blobRef) {
          logger.debug(`Reusing existing blob for image #${i}`)
          return {
            image:
              image.blobRef as unknown as app.bsky.embed.images.Image['image'],
            alt: image.alt,
            aspectRatio: {
              width: image.source.width,
              height: image.source.height,
            },
          }
        }
        logger.debug(`Compressing image #${i}`)
        const {path, width, height, mime} = await compressImage(
          image,
          IMAGE_SIZE_CONFIG_POSTS,
        )
        logger.debug(`Uploading image #${i}`)
        const res = await uploadBlob(pdsClient, path, mime)
        return {
          image: res.blob,
          alt: image.alt,
          aspectRatio: {width, height},
        }
      }),
    )
    return {
      $type: 'app.bsky.embed.images',
      images,
    }
  }
  if (embedDraft.media?.type === 'gallery') {
    const imagesDraft = embedDraft.media.images
    logger.debug(`Uploading images`, {
      count: imagesDraft.length,
    })
    onStateChange?.(t`Uploading images...`)
    const items: $Typed<app.bsky.embed.gallery.Image>[] = await Promise.all(
      imagesDraft.map(async (image, i) => {
        const reusedImage = reuseGalleryImageBlob(image)
        if (reusedImage) {
          logger.debug(`Reusing existing blob for gallery image #${i}`)
          return reusedImage as unknown as $Typed<app.bsky.embed.gallery.Image>
        }
        logger.debug(`Compressing image #${i}`)
        const {path, width, height, mime} = await compressImage(
          image,
          IMAGE_SIZE_CONFIG_POSTS,
        )
        logger.debug(`Uploading image #${i}`)
        const res = await uploadBlob(pdsClient, path, mime)
        return {
          $type: 'app.bsky.embed.gallery#image' as const,
          image: res.blob,
          alt: image.alt,
          aspectRatio: {width, height},
        }
      }),
    )
    return {
      $type: 'app.bsky.embed.gallery',
      items,
    }
  }
  if (
    embedDraft.media?.type === 'video' &&
    embedDraft.media.video.status === 'done'
  ) {
    const videoDraft = embedDraft.media.video
    const captions = await Promise.all(
      videoDraft.captions
        .filter(caption => caption.lang !== '')
        .map(async caption => {
          const res = await pdsClient.uploadBlob(caption.file, {
            encoding: 'text/vtt',
          })
          return {lang: caption.lang, file: res.body.blob}
        }),
    )

    if ('originalCaptions' in videoDraft) {
      captions.push(...(videoDraft.originalCaptions ?? []))
    }

    const width = Math.round(
      videoDraft.asset?.width ||
        ('redraftDimensions' in videoDraft
          ? videoDraft.redraftDimensions.width
          : 1000),
    )
    const height = Math.round(
      videoDraft.asset?.height ||
        ('redraftDimensions' in videoDraft
          ? videoDraft.redraftDimensions.height
          : 1000),
    )

    // aspect ratio values must be >0 - better to leave as unset otherwise
    // posting will fail if aspect ratio is set to 0
    const aspectRatio = width > 0 && height > 0 ? {width, height} : undefined

    if (!aspectRatio) {
      logger.error(
        `Invalid aspect ratio - got { width: ${width}, height: ${height} }`,
      )
    }

    return {
      $type: 'app.bsky.embed.video',
      /*
       * The video blob is a plain lex blob from the video pipeline
       * (getJobStatus, in composer state/video). Its structural shape matches
       * the lexicon blob field and the CID hasher (see computeCid).
       */
      video: videoDraft.pendingPublish.blobRef,
      alt: videoDraft.altText || undefined,
      captions: captions.length === 0 ? undefined : captions,
      aspectRatio,
      presentation:
        videoDraft.video?.mimeType === 'image/gif' ? 'gif' : 'default',
    }
  }
  if (embedDraft.media?.type === 'gif') {
    const gifDraft = embedDraft.media
    const resolvedGif = await fetchResolveGifQuery(queryClient, gifDraft.gif)
    let blob: app.bsky.embed.external.External['thumb']
    if (resolvedGif.thumb) {
      onStateChange?.(t`Uploading link thumbnail...`)
      const {path, mime} = resolvedGif.thumb.source
      const response = await uploadBlob(pdsClient, path, mime)
      blob = response.blob
    }
    return {
      $type: 'app.bsky.embed.external',
      external: {
        uri: resolvedGif.uri as UriString,
        title: resolvedGif.title,
        description: createGIFDescription(resolvedGif.title, gifDraft.alt),
        thumb: blob,
      },
    }
  }
  if (embedDraft.link) {
    const resolvedLink = await fetchResolveLinkQuery(
      queryClient,
      {appviewClient, chatClient},
      embedDraft.link.uri,
    )
    if (resolvedLink.type === 'external') {
      let blob: app.bsky.embed.external.External['thumb']
      if (resolvedLink.thumb) {
        onStateChange?.(t`Uploading link thumbnail...`)
        const {path, mime} = resolvedLink.thumb.source
        const response = await uploadBlob(pdsClient, path, mime)
        blob = response.blob
      }
      return {
        $type: 'app.bsky.embed.external',
        external: withCreator(
          {
            uri: resolvedLink.uri as UriString,
            title: resolvedLink.title,
            description: resolvedLink.description,
            thumb: blob,
            associatedRefs: resolvedLink.associatedRefs,
          },
          resolvedLink.authorDid,
        ),
      }
    }
    if (
      resolvedLink.type === 'chat-invite' &&
      bsky.isType(chat.bsky.group.defs.joinLinkPreviewView, resolvedLink.view)
    ) {
      return {
        $type: 'app.bsky.embed.external',
        external: {
          uri: resolvedLink.uri as UriString,
          title: resolvedLink.view.name,
          description: `${resolvedLink.view.memberCount}/${resolvedLink.view.memberLimit}`,
        },
      }
    }
  }
  return undefined
}

async function resolveRecord(
  clients: LinkResolvers,
  queryClient: QueryClient,
  uri: string,
): Promise<com.atproto.repo.strongRef.Main> {
  const resolvedLink = await fetchResolveLinkQuery(queryClient, clients, uri)
  if (resolvedLink.type !== 'record') {
    throw Error(t`Expected uri to resolve to a record`)
  }
  return resolvedLink.record
}
