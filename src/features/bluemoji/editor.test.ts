import {Schema} from '@tiptap/pm/model'
import {EditorState, TextSelection} from '@tiptap/pm/state'

import {item} from '#/features/bluemoji/__tests__/fixtures'
import {
  bluemojiNodeText,
  isBluemojiSuggestionAllowed,
  syncBluemojiEditor,
} from '#/features/bluemoji/editor'

jest.unmock('multiformats/cid')

const schema = new Schema({
  nodes: {
    doc: {content: 'paragraph+'},
    paragraph: {content: 'inline*', group: 'block'},
    text: {group: 'inline'},
    bluemoji: {
      inline: true,
      group: 'inline',
      atom: true,
      selectable: false,
      attrs: Object.fromEntries(
        ['alias', 'did', 'name', 'uri', 'cid'].map(key => [key, {default: ''}]),
      ),
    },
  },
})
const items = new Map([[item.record.name, item]])

function makeState(text: string) {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ])
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, doc.content.size - 1),
  })
}

function convert(state: EditorState) {
  const tr = syncBluemojiEditor(state, items)
  return tr ? state.apply(tr) : state
}

function rawText(state: EditorState) {
  return state.doc.textBetween(
    0,
    state.doc.content.size,
    '\n',
    bluemojiNodeText,
  )
}

it('shows inline images while preserving text, source identity, and the cursor', () => {
  const text = '💙 :blobcat: :blobcat:'
  const state = convert(makeState(text))
  const paragraph = state.doc.firstChild!
  expect(paragraph.child(1).type.name).toBe('bluemoji')
  expect(paragraph.child(1).attrs).toMatchObject({
    alias: ':blobcat:',
    uri: item.uri,
    cid: item.cid,
  })
  expect(rawText(state)).toBe(text)
  expect(state.selection.from).toBe(state.doc.content.size - 1)
  expect(syncBluemojiEditor(state, items)).toBeUndefined()
})

it.each([
  ['\\:blobcat:', false],
  ['\\\\:blobcat:', true],
  ['https://example.com/:blobcat:', false],
  ['[:blobcat:](https://example.com)', false],
  ['\\<:blobcat:>', false],
])('handles protected aliases in %s', (text, expected) => {
  const state = convert(makeState(text))
  const nodes: string[] = []
  state.doc.descendants(node => {
    nodes.push(node.type.name)
  })
  expect(nodes.includes('bluemoji')).toBe(expected)
  expect(rawText(state)).toBe(text)
})

it('reveals the alias when a backslash is inserted before an existing image', () => {
  let state = convert(makeState(':blobcat:'))
  state = state.apply(state.tr.insertText('\\', 1))
  state = convert(state)
  expect(state.doc.firstChild!.firstChild!.isText).toBe(true)
  expect(rawText(state)).toBe('\\:blobcat:')
  state = state.apply(state.tr.delete(1, 2))
  state = convert(state)
  expect(state.doc.firstChild!.firstChild!.type.name).toBe('bluemoji')
})

it('keeps unverified aliases readable and preserves same-name foreign selections', () => {
  const state = makeState(':blobcat: :missing: :blobcat-2:')
  const foreign = {
    ...item,
    did: 'did:plc:another' as typeof item.did,
    uri: item.uri.replace(item.did, 'did:plc:another'),
  }
  const tr = syncBluemojiEditor(
    state,
    new Map([...items, [':blobcat-2:', foreign]]),
  )!
  const result = state.apply(tr)
  expect(rawText(result)).toBe(':blobcat: :missing: :blobcat-2:')
  expect(result.doc.firstChild!.lastChild!.attrs.uri).toBe(foreign.uri)
  expect(tr.getMeta('addToHistory')).toBe(false)
})

it.each([
  ['', true],
  ['hello ', true],
  ['\\', false],
  ['\\\\', true],
  ['https://example.com/', false],
  ['\\<', false],
])('protects shortcode suggestions after %s', (prefix, allowed) => {
  const state = makeState(`${prefix}:ca`)
  expect(isBluemojiSuggestionAllowed(state, prefix.length + 1)).toBe(allowed)
})
