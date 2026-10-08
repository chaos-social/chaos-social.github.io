const createAppConfig = require('../app.config')

it.each(['mu.social', 'blacksky.community', 'northsky.app'])(
  'registers %s on iOS and Android',
  host => {
    const {expo} = createAppConfig({})

    expect(expo.ios.associatedDomains).toContain(`applinks:${host}`)
    expect(expo.android.intentFilters).toContainEqual(
      expect.objectContaining({
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: expect.arrayContaining([{scheme: 'https', host}]),
      }),
    )
  },
)
