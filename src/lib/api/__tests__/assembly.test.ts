import {assemblyReportUrl, assemblyUrl} from '#/lib/api/assembly'
import {parseEmbedPlayerFromUrl} from '#/lib/strings/embed-player'

jest.mock('#/env', () => mockEnv('https://assembly.blacksky.community'))

function mockEnv(url: string) {
  return {
    ...jest.requireActual<Record<string, unknown>>('#/env'),
    ASSEMBLY_URL: url,
  }
}

describe('assembly links', () => {
  it('builds the conversation and results addresses', () => {
    expect(assemblyUrl('2demo')).toBe(
      'https://assembly.blacksky.community/2demo',
    )
    expect(assemblyReportUrl('r7report')).toBe(
      'https://assembly.blacksky.community/report/r7report',
    )
  })

  it.each(['2demo', '7abcDEF123', '12345', '0zzzzzzzzzzzzzzz'])(
    'links %s where the in-app card finds it',
    value => {
      expect(parseEmbedPlayerFromUrl(assemblyUrl(value))).toStrictEqual({
        type: 'assembly_conversation',
        source: 'assembly',
        playerUri: `https://assembly.blacksky.community/${value}`,
        hideDetails: false,
      })
    },
  )

  it('keeps an identifier inside its path segment', () => {
    expect(assemblyUrl('2demo/../x')).toBe(
      'https://assembly.blacksky.community/2demo%2F..%2Fx',
    )
    expect(assemblyReportUrl('r7?x=1')).toBe(
      'https://assembly.blacksky.community/report/r7%3Fx%3D1',
    )
  })
})

describe('a configured assembly address', () => {
  afterEach(() => {
    jest.resetModules()
    jest.doMock('#/env', () => mockEnv('https://assembly.blacksky.community'))
  })

  it('drops the trailing slash before building addresses', () => {
    jest.resetModules()
    jest.doMock('#/env', () => mockEnv('http://localhost:5000/'))
    const local = jest.requireActual<{
      assemblyUrl: typeof assemblyUrl
      assemblyReportUrl: typeof assemblyReportUrl
    }>('#/lib/api/assembly')

    expect(local.assemblyUrl('2demo')).toBe('http://localhost:5000/2demo')
    expect(local.assemblyReportUrl('r7report')).toBe(
      'http://localhost:5000/report/r7report',
    )
  })
})
