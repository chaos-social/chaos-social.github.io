import {useState} from 'react'
import {countGraphemes} from 'unicode-segmenter/grapheme'

import {MAX_POST_LINES} from '#/lib/constants'
import {type HtmlSegment, segmentsToText} from '#/lib/strings/bridged-html'
import {countLines} from '#/lib/strings/helpers'

/** Bridged posts can be much longer than Bluesky's 300-grapheme limit. */
const MAX_BRIDGED_POST_GRAPHEMES = 1000

/** Shared collapsed/expanded state for feed posts and non-anchor thread posts. */
export function usePostTextLimit(
  text: string | undefined,
  htmlSegments: HtmlSegment[] | undefined,
) {
  const [expanded, setExpanded] = useState(false)
  const displayedText = htmlSegments ? segmentsToText(htmlSegments) : text
  const isLong =
    countLines(displayedText) >= MAX_POST_LINES ||
    (!!htmlSegments &&
      countGraphemes(displayedText ?? '') > MAX_BRIDGED_POST_GRAPHEMES)

  return {
    limitLines: isLong && !expanded,
    onPressShowMore: () => setExpanded(true),
  }
}
