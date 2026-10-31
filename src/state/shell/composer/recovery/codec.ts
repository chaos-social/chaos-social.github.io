import {BlobRef} from '@atproto/api'
import {isCid, jsonToLex, lexToJson} from '@atproto/lex'
import {RichText} from '@bsky/sdk/richtext'

import {createVideoTelemetry} from '#/lib/media/video/telemetry'
import {type ComposerOpts} from '#/state/shell/composer'
import {type ComposerState} from '#/view/com/composer/state/composer'

export type Recovery = {
  version: 1
  opts: ComposerOpts
  state: ComposerState
}

/** Store only composition data, never callbacks or live upload machinery. */
export function encodeRecovery(
  opts: ComposerOpts,
  state: ComposerState,
  serializeFile?: (file: File) => unknown,
) {
  return JSON.stringify(
    {
      version: 1,
      opts: {activeAccountDid: opts.activeAccountDid, replyTo: opts.replyTo},
      state: {
        ...state,
        loadedMediaMap: [...(state.loadedMediaMap ?? [])],
        originalLocalRefs: [...(state.originalLocalRefs ?? [])],
        thread: {
          ...state.thread,
          posts: state.thread.posts.map(post => ({
            ...post,
            richtext: {text: post.richtext.text, facets: post.richtext.facets},
          })),
        },
      },
    },
    function (this: Record<string, unknown>, key, value) {
      if (
        key === 'abortController' ||
        key === 'telemetry' ||
        key === 'moderation'
      ) {
        return undefined
      }
      const original = this[key]
      if (
        serializeFile &&
        typeof File !== 'undefined' &&
        original instanceof File
      ) {
        return serializeFile(original)
      }
      return isCid(original) ? lexToJson(original) : value
    },
  )
}

/** Reconstruct class instances and restart interrupted uploads on mount. */
export function decodeRecovery(raw: string): Recovery {
  const recovery = jsonToLex(JSON.parse(raw)) as unknown as Recovery
  if (recovery.version !== 1 || !recovery.state.thread.posts.length) {
    throw new Error('Unsupported composer recovery')
  }
  const state = recovery.state
  state.loadedMediaMap = new Map(state.loadedMediaMap)
  state.originalLocalRefs = new Set(state.originalLocalRefs)
  state.mutableNeedsFocusActive = true
  for (const post of state.thread.posts) {
    post.richtext = new RichText(post.richtext)
    const media = post.embed.media
    if (media?.type === 'images' || media?.type === 'gallery') {
      for (const image of media.images) {
        if (image.blobRef) {
          const {ref, mimeType, size} = image.blobRef
          image.blobRef = new BlobRef(ref, mimeType, size)
        }
      }
    }
    if (media?.type === 'video') {
      const video = media.video
      video.abortController = new AbortController()
      if (video.asset) {
        video.telemetry = createVideoTelemetry({
          asset: video.asset,
          signal: video.abortController.signal,
          metric: () => {},
        })
      }
    }
  }
  return recovery
}
