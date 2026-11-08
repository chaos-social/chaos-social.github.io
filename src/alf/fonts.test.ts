import {applyFonts, type MutableTextStyle} from './fonts.shared'

jest.mock('#/env', () => ({IS_ANDROID: false, IS_WEB: false}))

describe('applyFonts', () => {
  it('adds letter spacing to the system font by default', () => {
    const style: MutableTextStyle = {}
    applyFonts(style, 'system')
    expect(style.letterSpacing).toBe(0.25)
  })

  it('leaves the system font alone when letter spacing is disabled', () => {
    const style: MutableTextStyle = {}
    applyFonts(style, 'system', false)
    expect(style.letterSpacing).toBeUndefined()
    expect(style.fontFamily).toBeUndefined()
  })

  it('never adds letter spacing to the theme font', () => {
    const style: MutableTextStyle = {}
    applyFonts(style, 'theme', true)
    expect(style.fontFamily).toBe('InterVariable')
    expect(style.letterSpacing).toBeUndefined()
  })
})
