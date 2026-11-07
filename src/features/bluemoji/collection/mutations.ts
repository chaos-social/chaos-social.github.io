import {type Client} from '@atproto/lex'
import {AtUri} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {uploadBlob} from '#/lib/api'
import {useHaptics} from '#/lib/haptics'
import {type PickerImage} from '#/lib/media/picker.shared'
import {logger} from '#/logger'
import {usePdsClient} from '#/state/session'
import * as Toast from '#/components/Toast'
import {aliasToRkey, normalizeAlias} from '#/features/bluemoji/alias'
import {OWN_COLLECTION_ROOT} from '#/features/bluemoji/collection/queries'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {com} from '#/lexicons'

export const ITEM_COLLECTION = 'blue.moji.collection.item'

export type EmojiDraft = {
  /** Raw alias, with or without wrapping colons. */
  alias: string
  alt?: string
  /** New image, as returned by the picker. Omitting it keeps the current one. */
  image?: PickerImage
  adultOnly?: boolean
}

function rkeyOf(uri: string) {
  try {
    return new AtUri(uri).rkey
  } catch {
    return ''
  }
}

/** One item write, shared by the single and bulk flows. */
async function putEmoji(
  pds: Client,
  {
    alias,
    alt,
    image,
    adultOnly,
    editing,
  }: EmojiDraft & {editing?: BluemojiItem},
) {
  const name = `:${normalizeAlias(alias)}:`
  // An edit keeps its existing rkey unless the alias changed; historical items
  // have rkeys unrelated to their alias.
  const previousRkey = editing ? rkeyOf(editing.uri) : ''
  const unchangedAlias = editing?.record.name === name
  const formats = image
    ? {
        $type: 'blue.moji.collection.item#formats_v1' as const,
        png_128: (await uploadBlob(pds, image.path, image.mime)).blob,
      }
    : // Keep the existing renditions; the AppView serves those blobs.
      editing?.record.formats
  if (!formats) throw new Error('An emoji needs an image')
  await pds.call(com.atproto.repo.putRecord, {
    repo: pds.assertDid,
    collection: ITEM_COLLECTION,
    rkey: unchangedAlias ? previousRkey : aliasToRkey(alias),
    record: {
      $type: ITEM_COLLECTION,
      name,
      alt: alt?.trim() || undefined,
      adultOnly: adultOnly || undefined,
      createdAt: editing?.record.createdAt ?? new Date().toISOString(),
      formats,
    },
    // Our PDS does not know this lexicon.
    validate: false,
  })
  if (previousRkey && !unchangedAlias) {
    await pds.call(com.atproto.repo.deleteRecord, {
      repo: pds.assertDid,
      collection: ITEM_COLLECTION,
      rkey: previousRkey,
    })
  }
  return {name, added: !editing}
}

/**
 * Writes a `blue.moji.collection.item`, the same record moji.blue's own upload
 * page creates. The rkey is derived from the alias (RFC 0005), so re-uploading
 * an alias replaces it rather than duplicating.
 *
 * Editing an existing item goes through the same call: pass the item and the
 * write lands on its own rkey. Renaming writes the new rkey and deletes the old
 * one, because other clients address items by alias.
 */
export function useSaveEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (draft: EmojiDraft & {editing?: BluemojiItem}) => {
      if (!pds.did) throw new Error('You need to sign in to save an emoji')
      return await putEmoji(pds, draft)
    },
    onError: (error, {editing}) => {
      logger.error('Failed to save custom emoji', {safeMessage: error})
      Toast.show(
        editing ? l`Could not save your emoji` : l`Could not add your emoji`,
        {type: 'error'},
      )
    },
    onSuccess: ({name, added}) => {
      haptics.success()
      Toast.show(
        added
          ? l`Added ${name}. It may take a moment to appear in Discover.`
          : l`Saved ${name}.`,
      )
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
    },
  })
}

/**
 * Deletes an emoji by its record rkey. Posts that use it keep their facet and
 * fall back to the alias text once the source record is gone.
 */
/**
 * Writes many emoji one after another, reporting progress as it goes.
 *
 * Sequential on purpose: each item is a blob upload plus a record write, and a
 * burst of twenty parallel uploads is the easiest way to get rate limited by a
 * PDS. One item failing does not stop the rest; the mismatches (usually a bad
 * alias) come back so the caller can name them.
 */
export function useBulkEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({
      drafts,
      onProgress,
    }: {
      drafts: EmojiDraft[]
      onProgress?: (done: number) => void
    }) => {
      if (!pds.did) throw new Error('You need to sign in to add emoji')
      const failed: string[] = []
      for (const [i, draft] of drafts.entries()) {
        try {
          await putEmoji(pds, draft)
        } catch (error) {
          failed.push(draft.alias)
          logger.error('Failed to add a custom emoji in bulk', {
            safeMessage: error,
          })
        }
        onProgress?.(i + 1)
      }
      return {added: drafts.length - failed.length, failed}
    },
    onSuccess: ({added, failed}) => {
      haptics.success()
      Toast.show(
        failed.length
          ? l`Added ${added}. These could not be added: ${failed.join(', ')}`
          : l`Added ${added} emoji.`,
        {type: failed.length ? 'warning' : undefined},
      )
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
    },
  })
}

export function useDeleteEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (item: BluemojiItem) => {
      const rkey = rkeyOf(item.uri)
      if (!rkey) throw new Error('Not a collection item')
      await pds.call(com.atproto.repo.deleteRecord, {
        repo: pds.assertDid,
        collection: ITEM_COLLECTION,
        rkey,
      })
      return rkey
    },
    onError: error => {
      logger.error('Failed to delete custom emoji', {safeMessage: error})
      Toast.show(l`Could not delete your emoji`, {type: 'error'})
    },
    onSuccess: rkey => {
      haptics.tap()
      // Drop it from the grid before the PDS read comes back.
      queryClient.setQueriesData<BluemojiItem[]>(
        {queryKey: [OWN_COLLECTION_ROOT]},
        previous => previous?.filter(item => rkeyOf(item.uri) !== rkey),
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
    },
  })
}
