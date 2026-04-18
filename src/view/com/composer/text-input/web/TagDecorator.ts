import {Mark} from '@tiptap/core'
import {type Node as ProsemirrorNode} from '@tiptap/pm/model'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {Decoration, DecorationSet} from '@tiptap/pm/view'

import {detectFacetRunsWithoutResolution} from '#/lib/strings/detect-facets'

function getDecorations(doc: ProsemirrorNode) {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const textContent = node.textContent
      const facetRuns = detectFacetRunsWithoutResolution(textContent)

      let currentOffset = 0
      for (const run of facetRuns) {
        const runLength = run.text.length

        if (run.features?.length) {
          const start = pos + currentOffset
          const end = start + runLength

          decorations.push(
            Decoration.inline(start, end, {
              class: 'autolink',
            }),
          )
        }

        currentOffset += runLength
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

const tagDecoratorPlugin: Plugin = new Plugin({
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
      return tagDecoratorPlugin.getState(state)
    },
  },
})

export const TagDecorator = Mark.create({
  name: 'tag-decorator',
  priority: 1000,
  keepOnSplit: false,
  inclusive() {
    return true
  },
  addProseMirrorPlugins() {
    return [tagDecoratorPlugin]
  },
})
