import {toDatetimeString} from '@atproto/syntax'
import {CID} from 'multiformats/cid'

import {type BluemojiItem} from '#/features/bluemoji/util'

export const imageCid =
  'bafkreiass37k5huajyfh6lzq6tndfhbsr6epvhoxz5diu4lj4rujcl3l4u'
export const recordCid =
  'bafyreic7dsmtdn2goztns32qoj57frm5dzw2mz3mgbmqf72pskh5rhoj2q'
export const item: BluemojiItem = {
  did: 'did:plc:4prkargawaafljpw576fztej',
  uri: 'at://did:plc:4prkargawaafljpw576fztej/blue.moji.collection.item/blobcat',
  cid: recordCid,
  record: {
    $type: 'blue.moji.collection.item',
    name: ':blobcat:',
    alt: 'A blue cat',
    createdAt: toDatetimeString(new Date('2026-08-18T14:01:04.774Z')),
    formats: {
      $type: 'blue.moji.collection.item#formats_v1',
      webp_128: {
        $type: 'blob',
        ref: CID.parse(imageCid),
        size: 2820,
        mimeType: 'image/webp',
      },
    },
  },
}
