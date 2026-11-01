import {emitSoftReset, listenSoftReset} from './events'

describe('soft reset', () => {
  it('passes the feed through to listeners', () => {
    const seen: (string | undefined)[] = []
    const unlisten = listenSoftReset(feed => seen.push(feed))
    emitSoftReset('following')
    unlisten()
    expect(seen).toEqual(['following'])
  })

  it('emits undefined when no feed is given, so plain resets stay app-wide', () => {
    const seen: (string | undefined)[] = []
    const unlisten = listenSoftReset(feed => seen.push(feed))
    emitSoftReset()
    unlisten()
    expect(seen).toEqual([undefined])
  })

  it('stops delivering after unlisten', () => {
    const fn = jest.fn()
    const unlisten = listenSoftReset(fn)
    emitSoftReset('following')
    unlisten()
    emitSoftReset('following')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
