import {defaults, tryParse, tryStringify} from '../schema'
import {normalizeData} from '../util'

describe('persisted schema helpers', () => {
  const partialState = {
    colorMode: 'system',
    darkTheme: 'dim',
    colorScheme: 'material3',
    hue: 0,
    session: {accounts: []},
    reminders: {},
    languagePrefs: defaults.languagePrefs,
    requireAltTextEnabled: true,
    invites: {copiedInvites: []},
    onboarding: {step: 'Home'},
    mutedThreads: [],
    translationServicePreference: 'google',
    postReplacement: {
      enabled: false,
      postName: 'skeet',
      postsName: 'skeets',
    },
  }

  it.each(['en,fil', 'en,fil,ja'])(
    'preserves the multilingual post default %s across restarts',
    postLanguage => {
      const parsed = tryParse(
        JSON.stringify({
          ...partialState,
          languagePrefs: {
            ...defaults.languagePrefs,
            primaryLanguage: 'fr',
            postLanguage,
          },
        }),
      )
      const raw = tryStringify(normalizeData(parsed!))
      const restored = normalizeData(tryParse(raw!)!)

      expect(restored.languagePrefs.postLanguage).toBe(postLanguage)
      expect(restored.languagePrefs.primaryLanguage).toBe('fr')
    },
  )

  it.each([
    ['en-US,fil,en-GB,ja,de', 'en,fil,ja'],
    ['', defaults.languagePrefs.postLanguage],
  ])('normalizes the legacy post default %s to %s', (saved, expected) => {
    const restored = normalizeData({
      ...defaults,
      languagePrefs: {...defaults.languagePrefs, postLanguage: saved},
    })

    expect(restored.languagePrefs.postLanguage).toBe(expected)
  })

  it('applies schema defaults when reading partial data', () => {
    const parsed = tryParse(JSON.stringify(partialState))

    expect(parsed?.material3Accent).toBe('#ee6300')
    expect(parsed?.material3Style).toBe('TONAL_SPOT')
  })

  it.each([false, true, 'sharp'] as const)(
    'preserves the %s button and avatar shapes across restarts',
    shape => {
      const parsed = tryParse(
        JSON.stringify({
          ...partialState,
          enableSquareButtons: shape,
          enableSquareAvatars: shape,
        }),
      )
      const raw = tryStringify(normalizeData(parsed!))
      const restored = normalizeData(tryParse(raw!)!)
      expect(restored.enableSquareButtons).toBe(shape)
      expect(restored.enableSquareAvatars).toBe(shape)
      expect(restored.requireAltTextEnabled).toBe(true)
    },
  )

  it('stores button and avatar shapes independently', () => {
    const parsed = tryParse(
      JSON.stringify({
        ...partialState,
        enableSquareButtons: 'sharp',
        enableSquareAvatars: false,
      }),
    )
    const raw = tryStringify(normalizeData(parsed!))
    const restored = normalizeData(tryParse(raw!)!)
    expect(restored.enableSquareButtons).toBe('sharp')
    expect(restored.enableSquareAvatars).toBe(false)
  })

  it('defaults follow confirmation off even when legacy confirmation was enabled', () => {
    const parsed = tryParse(
      JSON.stringify({...partialState, confirmFollowUnfollow: true}),
    )

    expect(parsed).toBeDefined()
    expect(normalizeData(parsed!).confirmFollow).toBe(false)
  })

  it('preserves an explicit follow confirmation preference', () => {
    const parsed = tryParse(
      JSON.stringify({...partialState, confirmFollow: true}),
    )
    const raw = tryStringify(normalizeData(parsed!))

    expect(raw).toBeDefined()
    expect(tryParse(raw!)?.confirmFollow).toBe(true)
  })

  it('defaults to system emoji and migrates the legacy Noto preference', () => {
    const existing = tryParse(JSON.stringify(partialState))
    expect(normalizeData(existing!).emojiFont).toBe('system')

    const enabled = tryParse(
      JSON.stringify({...partialState, useNotoColorEmoji: true}),
    )
    expect(normalizeData(enabled!).emojiFont).toBe('noto')
    expect(enabled).not.toHaveProperty('useNotoColorEmoji')
    expect(tryStringify(normalizeData(enabled!))).not.toContain(
      'useNotoColorEmoji',
    )
  })

  it.each(['system', 'noto', 'twemoji'] as const)(
    'preserves %s emoji across restarts and overrides the legacy Noto preference',
    emojiFont => {
      const parsed = tryParse(
        JSON.stringify({
          ...partialState,
          useNotoColorEmoji: true,
          emojiFont,
        }),
      )
      const raw = tryStringify(normalizeData(parsed!))
      expect(normalizeData(tryParse(raw!)!).emojiFont).toBe(emojiFont)
    },
  )

  it('preserves hydrated defaults on later writes', () => {
    const hydrated = tryParse(JSON.stringify(partialState))
    const raw = tryStringify(hydrated!)

    expect(raw).toBeDefined()

    const reparsed = JSON.parse(raw!)
    expect(reparsed.material3Accent).toBe('#ee6300')
    expect(reparsed.material3Style).toBe('TONAL_SPOT')
  })

  it('fills optional settings from defaults object when absent from storage', () => {
    const parsed = tryParse(JSON.stringify(partialState))

    expect(parsed).toBeDefined()
    expect(normalizeData(parsed!).thumbnailFormat).toBe(
      defaults.thumbnailFormat,
    )
    expect(normalizeData(parsed!).downloadFormat).toBe(defaults.downloadFormat)
    expect(normalizeData(parsed!).notificationsTabBadgeDisplay).toBe('exact')
    expect(normalizeData(parsed!).chatsTabBadgeDisplay).toBe('exact')
    expect(normalizeData(parsed!).altTextAiProvider).toBe('none')
    expect(normalizeData(parsed!).forceAltTextEnabled).toBe(false)
    expect(normalizeData(parsed!).requireAltTextEnabled).toBe(true)
  })

  it('preserves external embed prefs when defaults object is empty', () => {
    const parsed = tryParse(JSON.stringify(partialState))

    expect(parsed).toBeDefined()
    expect(
      normalizeData({...parsed!, externalEmbeds: {youtube: 'show'}})
        .externalEmbeds,
    ).toEqual({youtube: 'show'})
  })

  it('defaults absent image formats to the app server formats', () => {
    const parsed = tryParse(JSON.stringify(partialState))
    const normalized = normalizeData(parsed!)

    expect(defaults.thumbnailFormat).toBe('default')
    expect(defaults.fullsizeFormat).toBe('default')
    expect(normalized.thumbnailFormat).toBe('default')
    expect(normalized.fullsizeFormat).toBe('default')
    expect(normalized.downloadFormat).toBe('original')
  })

  it('migrates saved WebP formats to app server defaults', () => {
    const parsed = tryParse(
      JSON.stringify({
        ...partialState,
        thumbnailFormat: 'webp',
        fullsizeFormat: 'webp',
      }),
    )
    const normalized = normalizeData(parsed!)

    expect(normalized.thumbnailFormat).toBe('default')
    expect(normalized.fullsizeFormat).toBe('default')
    expect(normalized.imageFormatDefaultsVersion).toBe(1)
  })

  it.each([
    ['webp', 'png', 'default', 'png'],
    ['original', 'webp', 'original', 'default'],
    ['avif', 'jpeg', 'avif', 'jpeg'],
  ])(
    'preserves explicit formats when migrating %s thumbnails and %s full-size images',
    (thumbnailFormat, fullsizeFormat, expectedThumbnail, expectedFullsize) => {
      const parsed = tryParse(
        JSON.stringify({...partialState, thumbnailFormat, fullsizeFormat}),
      )
      const normalized = normalizeData(parsed!)

      expect(normalized.thumbnailFormat).toBe(expectedThumbnail)
      expect(normalized.fullsizeFormat).toBe(expectedFullsize)
    },
  )

  it('preserves legacy high-quality PNG preferences', () => {
    const parsed = tryParse(
      JSON.stringify({...partialState, highQualityImages: true}),
    )
    const normalized = normalizeData(parsed!)

    expect(normalized.thumbnailFormat).toBe('png')
    expect(normalized.fullsizeFormat).toBe('png')
  })

  it('preserves WebP selections made after the default migration across restarts', () => {
    const parsed = tryParse(
      JSON.stringify({
        ...partialState,
        thumbnailFormat: 'webp',
        fullsizeFormat: 'webp',
      }),
    )
    const migrated = normalizeData(parsed!)
    const selected = normalizeData({
      ...migrated,
      thumbnailFormat: 'webp',
      fullsizeFormat: 'webp',
    })
    const raw = tryStringify(selected)
    const restarted = normalizeData(tryParse(raw!)!)

    expect(restarted.thumbnailFormat).toBe('webp')
    expect(restarted.fullsizeFormat).toBe('webp')
  })

  it('migrates legacy disable metrics booleans to display modes', () => {
    const parsed = tryParse(
      JSON.stringify({
        ...partialState,
        disableLikesMetrics: true,
        disableFollowedByMetrics: true,
      }),
    )

    const normalized = normalizeData(parsed!)
    expect(normalized.likesMetricsDisplay).toBe('hidden')
    expect(normalized.followedByMetricsDisplay).toBe('hidden')
    expect(normalized.repostsMetricsDisplay).toBe('visible')
  })

  it('migrates legacy accessible display mode to lite', () => {
    const parsed = tryParse(
      JSON.stringify({
        ...partialState,
        likesMetricsDisplay: 'accessible',
        followedByMetricsDisplay: 'accessible',
      }),
    )

    expect(parsed).toBeDefined()
    expect(parsed!.likesMetricsDisplay).toBe('lite')
    expect(parsed!.followedByMetricsDisplay).toBe('lite')
  })

  it('migrates legacy followed-by names display mode to visible', () => {
    const parsed = tryParse(
      JSON.stringify({
        ...partialState,
        followedByMetricsDisplay: 'names',
      }),
    )

    expect(parsed).toBeDefined()
    expect(parsed!.followedByMetricsDisplay).toBe('visible')
  })

  it('migrates the notification dot display to both tab badges', () => {
    const parsed = tryParse(
      JSON.stringify({...partialState, notificationDotDisplay: 'visible'}),
    )

    const normalized = normalizeData(parsed!)
    expect(normalized.notificationsTabBadgeDisplay).toBe('visible')
    expect(normalized.chatsTabBadgeDisplay).toBe('visible')
  })
})
