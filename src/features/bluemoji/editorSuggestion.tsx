import {useEffect} from 'react'
import {useSift} from '@bsky.app/sift'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {type Editor} from '@tiptap/react'
import {type SuggestionOptions, type SuggestionProps} from '@tiptap/suggestion'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {
  Autocomplete,
  type AutocompleteItem,
  useAutocomplete,
} from '#/components/Autocomplete'
import {isBluemojiSuggestionAllowed} from '#/features/bluemoji/editor'
import {fetchBluemojiSuggestions} from '#/features/bluemoji/queries'
import {
  type BluemojiItem,
  getBluemojiImage,
  getBluemojiModeration,
} from '#/features/bluemoji/util'

export type EmojiSuggestion = SuggestionProps
export type BluemojiSuggestionContext = {
  update: (suggestion: EmojiSuggestion | null) => void
  isOpen: boolean
}

/** TipTap detects the token; upstream Sift owns the results and keyboard UI. */
export function createBluemojiSuggestion(
  context: React.RefObject<BluemojiSuggestionContext>,
): Partial<SuggestionOptions> {
  return {
    char: ':',
    allow: ({state, range}) => isBluemojiSuggestionAllowed(state, range.from),
    items: () => [],
    render: () => ({
      onStart: props => context.current.update(props),
      onUpdate: props => context.current.update(props),
      onExit: () => context.current.update(null),
      onKeyDown: ({event}) =>
        context.current.isOpen &&
        !event.isComposing &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        [
          'ArrowUp',
          'ArrowDown',
          'Enter',
          'Tab',
          'Home',
          'End',
          'Escape',
        ].includes(event.key),
    }),
  }
}

export function ComposerEmojiAutocomplete({
  editor,
  suggestion,
  repo,
  onSelectBluemoji,
  context,
  closePopup,
}: {
  editor: Editor
  suggestion: EmojiSuggestion
  repo?: string
  onSelectBluemoji?: (item: BluemojiItem) => string
  context: React.RefObject<BluemojiSuggestionContext>
  closePopup: React.RefObject<(() => boolean) | null>
}) {
  const sift = useSift({
    placement: 'bottom-start',
    offset: 4,
    dynamicWidth: true,
  })
  const queryClient = useQueryClient()
  const moderationOpts = useModerationOpts()
  const {items: unicode} = useAutocomplete({
    type: 'emoji',
    query: suggestion.query,
  })
  const custom = useQuery({
    queryKey: createQueryKey('useBluemojiAutocompleteQuery', {
      repo,
      q: suggestion.query,
    }),
    enabled: Boolean(repo && onSelectBluemoji && suggestion.query),
    staleTime: STALE.MINUTES.ONE,
    retry: false,
    queryFn: () =>
      fetchBluemojiSuggestions(queryClient, repo ?? '', suggestion.query),
  })
  const customItems: AutocompleteItem[] = (
    onSelectBluemoji ? (custom.data ?? []) : []
  )
    .filter(
      item =>
        getBluemojiImage(item) &&
        getBluemojiModeration(item, moderationOpts) === 'ignore',
    )
    .map(item => ({
      key: item.uri,
      type: 'bluemoji',
      value: item.record.name,
      bluemoji: item,
    }))
  const data = customItems.length
    ? [...customItems.slice(0, unicode.length ? 4 : 8), ...unicode.slice(0, 4)]
    : unicode
  context.current.isOpen = data.length > 0

  const dismiss = () => context.current.update(null)
  useEffect(() => {
    sift.targetProps.ref(editor.view.dom)
    return () => sift.targetProps.ref(null)
  }, [editor, sift.targetProps.ref])
  useEffect(() => {
    const input = editor.view.dom
    input.setAttribute('role', 'combobox')
    input.setAttribute('aria-autocomplete', 'list')
    input.setAttribute('aria-controls', sift.id)
    input.setAttribute('aria-expanded', String(data.length > 0))
    return () => {
      for (const attribute of [
        'role',
        'aria-autocomplete',
        'aria-controls',
        'aria-expanded',
      ]) {
        input.removeAttribute(attribute)
      }
    }
  }, [editor, sift.id, data.length])
  useEffect(() => {
    const rect = suggestion.clientRect?.()
    if (!rect) return
    sift.refs.setAnchor({
      getBoundingClientRect: () =>
        new DOMRect(rect.x, rect.y, Math.max(rect.width, 1), rect.height),
    })
    void sift.updatePosition()
  }, [suggestion, sift.refs.setAnchor, sift.updatePosition])
  useEffect(() => {
    closePopup.current = () => {
      if (!context.current.isOpen) return false
      context.current.update(null)
      return true
    }
    return () => {
      closePopup.current = null
      context.current.isOpen = false
    }
  }, [context, closePopup])

  const select = (item: AutocompleteItem) => {
    const value =
      item.type === 'bluemoji'
        ? onSelectBluemoji?.(item.bluemoji)
        : item.type === 'emoji'
          ? item.value
          : undefined
    if (value)
      editor
        .chain()
        .focus()
        .insertContentAt(suggestion.range, `${value} `)
        .run()
    dismiss()
  }
  if (!data.length) return null
  return (
    <Autocomplete
      sift={sift}
      data={data}
      onSelect={select}
      onDismiss={dismiss}
    />
  )
}
