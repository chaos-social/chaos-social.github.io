import {RichText} from '@bsky/sdk/richtext'
import {type Node} from '@tiptap/pm/model'
import {type EditorState} from '@tiptap/pm/state'

import {
  applyFacetSyntax,
  applyMarkdownLinkFacets,
} from '#/lib/strings/rich-text-manip'
import {type BluemojiItem, getBluemojiMatches} from '#/features/bluemoji/util'

export type BluemojiNodeAttrs = {
  alias: string
  did: string
  name: string
  uri: string
  cid: string
}

/** Preserve aliases in the editable document's plain text representation. */
export function bluemojiNodeText(node: Node) {
  return (node.attrs as BluemojiNodeAttrs).alias
}

/**
 * Replace verified aliases with atomic images, and reveal escaped images as text.
 * Changes run backwards so document positions and the selection map correctly.
 */
export function syncBluemojiEditor(
  state: EditorState,
  items: ReadonlyMap<string, BluemojiItem>,
) {
  const replacements: {from: number; to: number; node: Node}[] = []
  const emojiType = state.schema.nodes.bluemoji
  if (!emojiType) return undefined
  state.doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return true
    const children: {node: Node; pos: number; start: number; end: number}[] = []
    let text = ''
    block.forEach((node, offset) => {
      const start = text.length
      text += node.isText
        ? node.text
        : node.type.name === 'bluemoji'
          ? bluemojiNodeText(node)
          : node.type.name === 'hardBreak'
            ? '\n'
            : node.type.name === 'mention'
              ? `@${String(node.attrs.id)}`
              : '\uFFFC'
      children.push({node, pos: blockPos + 1 + offset, start, end: text.length})
    })
    const rt = new RichText({text})
    rt.detectFacetsWithoutResolution()
    applyMarkdownLinkFacets(rt)
    applyFacetSyntax(rt)
    const matches = getBluemojiMatches(rt)
    for (const child of children) {
      if (child.node.type === emojiType) {
        const alias = bluemojiNodeText(child.node)
        const item = items.get(alias)
        const valid =
          item &&
          matches.some(
            match => match.index === child.start && match[0] === alias,
          )
        if (!valid) {
          replacements.push({
            from: child.pos,
            to: child.pos + child.node.nodeSize,
            node: state.schema.text(alias),
          })
        } else {
          const attrs = child.node.attrs as BluemojiNodeAttrs
          if (attrs.uri !== item.uri || attrs.cid !== item.cid) {
            replacements.push({
              from: child.pos,
              to: child.pos + 1,
              node: emojiType.create({
                alias,
                did: item.did,
                name: item.record.name,
                uri: item.uri,
                cid: item.cid,
              }),
            })
          }
        }
      } else if (child.node.isText) {
        for (const match of matches) {
          const item = items.get(match[0])
          const end = match.index + match[0].length
          if (!item || match.index < child.start || end > child.end) continue
          replacements.push({
            from: child.pos + match.index - child.start,
            to: child.pos + end - child.start,
            node: emojiType.create({
              alias: match[0],
              did: item.did,
              name: item.record.name,
              uri: item.uri,
              cid: item.cid,
            }),
          })
        }
      }
    }
    return false
  })
  if (!replacements.length) return undefined
  const tr = state.tr.setMeta('addToHistory', false)
  for (const {from, to, node} of replacements.sort((a, b) => b.from - a.from))
    tr.replaceWith(from, to, node)
  return tr
}
