import {AtUri} from '@atproto/syntax'
import {useMutation} from '@tanstack/react-query'

import {usePdsClient} from '#/state/session'
import {com} from '#/lexicons'

/** Wafrn's bite record, consumed by their firehose from any repo. */
export const BITE_COLLECTION = 'net.wafrn.feed.bite'

export function useBiteMutation(postUri: string) {
  const pdsClient = usePdsClient()
  return useMutation({
    mutationFn: () => {
      const urip = new AtUri(postUri)
      return pdsClient.call(com.atproto.repo.putRecord, {
        repo: pdsClient.assertDid,
        collection: BITE_COLLECTION,
        /*
         * Derived from the subject so a second bite overwrites the record
         * instead of duplicating it. Overwrites emit `update`, which wafrn
         * ignores, so the author is not notified twice.
         */
        rkey: `${urip.host}-${urip.rkey}`,
        record: {
          $type: BITE_COLLECTION,
          subject: postUri,
          createdAt: new Date().toISOString(),
        },
        // Our PDS does not know this lexicon.
        validate: false,
      })
    },
  })
}
