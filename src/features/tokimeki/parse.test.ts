import {parseTokimekiPollUrl} from './parse'

const DID = 'did:plc:rzjl3bznelq76ukmp6bbwfzw'
const RKEY = '3mzlhqlhwyjev'

describe('parseTokimekiPollUrl', () => {
  test('reads a poll link', () => {
    expect(
      parseTokimekiPollUrl(`https://poll.tokimeki.tech/p/${DID}/${RKEY}`),
    ).toEqual({did: DID, rkey: RKEY})
  })

  test('ignores the options layout hint and trailing slash', () => {
    expect(
      parseTokimekiPollUrl(
        `https://poll.tokimeki.tech/p/${DID}/${RKEY}?options=4`,
      ),
    ).toEqual({did: DID, rkey: RKEY})
    expect(
      parseTokimekiPollUrl(`https://poll.tokimeki.blue/p/${DID}/${RKEY}/`),
    ).toEqual({did: DID, rkey: RKEY})
  })

  test('rejects non-poll pages, other hosts and malformed ids', () => {
    expect(parseTokimekiPollUrl('https://poll.tokimeki.tech/polls')).toBe(
      undefined,
    )
    expect(parseTokimekiPollUrl(`https://example.com/p/${DID}/${RKEY}`)).toBe(
      undefined,
    )
    expect(parseTokimekiPollUrl(`https://poll.tokimeki.tech/p/${DID}`)).toBe(
      undefined,
    )
    expect(
      parseTokimekiPollUrl(`https://poll.tokimeki.tech/p/notadid/${RKEY}`),
    ).toBe(undefined)
    expect(parseTokimekiPollUrl('not a url')).toBe(undefined)
  })
})
