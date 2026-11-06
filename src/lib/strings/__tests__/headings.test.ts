import {describe, expect, it, jest} from '@jest/globals'

/*
 * bskyTitle appends the configured product name. Mock #/env so the test does
 * not depend on the bundle-time EXPO_PUBLIC_APP_NAME value.
 */
let mockAppName = 'Witchsky'
jest.mock('#/env', () => ({
  get APP_NAME() {
    return mockAppName
  },
}))

import {bskyTitle} from '../headings'

describe('bskyTitle', () => {
  it('appends the configured app name', () => {
    mockAppName = 'Witchsky'
    expect(bskyTitle('Home')).toBe('Home — Witchsky')
  })

  it('follows EXPO_PUBLIC_APP_NAME', () => {
    mockAppName = 'Hocus'
    expect(bskyTitle('Home')).toBe('Home — Hocus')
  })

  it('prefixes the unread count', () => {
    mockAppName = 'Hocus'
    expect(bskyTitle('Chat', '3')).toBe('(3) Chat — Hocus')
  })
})
