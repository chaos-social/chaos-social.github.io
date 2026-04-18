/**
 * TipTap is a stateful rich-text editor, which is extremely useful
 * when you _want_ it to be stateful formatting such as bold and italics.
 *
 * However we also use "stateless" behaviors, specifically for URLs
 * where the text itself drives the formatting.
 *
 * This plugin uses a regex to detect URIs and then applies
 * link decorations (a <span> with the "autolink") class. That avoids
 * adding any stateful formatting to TipTap's document model.
 *
 * We then run the URI detection again when constructing the
 * RichText object from TipTap's output and merge their features into
 * the facet-set.
 */

import {Mark} from '@tiptap/core'
import {type Node as ProsemirrorNode} from '@tiptap/pm/model'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {Decoration, DecorationSet} from '@tiptap/pm/view'

export const LinkDecorator = Mark.create({
  name: 'link-decorator',
  priority: 1000,
  keepOnSplit: false,
  inclusive() {
    return true
  },
  addProseMirrorPlugins() {
    return [linkDecorator()]
  },
})

function getDecorations(doc: ProsemirrorNode) {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const textContent = node.textContent

      // markdown links [text](url)
      const markdownRegex = /\[([^\]]+)\]\s*\(([^)]+)\)/g
      let markdownMatch
      while ((markdownMatch = markdownRegex.exec(textContent)) !== null) {
        const from = markdownMatch.index
        const to = from + markdownMatch[0].length
        decorations.push(
          Decoration.inline(pos + from, pos + to, {
            class: 'autolink',
          }),
        )
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

function linkDecorator() {
  const linkDecoratorPlugin: Plugin = new Plugin({
    key: new PluginKey('link-decorator'),

    state: {
      init: (_, {doc}) => getDecorations(doc),
      apply: (transaction, decorationSet) => {
        if (transaction.docChanged) {
          return getDecorations(transaction.doc)
        }
        return decorationSet.map(transaction.mapping, transaction.doc)
      },
    },

    props: {
      decorations(state) {
        return linkDecoratorPlugin.getState(state)
      },
    },
  })
  return linkDecoratorPlugin
}
