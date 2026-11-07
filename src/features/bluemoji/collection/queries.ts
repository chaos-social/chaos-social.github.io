import {useQuery} from '@tanstack/react-query'

import {useDeferredEnable} from '#/lib/hooks/useDeferredEnable'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {usePdsClient, useSession} from '#/state/session'
import {type BluemojiItem} from '#/features/bluemoji/util'
import {blue, com} from '#/lexicons'

export const OWN_COLLECTION_ROOT = 'useOwnCollectionQuery'

/**
 * The viewer's own items, newest first, read straight from their PDS.
 *
 * moji.blue's collection listing only reflects what its firehose has indexed,
 * so a just-created item is missing there for a while. The PDS is the source of
 * truth and never lags, which is exactly what the add flow needs.
 */
export function useOwnCollectionQuery({
  enabled = true,
}: {enabled?: boolean} = {}) {
  const pds = usePdsClient()
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const deferred = useDeferredEnable(Boolean(did))

  return useQuery({
    queryKey: createQueryKey(OWN_COLLECTION_ROOT, {did}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: enabled && deferred && Boolean(did),
    retry: false,
    queryFn: async (): Promise<BluemojiItem[]> => {
      if (!did) return []
      const items: BluemojiItem[] = []
      let cursor: string | undefined
      do {
        const page = await pds.call(com.atproto.repo.listRecords, {
          repo: did,
          collection: 'blue.moji.collection.item',
          limit: 100,
          reverse: true,
          cursor,
        })
        for (const record of page.records) {
          const value = blue.moji.collection.item.$ifMatches(record.value)
          // An item without a CID has no addressable rendition.
          if (!value || !record.cid) continue
          items.push({
            uri: record.uri,
            cid: record.cid,
            did: did,
            record: value,
          })
        }
        cursor = page.cursor
      } while (cursor && items.length < 500)
      return items
    },
  })
}
