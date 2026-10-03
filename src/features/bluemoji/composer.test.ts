import {RichText} from '@bsky/sdk/richtext'

import {
  composerReducer,
  createComposerState,
} from '#/view/com/composer/state/composer'
import {item} from '#/features/bluemoji/__tests__/fixtures'

jest.unmock('multiformats/cid')
jest.mock('#/state/gallery', () => ({createInitialImages: jest.fn()}))
jest.mock('#/logger', () => ({logger: {warn: jest.fn()}}))
jest.mock('#/state/queries/postgate/util', () => ({
  createPostgateRecord: jest.fn(() => ({})),
}))
jest.mock('#/state/queries/threadgate', () => ({
  threadgateRecordToAllowUISetting: jest.fn(() => []),
}))

function createState() {
  return createComposerState({
    initText: undefined,
    initMention: undefined,
    initImageUris: undefined,
    initQuoteUri: undefined,
    initInteractionSettings: undefined,
  })
}

it('preserves a selected emoji owner and record reference while editing text', () => {
  const initial = createState()
  const postId = initial.thread.posts[0].id
  const selected = composerReducer(initial, {
    type: 'update_post',
    postId,
    postAction: {type: 'register_bluemoji', item},
  })
  const edited = composerReducer(selected, {
    type: 'update_post',
    postId,
    postAction: {
      type: 'update_richtext',
      richtext: new RichText({text: `${item.record.name}!`}),
    },
  })
  expect(edited.thread.posts[0].bluemoji?.[item.record.name]).toEqual({
    did: item.did,
    name: item.record.name,
    record: {uri: item.uri, cid: item.cid},
  })
  expect(edited.isDirty).toBe(true)
})

it('does not overwrite an earlier selection when another item shares its alias', () => {
  const initial = createState()
  const postId = initial.thread.posts[0].id
  const selected = composerReducer(initial, {
    type: 'update_post',
    postId,
    postAction: {type: 'register_bluemoji', item},
  })
  const second = {...item, uri: `${item.uri}-other`}
  const updated = composerReducer(selected, {
    type: 'update_post',
    postId,
    postAction: {type: 'register_bluemoji', item: second},
  })
  expect(updated.thread.posts[0].bluemoji?.[':blobcat:']?.record?.uri).toBe(
    item.uri,
  )
  expect(updated.thread.posts[0].bluemoji?.[':blobcat-2:']?.record?.uri).toBe(
    second.uri,
  )
})
