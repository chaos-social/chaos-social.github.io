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
import {com} from '#/lexicons'

export const ITEM_COLLECTION = 'blue.moji.collection.item'

export type NewEmoji = {
  /** Raw alias, with or without wrapping colons. */
  alias: string
  alt?: string
  /** Image as returned by the picker; `uploadBlob` reads it per platform. */
  image: PickerImage
  adultOnly?: boolean
}

/**
 * Writes a `blue.moji.collection.item`, the same record moji.blue's own upload
 * page creates. The rkey is derived from the alias (RFC 0005), so re-uploading
 * an alias replaces it rather than duplicating.
 */
export function useCreateEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const haptics = useHaptics()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async ({alias, alt, image, adultOnly}: NewEmoji) => {
      if (!pds.did) throw new Error('You need to sign in to add an emoji')
      const name = `:${normalizeAlias(alias)}:`
      const rkey = aliasToRkey(alias)
      const blob = await uploadBlob(pds, image.path, image.mime)
      const record = {
        $type: ITEM_COLLECTION,
        name,
        alt: alt?.trim() || undefined,
        adultOnly: adultOnly || undefined,
        createdAt: new Date().toISOString(),
        formats: {
          $type: 'blue.moji.collection.item#formats_v1' as const,
          png_128: blob.blob,
        },
      }
      await pds.call(com.atproto.repo.putRecord, {
        repo: pds.assertDid,
        collection: ITEM_COLLECTION,
        rkey,
        record,
        // Our PDS does not know this lexicon.
        validate: false,
      })
      return {name}
    },
    onError: error => {
      logger.error('Failed to create custom emoji', {safeMessage: error})
      Toast.show(l`Could not add your emoji`, {type: 'error'})
    },
    onSuccess: ({name}) => {
      haptics.success()
      Toast.show(l`Added ${name}. It may take a moment to appear in Discover.`)
      void queryClient.invalidateQueries({queryKey: [OWN_COLLECTION_ROOT]})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
    },
  })
}

/**
 * Deletes an emoji by alias. Posts that use it keep their facet and fall back
 * to the alias text once the source record is gone.
 */
export function useDeleteEmojiMutation() {
  const pds = usePdsClient()
  const queryClient = useQueryClient()
  const {t: l} = useLingui()

  return useMutation({
    mutationFn: async (alias: string) => {
      await pds.call(com.atproto.repo.deleteRecord, {
        repo: pds.assertDid,
        collection: ITEM_COLLECTION,
        rkey: aliasToRkey(alias),
      })
      return alias
    },
    onError: error => {
      logger.error('Failed to delete custom emoji', {safeMessage: error})
      Toast.show(l`Could not delete your emoji`, {type: 'error'})
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['useBluemojiSearchQuery']})
      void queryClient.invalidateQueries({queryKey: ['useBluemojiItemQuery']})
    },
  })
}
