import {swapInAnonThread} from './swapInAnonThread'

const BLOCKED = 'app.bsky.unspecced.defs#threadItemBlocked'
const POST = 'app.bsky.unspecced.defs#threadItemPost'

function blocked(uri: string, depth: number) {
  return {
    uri,
    depth,
    value: {$type: BLOCKED, author: {did: 'did:plc:alice'}},
  } as never
}

function post(uri: string, depth: number) {
  return {uri, depth, value: {$type: POST, post: {uri}}} as never
}

describe('swapInAnonThread', () => {
  it('is a no-op without an anonymous thread', () => {
    const thread = [blocked('a', 0), post('b', 0)]
    const result = swapInAnonThread(thread, undefined)
    expect(result.thread).toBe(thread)
    expect(result.swapped.size).toBe(0)
  })

  it('replaces a blocked item and keeps its signed-in depth', () => {
    const result = swapInAnonThread(
      [blocked('a', -2), post('b', 0)],
      [post('a', 0)],
    )
    expect(result.thread[0].value.$type).toBe(POST)
    expect(result.thread[0].depth).toBe(-2)
    expect(result.swapped).toEqual(new Set(['a']))
  })

  it('leaves a blocked item alone when the anonymous read lacks it', () => {
    const result = swapInAnonThread([blocked('a', 0)], [post('b', 0)])
    expect(result.thread[0].value.$type).toBe(BLOCKED)
    expect(result.swapped.size).toBe(0)
  })

  it('does not replace a normal post', () => {
    const result = swapInAnonThread([post('a', 0)], [post('a', 0)])
    expect(result.thread[0].value.$type).toBe(POST)
    expect(result.swapped.size).toBe(0)
  })
})
