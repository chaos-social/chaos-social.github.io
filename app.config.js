// @ts-check
const pkg = require('./package.json')

/**
 * @param {import('@expo/config-types').ExpoConfig} _config
 * @returns {{ expo: import('@expo/config-types').ExpoConfig }}
 */
module.exports = function (_config) {
  /**
   * App version number. Should be incremented as part of a release cycle.
   */
  const VERSION = pkg.version

  /**
   * Uses built-in Expo env vars
   *
   * @see https://docs.expo.dev/build-reference/variables/#built-in-environment-variables
   */
  const PLATFORM = process.env.EAS_BUILD_PLATFORM ?? 'web'

  const IS_TESTFLIGHT = process.env.EXPO_PUBLIC_ENV === 'testflight'
  const IS_PRODUCTION = process.env.EXPO_PUBLIC_ENV === 'production'
  const IS_E2E = process.env.EXPO_PUBLIC_ENV === 'e2e'
  const IS_DEV = !IS_TESTFLIGHT && !IS_PRODUCTION

  const ASSOCIATED_DOMAINS = [
    'applinks:witchsky.app',
    'applinks:deer.social',
    'applinks:bsky.app',
    'applinks:mu.social',
    'applinks:blacksky.community',
    'applinks:northsky.app',
    // When testing local services, enter an ngrok (et al) domain here. It must use a standard HTTP/HTTPS port.
    ...(IS_DEV || IS_TESTFLIGHT ? [] : []),
  ]

  /*
   * EXPO_PUBLIC_ENV is also an EAS environment secret, which wins over a build
   * profile's env, so profiles opt out of OTA updates with their own flag. A
   * dev client with updates on rejects unsigned manifests from a local Metro.
   */
  const UPDATES_ENABLED =
    (IS_TESTFLIGHT || IS_PRODUCTION) && !process.env.DISABLE_UPDATES

  const USE_SENTRY = Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN)
  const IOS_BUILD_NUMBER = process.env.BSKY_IOS_BUILD_NUMBER || '1'
  const ANDROID_VERSION_CODE = Number.parseInt(
    process.env.BSKY_ANDROID_VERSION_CODE || '1',
    10,
  )

  const IOS_ICON_FILE =
    PLATFORM === 'web' // web build doesn't like .icon files
      ? './assets/app-icons/ios_icon_legacy_light.png'
      : IS_TESTFLIGHT
        ? './assets/app-icons/ios_icon_testflight.icon'
        : './assets/app-icons/ios_icon_default.icon'

  return {
    expo: {
      version: VERSION,
      name: 'Witchsky',
      slug: 'witchsky',
      scheme: ['bluesky', 'witchsky', 'app.witchsky'],
      // owner: 'blueskysocial',
      // owner: 'neema.brown',
      runtimeVersion: {
        policy: 'appVersion',
      },
      icon: './assets/app-icons/ios_icon_legacy_light.png',
      userInterfaceStyle: 'automatic',
      primaryColor: '#ED5345',
      ios: {
        supportsTablet: true,
        bundleIdentifier: process.env.WITCHSKY_BUNDLE_ID || 'app.witchsky',
        appleTeamId: process.env.WITCHSKY_APPLE_TEAM_ID || 'TODO: Xan',
        buildNumber: IOS_BUILD_NUMBER,
        config: {
          usesNonExemptEncryption: false,
        },
        icon: IOS_ICON_FILE,
        infoPlist: {
          UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
          'UISupportedInterfaceOrientations~ipad': [
            'UIInterfaceOrientationPortrait',
            'UIInterfaceOrientationPortraitUpsideDown',
            'UIInterfaceOrientationLandscapeLeft',
            'UIInterfaceOrientationLandscapeRight',
          ],
          CADisableMinimumFrameDurationOnPhone: true,
          UIBackgroundModes: ['remote-notification'],
          NSUserActivityTypes: ['INSendMessageIntent'],
          NSCameraUsageDescription:
            'Used for profile pictures, posts, and other kinds of content.',
          NSMicrophoneUsageDescription:
            'Used for posts and other kinds of content.',
          NSPhotoLibraryAddUsageDescription:
            'Used to save images to your library.',
          NSPhotoLibraryUsageDescription:
            'Used for profile pictures, posts, and other kinds of content',
          CFBundleSpokenName: 'witchsky.app',
          CFBundleLocalizations: [
            'en',
            'an',
            'ast',
            'ca',
            'cs',
            'cy',
            'da',
            'de',
            'el',
            'eo',
            'es',
            'eu',
            'fi',
            'fr',
            'fy',
            'ga',
            'gd',
            'gl',
            'hi',
            'hu',
            'ia',
            'id',
            'it',
            'ja',
            'km',
            'ko',
            'ne',
            'nl',
            'pl',
            'pt-BR',
            'pt-PT',
            'ro',
            'ru',
            'sv',
            'th',
            'tr',
            'uk',
            'vi',
            'yue',
            'zh-Hans',
            'zh-Hant',
          ],
        },
        associatedDomains: ASSOCIATED_DOMAINS,
        entitlements: {
          'com.apple.developer.kernel.increased-memory-limit': true,
          'com.apple.developer.kernel.extended-virtual-addressing': true,
          'com.apple.security.application-groups': process.env
            .WITCHSKY_BUNDLE_ID
            ? `group.${process.env.WITCHSKY_BUNDLE_ID}`
            : 'group.app.witchsky',
          'com.apple.developer.usernotifications.communication': true,
          // 'com.apple.developer.device-information.user-assigned-device-name': true,
          'com.apple.developer.declared-age-range': true,
        },
        privacyManifests: {
          NSPrivacyCollectedDataTypes: [
            {
              NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
              NSPrivacyCollectedDataTypeLinked: false,
              NSPrivacyCollectedDataTypeTracking: false,
              NSPrivacyCollectedDataTypePurposes: [
                'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              ],
            },
            {
              NSPrivacyCollectedDataType:
                'NSPrivacyCollectedDataTypePerformanceData',
              NSPrivacyCollectedDataTypeLinked: false,
              NSPrivacyCollectedDataTypeTracking: false,
              NSPrivacyCollectedDataTypePurposes: [
                'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              ],
            },
            {
              NSPrivacyCollectedDataType:
                'NSPrivacyCollectedDataTypeOtherDiagnosticData',
              NSPrivacyCollectedDataTypeLinked: false,
              NSPrivacyCollectedDataTypeTracking: false,
              NSPrivacyCollectedDataTypePurposes: [
                'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              ],
            },
          ],
          NSPrivacyAccessedAPITypes: [
            {
              NSPrivacyAccessedAPIType:
                'NSPrivacyAccessedAPICategoryFileTimestamp',
              NSPrivacyAccessedAPITypeReasons: ['C617.1', '3B52.1', '0A2A.1'],
            },
            {
              NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
              NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
            },
            {
              NSPrivacyAccessedAPIType:
                'NSPrivacyAccessedAPICategorySystemBootTime',
              NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
            },
            {
              NSPrivacyAccessedAPIType:
                'NSPrivacyAccessedAPICategoryUserDefaults',
              NSPrivacyAccessedAPITypeReasons: ['CA92.1', '1C8F.1'],
            },
          ],
        },
      },
      android: {
        icon: './assets/app-icons/android_icon_legacy_light.png',
        adaptiveIcon: {
          foregroundImage: './assets/icon-android-foreground.png',
          monochromeImage: './assets/icon-android-monochrome.png',
          backgroundColor: '#ED5345',
        },
        googleServicesFile: './google-services.json',
        package: process.env.WITCHSKY_BUNDLE_ID || 'app.witchsky',
        versionCode: Number.isFinite(ANDROID_VERSION_CODE)
          ? ANDROID_VERSION_CODE
          : 1,
        intentFilters: [
          {
            action: 'VIEW',
            autoVerify: true,
            data: [
              {
                scheme: 'https',
                host: 'witchsky.app',
              },
              {
                scheme: 'https',
                host: 'deer.social',
              },
              {
                scheme: 'https',
                host: 'bsky.app',
              },
              {
                scheme: 'https',
                host: 'mu.social',
              },
              {
                scheme: 'https',
                host: 'blacksky.community',
              },
              {
                scheme: 'https',
                host: 'northsky.app',
              },
              ...(IS_DEV
                ? [
                    {
                      scheme: 'http',
                      host: 'localhost:19006',
                    },
                  ]
                : []),
            ],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ],
      },
      web: {
        bundler: 'metro',
        favicon: './assets/favicon.png',
      },
      // updates: {
      //   url: 'https://updates.bsky.app/manifest',
      //   enabled: UPDATES_ENABLED,
      //   fallbackToCacheTimeout: 30000,
      //   codeSigningCertificate: UPDATES_ENABLED
      //     ? './code-signing/certificate.pem'
      //     : undefined,
      //   codeSigningMetadata: UPDATES_ENABLED
      //     ? {
      //         keyid: 'main',
      //         alg: 'rsa-v1_5-sha256',
      //       }
      //     : undefined,
      //   checkAutomatically: 'NEVER',
      //   channel: UPDATES_CHANNEL,
      // },
      updates: {
        url: 'https://updates.bsky.app/manifest',
        enabled: UPDATES_ENABLED,
        fallbackToCacheTimeout: 30000,
        codeSigningCertificate: UPDATES_ENABLED
          ? './code-signing/certificate.pem'
          : undefined,
        codeSigningMetadata: UPDATES_ENABLED
          ? {
              keyid: 'main',
              alg: 'rsa-v1_5-sha256',
            }
          : undefined,
        checkAutomatically: 'NEVER',
      },
      plugins: [
        [
          'expo-dev-client',
          {
            toolsButton: false,
            ...(IS_E2E
              ? {
                  launchMode: 'most-recent',
                  skipOnboarding: true,
                  showMenuAtLaunch: false,
                  ios: {
                    defaultLaunchURL: 'http://localhost:8081',
                  },
                  android: {
                    defaultLaunchURL: 'http://10.0.2.2:8081',
                  },
                }
              : {}),
          },
        ],
        'expo-asset',
        'expo-sharing',
        'expo-video',
        [
          'expo-localization',
          {
            /*
             * React Native 0.88 fixed Android RTL detection, which until then
             * always reported LTR. Opt out so Android keeps rendering LTR like
             * iOS, until RTL layouts get a proper QA pass.
             */
            supportsRTL: false,
          },
        ],
        'expo-web-browser',
        [
          'react-native-nano-icons',
          {
            /*
             * One font per codegen directory under `assets/icons/`, see
             * `scripts/icons/README.md`.
             */
            iconSets: ['ui', 'brands', 'community'].map(lane => ({
              inputDir: `./assets/icons/${lane}`,
              outputDir: './assets/nano-icons/nanoicons',
              fontFamily: `icons-${lane}`,
            })),
          },
        ],
        [
          'react-native-edge-to-edge',
          {android: {enforceNavigationBarContrast: false}},
        ],
        /*
         * Expo runs Gradle mods in reverse registration order. Keep Bitdrift
         * before Sentry so its plugins block is prepended after Sentry's apply
         * statement and remains at the top, as required by Gradle.
         */
        [
          '@bitdrift/react-native',
          {
            networkInstrumentation: true,
          },
        ],
        ...(USE_SENTRY
          ? [
              /** @type {[string, any]} */ ([
                '@sentry/react-native/expo',
                {
                  organization: 'blueskyweb',
                  project: 'app',
                  url: 'https://sentry.io',
                  experimental_android: {
                    enableAndroidGradlePlugin: true,
                  },
                },
              ]),
            ]
          : []),
        [
          'expo-build-properties',
          {
            ios: {
              deploymentTarget: '16.4',
              buildReactNativeFromSource: true,
              ccacheEnabled: IS_DEV,
              cxxLanguageStandard: 'c++23',
              extraPods: [
                {
                  name: 'MCEmojiPicker',
                  git: 'https://github.com/bluesky-social/MCEmojiPicker.git',
                  branch: 'main',
                },
              ],
            },
            android: {
              compileSdkVersion: 37,
              targetSdkVersion: 36,
              buildToolsVersion: '37.0.0',
              buildReactNativeFromSource: true,
              enableMinifyInReleaseBuilds: true,
            },
          },
        ],
        [
          'expo-notifications',
          {
            icon: './assets/icon-android-notification.png',
            color: '#ED5345',
            sounds: PLATFORM === 'ios' ? ['assets/dm.aiff'] : ['assets/dm.mp3'],
          },
        ],
        './plugins/starterPackAppClipExtension/withStarterPackAppClip.js',
        './plugins/withGradleJVMHeapSizeIncrease.js',
        './plugins/withAndroidManifestLargeHeapPlugin.js',
        './plugins/withAndroidManifestFCMIconPlugin.js',
        './plugins/withAndroidManifestIntentQueriesPlugin.js',
        './plugins/withAndroidManifestOptionalCameraPlugin.js',
        './plugins/withAndroidStylesAccentColorPlugin.js',
        './plugins/withAndroidNoJitpackPlugin.js',
        './plugins/withAndroidPreparedTextLayoutPlugin.js',
        './plugins/withAndroidComposeVersion.js',
        './plugins/shareExtension/withShareExtensions.js',
        './plugins/notificationsExtension/withNotificationsExtension.js',
        [
          'expo-font',
          {
            ios: {
              /*
               * Uncompressed TTF rather than WOFF2: iOS decompresses WOFF2
               * fonts on every launch, which took ~200 ms of the startup
               * critical path. These are the same Inter 4.001 fonts as the
               * WOFF2 files used on web.
               */
              fonts: [
                './assets/fonts/inter/InterVariable.ttf',
                './assets/fonts/inter/InterVariable-Italic.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex-Regular.ttf',
              ],
            },
            android: {
              fonts: [
                './assets/fonts/inter/InterVariable.woff2',
                './assets/fonts/inter/InterVariable-Italic.woff2',
                './assets/fonts/inter/Inter-Regular.otf',
                './assets/fonts/inter/Inter-Italic.otf',
                './assets/fonts/inter/Inter-Medium.otf',
                './assets/fonts/inter/Inter-MediumItalic.otf',
                './assets/fonts/inter/Inter-SemiBold.otf',
                './assets/fonts/inter/Inter-SemiBoldItalic.otf',
                './assets/fonts/inter/Inter-Bold.otf',
                './assets/fonts/inter/Inter-BoldItalic.otf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Thin.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-ExtraLight.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Light.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Regular.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Medium.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-SemiBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Bold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-ExtraBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Black.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Thin.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-ExtraLight.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Light.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Regular.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Medium.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-SemiBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Bold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-ExtraBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Black.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Thin.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-ExtraLight.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Light.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Regular.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Medium.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-SemiBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Bold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-ExtraBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Black.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Thin.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-ExtraLight.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Light.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Regular.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Medium.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-SemiBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Bold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-ExtraBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Black.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Thin.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-ExtraLight.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Light.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Regular.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Medium.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-SemiBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Bold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-ExtraBold.ttf',
                './assets/fonts/google-sans-flex/GoogleSansFlex_120pt-Black.ttf',
              ],
            },
          },
        ],
        [
          'expo-splash-screen',
          {
            ios: {
              backgroundColor: '#fefbfb',
              image: './assets/splash/witchsky.png',
              resizeMode: 'contain',
              dark: {
                backgroundColor: '#281c1c',
                image: './assets/splash/witchsky.png',
                resizeMode: 'contain',
              },
            },
            android: {
              backgroundColor: '#fefbfb',
              image: './assets/splash/witchsky.png',
              imageWidth: 102, // even division of 306px
              dark: {
                backgroundColor: '#281c1c',
                image: './assets/splash/witchsky.png',
                imageWidth: 102,
              },
            },
          },
        ],
        [
          '@bsky.app/expo-dynamic-app-icon',
          {
            /**
             * Default set
             */
            default_light: {
              ios: './assets/app-icons/ios_icon_legacy_light.png',
              android: './assets/app-icons/android_icon_legacy_light.png',
              prerendered: true,
            },
            default_dark: {
              ios: './assets/app-icons/ios_icon_legacy_dark.png',
              android: './assets/app-icons/android_icon_legacy_dark.png',
              prerendered: true,
            },

            /**
             * Bluesky+ core set
             */
            // core_aurora: {
            //   ios: './assets/app-icons/ios_icon_core_aurora.png',
            //   android: './assets/app-icons/android_icon_core_aurora.png',
            //   prerendered: true,
            // },
            // core_bonfire: {
            //   ios: './assets/app-icons/ios_icon_core_bonfire.png',
            //   android: './assets/app-icons/android_icon_core_bonfire.png',
            //   prerendered: true,
            // },
            // core_sunrise: {
            //   ios: './assets/app-icons/ios_icon_core_sunrise.png',
            //   android: './assets/app-icons/android_icon_core_sunrise.png',
            //   prerendered: true,
            // },
            // core_sunset: {
            //   ios: './assets/app-icons/ios_icon_core_sunset.png',
            //   android: './assets/app-icons/android_icon_core_sunset.png',
            //   prerendered: true,
            // },
            // core_midnight: {
            //   ios: './assets/app-icons/ios_icon_core_midnight.png',
            //   android: './assets/app-icons/android_icon_core_midnight.png',
            //   prerendered: true,
            // },
            // core_flat_blue: {
            //   ios: './assets/app-icons/ios_icon_core_flat_blue.png',
            //   android: './assets/app-icons/android_icon_core_flat_blue.png',
            //   prerendered: true,
            // },
            // core_flat_white: {
            //   ios: './assets/app-icons/ios_icon_core_flat_white.png',
            //   android: './assets/app-icons/android_icon_core_flat_white.png',
            //   prerendered: true,
            // },
            // core_flat_black: {
            //   ios: './assets/app-icons/ios_icon_core_flat_black.png',
            //   android: './assets/app-icons/android_icon_core_flat_black.png',
            //   prerendered: true,
            // },
            // core_classic: {
            //   ios: './assets/app-icons/ios_icon_core_classic.png',
            //   android: './assets/app-icons/android_icon_core_classic.png',
            //   prerendered: true,
            // },
          },
        ],
        ['expo-screen-orientation'],
        ['expo-location'],
        [
          'expo-contacts',
          {
            contactsPermission:
              'I agree to allow Bluesky to use my contacts for friend discovery until I opt out.',
          },
        ],
      ],
      extra: {
        eas: {
          build: {
            experimental: {
              ios: {
                // appExtensions: [
                //   {
                //     targetName: 'Share-with-Bluesky',
                //     bundleIdentifier: env.WITCHSKY_BUNDLE_ID ? `${env.WITCHSKY_BUNDLE_ID}.Share-with-Bluesky` : 'app.witchsky.Share-with-Bluesky',
                //     entitlements: {
                //       'com.apple.security.application-groups': [
                //         process.env.WITCHSKY_BUNDLE_ID ? `group.${process.env.WITCHSKY_BUNDLE_ID}` : 'group.app.witchsky',
                //       ],
                //     },
                //   },
                //   {
                //     targetName: 'BlueskyNSE',
                //     bundleIdentifier: process.env.WITCHSKY_BUNDLE_ID ? `${process.env.WITCHSKY_BUNDLE_ID}.BlueskyNSE` : 'app.witchsky.BlueskyNSE',
                //     entitlements: {
                //       'com.apple.security.application-groups': [
                //         process.env.WITCHSKY_BUNDLE_ID ? `group.${process.env.WITCHSKY_BUNDLE_ID}` : 'group.app.witchsky',
                //       ],
                //     },
                //   },
                //   {
                //     targetName: 'BlueskyClip',
                //     bundleIdentifier: process.env.WITCHSKY_BUNDLE_ID ? `${process.env.WITCHSKY_BUNDLE_ID}.AppClip` : 'app.witchsky.AppClip',
                //   },
                // ],
              },
            },
          },
          projectId: 'da056e41-38f9-4fee-a534-b9c5891f9c8d',
        },
      },
      experiments: {
        baseUrl: '/static',
        buildCacheProvider: 'eas',
      },
    },
  }
}
