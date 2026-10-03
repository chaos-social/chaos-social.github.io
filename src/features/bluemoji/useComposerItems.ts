import {type RichText} from '@bsky/sdk/richtext'
import {useQueries} from '@tanstack/react-query'

import {bluemojiItemQueryOptions} from '#/features/bluemoji/queries'
import {
  type BluemojiItem,
  type BluemojiRef,
  getBluemojiMatches,
} from '#/features/bluemoji/util'

/** Share verified source lookups between the picker, editor, and posted emoji. */
export function useComposerBluemojiItems(
  richtext: RichText,
  refs: Record<string, BluemojiRef> | undefined,
  repo: string | undefined,
) {
  const names = [
    ...new Set(getBluemojiMatches(richtext).map(match => match[0])),
  ]
  const results = useQueries({
    queries: names.map(name =>
      bluemojiItemQueryOptions(refs?.[name] ?? {did: repo ?? '', name}),
    ),
  })
  const items = new Map<string, BluemojiItem>()
  results.forEach((result, index) => {
    if (result.data) items.set(names[index], result.data)
  })
  return items
}
