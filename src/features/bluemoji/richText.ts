import {type RichText} from '@bsky/sdk/richtext'

import {isOnlyEmoji} from '#/alf/typography'
import {getBluemojiFacet} from '#/features/bluemoji/util'

/** Count custom emoji as emoji, rather than their potentially long aliases. */
export function isOnlyEmojiRichText(richText: RichText) {
  const text = [...richText.segments()]
    .map(segment =>
      !segment.link &&
      !segment.mention &&
      !segment.tag &&
      segment.facet?.features.some(feature => getBluemojiFacet(feature))
        ? '😀'
        : segment.text,
    )
    .join('')
    .replace(/\s/gu, '')
  return isOnlyEmoji(text)
}
