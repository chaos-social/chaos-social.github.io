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
  const IS_DEV = !IS_TESTFLIGHT && !IS_PRODUCTION

  const ASSOCIATED_DOMAINS = [
    'applinks:witchsky.app',
    'applinks:bsky.app',
    // When testing local services, enter an ngrok (et al) domain here. It must use a standard HTTP/HTTPS port.
    ...(IS_DEV || IS_TESTFLIGHT ? [] : []),
  ]

  // const UPDATES_CHANNEL = IS_TESTFLIGHT
  //   ? 'testflight'
  //   : IS_PRODUCTION
  //   ? 'production'
  //   : undefined
  // const UPDATES_ENABLED = !!UPDATES_CHANNEL
  const UPDATES_ENABLED = IS_TESTFLIGHT || IS_PRODUCTION

  const USE_SENTRY = Boolean(process.env.SENTRY_AUTH_TOKEN)

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
      scheme: ['bluesky', 'witchsky'],
      // owner: 'blueskysocial',
      // owner: 'neema.brown',
      runtimeVersion: {
        policy: 'appVersion',
      },
      icon: './assets/app-icons/ios_icon_legacy_light.png',
      userInterfaceStyle: 'automatic',
      primaryColor: '#ED5345',
      newArchEnabled: false,
      ios: {
        supportsTablet: false,
        bundleIdentifier: process.env.WITCHSKY_BUNDLE_ID || 'app.witchsky',
        appleTeamId: process.env.WITCHSKY_APPLE_TEAM_ID || 'B3LX46C5HS',
        config: {
          usesNonExemptEncryption: false,
        },
        icon: IOS_ICON_FILE,
        infoPlist: {
          CADisableMinimumFrameDurationOnPhone: true,
          UIBackgroundModes: ['remote-notification'],
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
          // 'com.apple.developer.device-information.user-assigned-device-name': true,
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
      androidStatusBar: {
        barStyle: 'light-content',
      },
      // Dark nav bar in light mode is better than light nav bar in dark mode
      androidNavigationBar: {
        barStyle: 'light-content',
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
        'expo-video',
        'expo-localization',
        'expo-web-browser',
        [
          'react-native-edge-to-edge',
          {android: {enforceNavigationBarContrast: false}},
        ],
        ...(USE_SENTRY
          ? [
              /** @type {[string, any]} */ ([
                '@sentry/react-native/expo',
                {
                  organization: 'blueskyweb',
                  project: 'app',
                  url: 'https://sentry.io',
                },
              ]),
            ]
          : []),
        [
          'expo-build-properties',
          {
            ios: {
              deploymentTarget: '15.1',
              buildReactNativeFromSource: true,
              ccacheEnabled: IS_DEV,
              extraPods: [
                {
                  name: 'MCEmojiPicker',
                  git: 'https://github.com/bluesky-social/MCEmojiPicker.git',
                  branch: 'main',
                },
              ],
            },
            android: {
              compileSdkVersion: 36,
              targetSdkVersion: 35,
              buildToolsVersion: '35.0.0',
              buildReactNativeFromSource: IS_PRODUCTION,
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
        'react-native-compressor',
        [
          '@bitdrift/react-native',
          {
            networkInstrumentation: true,
          },
        ],
        './plugins/starterPackAppClipExtension/withStarterPackAppClip.js',
        './plugins/withGradleJVMHeapSizeIncrease.js',
        './plugins/withAndroidManifestLargeHeapPlugin.js',
        './plugins/withAndroidManifestFCMIconPlugin.js',
        './plugins/withAndroidManifestIntentQueriesPlugin.js',
        './plugins/withAndroidStylesAccentColorPlugin.js',
        './plugins/withAndroidNoJitpackPlugin.js',
        './plugins/shareExtension/withShareExtensions.js',
        './plugins/notificationsExtension/withNotificationsExtension.js',
        [
          'expo-font',
          {
            fonts: [
              './assets/fonts/inter/InterVariable.woff2',
              './assets/fonts/inter/InterVariable-Italic.woff2',
              './assets/fonts/google-sans-flex/GoogleSansFlex-Regular.ttf',
              // Android only
              './assets/fonts/inter/Inter-Regular.otf',
              './assets/fonts/inter/Inter-Italic.otf',
              './assets/fonts/inter/Inter-Medium.otf',
              './assets/fonts/inter/Inter-MediumItalic.otf',
              './assets/fonts/inter/Inter-SemiBold.otf',
              './assets/fonts/inter/Inter-SemiBoldItalic.otf',
              './assets/fonts/inter/Inter-Bold.otf',
              './assets/fonts/inter/Inter-BoldItalic.otf',
              // Google Sans Flex - Android only
              // 9pt optical size
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Thin.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-ExtraLight.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Light.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Regular.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Medium.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-SemiBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Bold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-ExtraBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_9pt-Black.ttf',
              // 24pt optical size (default)
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Thin.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-ExtraLight.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Light.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Regular.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Medium.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-SemiBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Bold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-ExtraBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_24pt-Black.ttf',
              // 36pt optical size
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Thin.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-ExtraLight.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Light.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Regular.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Medium.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-SemiBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Bold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-ExtraBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_36pt-Black.ttf',
              // 72pt optical size
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Thin.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-ExtraLight.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Light.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Regular.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Medium.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-SemiBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Bold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-ExtraBold.ttf',
              './assets/fonts/google-sans-flex/GoogleSansFlex_72pt-Black.ttf',
              // 120pt optical size
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
        ],
        [
          'expo-splash-screen',
          {
            ios: {
              enableFullScreenImage_legacy: true, // iOS only
              backgroundColor: '#006AFF', // primary_500
              image: './assets/splash/splash.png',
              resizeMode: 'cover',
              dark: {
                enableFullScreenImage_legacy: true, // iOS only
                backgroundColor: '#262220', // primary_900
                image: './assets/splash/splash-dark.png',
                resizeMode: 'cover',
              },
            },
            android: {
              backgroundColor: '#E25C50', // primary_500
              image: './assets/splash/android-splash-logo-white.png',
              imageWidth: 102, // even division of 306px
              dark: {
                backgroundColor: '#ED5345', // primary_900
                image: './assets/splash/android-splash-logo-white.png',
                imageWidth: 102,
              },
            },
          },
        ],
        [
          '@mozzius/expo-dynamic-app-icon',
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
        ['expo-screen-orientation', {initialOrientation: 'PORTRAIT_UP'}],
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
    },
  }
}
