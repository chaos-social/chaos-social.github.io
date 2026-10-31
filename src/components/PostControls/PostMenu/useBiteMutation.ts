import {TID} from '@atproto/common-web'
import {useMutation} from '@tanstack/react-query'

import {usePdsClient} from '#/state/session'
import {com} from '#/lexicons'

/** Wafrn's bite record, consumed by their firehose from any repo. */
export const BITE_COLLECTION = 'net.wafrn.feed.bite'

/**
 * Bites a post (`at://did/app.bsky.feed.post/rkey`) or a profile (`at://did`);
 * wafrn tells them apart by whether the subject contains a post uri.
 */
export function useBiteMutation(subject: string) {
  const pdsClient = usePdsClient()
  return useMutation({
    mutationFn: () =>
      pdsClient.call(com.atproto.repo.putRecord, {
        repo: pdsClient.assertDid,
        collection: BITE_COLLECTION,
        rkey: TID.nextStr(),
        record: {
          $type: BITE_COLLECTION,
          subject,
          createdAt: new Date().toISOString(),
        },
        // Our PDS does not know this lexicon.
        validate: false,
      }),
  })
}
