import {useEffect, useImperativeHandle, useState} from 'react'
import {Pressable, View} from 'react-native'
import {type ModerationOpts} from '@bsky/sdk/moderation'
import {useLingui} from '@lingui/react/macro'
import {type QueryClient} from '@tanstack/react-query'
import {ReactRenderer} from '@tiptap/react'
import {type SuggestionOptions, type SuggestionProps} from '@tiptap/suggestion'
import tippy, {type Instance} from 'tippy.js'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {isBluemojiSuggestionAllowed} from '#/features/bluemoji/editor'
import {InlineBluemoji} from '#/features/bluemoji/InlineBluemoji'
import {fetchBluemojiSuggestions} from '#/features/bluemoji/queries'
import {
  type BluemojiItem,
  getBluemojiImage,
  getBluemojiModeration,
} from '#/features/bluemoji/util'

export type BluemojiSuggestionContext = {
  queryClient: QueryClient
  repo?: string
  moderationOpts?: ModerationOpts
  onSelect?: (item: BluemojiItem) => string
}
type ListRef = {onKeyDown: (event: KeyboardEvent) => boolean}

/** Read current account and moderation state without recreating the editor. */
export function createBluemojiSuggestion(
  context: React.RefObject<BluemojiSuggestionContext>,
  closePopup: React.RefObject<(() => boolean) | null>,
): Partial<SuggestionOptions<BluemojiItem, BluemojiItem>> {
  return {
    char: ':',
    allow: ({state, range}) =>
      Boolean(
        context.current.onSelect &&
        isBluemojiSuggestionAllowed(state, range.from),
      ),
    async items({query}) {
      const current = context.current
      try {
        const items = await fetchBluemojiSuggestions(
          current.queryClient,
          current.repo ?? '',
          query,
        )
        return items.filter(
          item =>
            getBluemojiImage(item) &&
            getBluemojiModeration(item, current.moderationOpts) === 'ignore',
        )
      } catch {
        return []
      }
    },
    command({editor, range, props}) {
      const alias = context.current.onSelect?.(props)
      if (alias)
        editor.chain().focus().insertContentAt(range, `${alias} `).run()
    },
    render() {
      let component: ReactRenderer<ListRef> | undefined
      let popup: Instance | undefined
      const hide = () => {
        popup?.destroy()
        component?.destroy()
        popup = undefined
        component = undefined
        closePopup.current = null
      }
      const update = (props: SuggestionProps<BluemojiItem, BluemojiItem>) => {
        closePopup.current = () => {
          if (!component) return false
          hide()
          return true
        }
        const rect = props.clientRect?.()
        if (!props.items.length || !rect) {
          hide()
          return
        }
        if (!component)
          component = new ReactRenderer(BluemojiSuggestionList, {
            editor: props.editor,
            props,
          })
        else component.updateProps(props)
        if (!popup)
          popup = tippy(document.body, {
            content: component.element,
            getReferenceClientRect: () => props.clientRect?.() ?? rect,
            appendTo: () => document.body,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        else
          popup.setProps({
            getReferenceClientRect: () => props.clientRect?.() ?? rect,
          })
      }
      return {
        onStart: update,
        onUpdate: update,
        onKeyDown({event}) {
          if (!component) return false
          if (event.key === 'Escape') {
            hide()
            return true
          }
          return component.ref?.onKeyDown(event) ?? false
        },
        onExit: hide,
      }
    },
  }
}

function BluemojiSuggestionList({
  items,
  command,
  ref,
}: SuggestionProps<BluemojiItem, BluemojiItem> & {ref: React.Ref<ListRef>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [selected, setSelected] = useState(0)
  useEffect(() => setSelected(0), [items])
  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length) return false
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        setSelected(
          (selected + (event.key === 'ArrowUp' ? -1 : 1) + items.length) %
            items.length,
        )
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[selected]
        if (!item) return false
        command(item)
        return true
      }
      return false
    },
  }))
  return (
    <div onMouseDown={event => event.preventDefault()}>
      <View
        style={[
          a.p_xs,
          a.border,
          a.rounded_sm,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          {minWidth: 240, maxWidth: 320},
        ]}>
        {items.map((item, index) => (
          <Pressable
            key={item.uri}
            accessibilityRole="button"
            accessibilityLabel={item.record.name}
            accessibilityHint={l`Insert ${item.record.name}`}
            testID="bluemojiSuggestion"
            onPress={() => command(item)}
            onHoverIn={() => setSelected(index)}
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.p_sm,
              a.rounded_sm,
              selected === index && t.atoms.bg_contrast_25,
            ]}>
            <InlineBluemoji
              claim={{
                did: item.did,
                name: item.record.name,
                record: {uri: item.uri, cid: item.cid},
              }}
              fallbackText={item.record.name}
              size={24}
              interactive={false}
            />
            <Text emoji>{item.record.name}</Text>
          </Pressable>
        ))}
      </View>
    </div>
  )
}
