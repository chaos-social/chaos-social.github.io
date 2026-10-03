import {type Editor, Node} from '@tiptap/core'
import {TextSelection} from '@tiptap/pm/state'
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'

import {atoms as a, useAlf} from '#/alf'
import {
  type BluemojiNodeAttrs,
  bluemojiNodeText,
} from '#/features/bluemoji/editor'
import {InlineBluemoji} from '#/features/bluemoji/InlineBluemoji'

function BluemojiNodeView({node}: NodeViewProps) {
  const {fonts} = useAlf()
  const attrs = node.attrs as BluemojiNodeAttrs
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      style={{display: 'inline', verticalAlign: 'baseline', paddingInline: 1}}>
      <InlineBluemoji
        claim={{
          did: attrs.did,
          name: attrs.name,
          record: {uri: attrs.uri, cid: attrs.cid},
        }}
        fallbackText={attrs.alias}
        size={a.text_lg.fontSize * fonts.scaleMultiplier}
      />
    </NodeViewWrapper>
  )
}

/** Keep the browser caret in adjacent text instead of an uneditable DOM boundary. */
function moveAcrossBluemoji(editor: Editor, direction: number) {
  const {state, view} = editor
  if (!state.selection.empty || view.composing) return false
  const step =
    getComputedStyle(view.dom).direction === 'rtl' ? -direction : direction
  const adjacent =
    step < 0
      ? state.selection.$head.nodeBefore
      : state.selection.$head.nodeAfter
  if (adjacent?.type.name !== 'bluemoji') return false
  const pos = state.selection.head + step
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)))
  view.focus()
  const {node, offset} = view.domAtPos(pos, step)
  view.dom.ownerDocument.getSelection()?.collapse(node, offset)
  return true
}

/** Keep the serialized and copied form as an alias, regardless of image state. */
export const BluemojiEditorNode = Node.create({
  name: 'bluemoji',
  inline: true,
  group: 'inline',
  atom: true,
  /* Arrow keys should cross the image instead of selecting it first. */
  selectable: false,
  addKeyboardShortcuts() {
    return {
      ArrowLeft: () => moveAcrossBluemoji(this.editor, -1),
      ArrowRight: () => moveAcrossBluemoji(this.editor, 1),
    }
  },
  addAttributes() {
    return Object.fromEntries(
      ['alias', 'did', 'name', 'uri', 'cid'].map(key => [key, {default: ''}]),
    )
  },
  renderHTML({node}) {
    return ['span', {}, bluemojiNodeText(node)]
  },
  renderText({node}) {
    return bluemojiNodeText(node)
  },
  addNodeView() {
    return ReactNodeViewRenderer(BluemojiNodeView)
  },
})
