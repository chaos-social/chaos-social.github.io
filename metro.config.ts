// Learn more https://docs.expo.io/guides/customizing-metro
import {getBundleModeMetroConfig} from 'react-native-worklets/bundleMode/index.js'
import {type CustomResolver} from '@expo/metro/metro-resolver'
import {getDefaultConfig} from '@expo/metro-config'
import {getSentryExpoConfig} from '@sentry/react-native/metro.js'

let config = getSentryExpoConfig(import.meta.dirname, {
  // TODO: confirm this doesn't break anything when we switch to metro web
  includeWebReplay: false,
  /*
   * Must stay true on Windows: @sentry/react-native decides whether to stub
   * the feedbackSync/Async wrappers with `originModulePath.includes(
   * '@sentry/browser')`, which never matches a backslash path. The wrappers
   * then call `buildFeedbackIntegration()` at module evaluation time on an
   * empty module and the web bundle throws. Keep feedback bundled instead.
   */
  includeWebFeedback: true,
  annotateReactComponents: {
    textComponentNames: ['Text', 'ButtonText'],
  },
  getDefaultConfig: (projectRoot, options) => {
    const config = getDefaultConfig(projectRoot, options)

    if (typeof process.env.RN_SRC_EXT === 'string') {
      // inject `.e2e.ts` and `.e2e.tsx` into the sourceExts when running tests)
      config.resolver.sourceExts.unshift(...process.env.RN_SRC_EXT.split(','))
    }

    config.resolver.assetExts = [...config.resolver.assetExts, 'woff2']

    /*
     * Expo sets this to null, which disables Watchman, so Metro falls back to
     * one fs.watch per directory. That watcher pins a core when a build output
     * tree is rewritten underneath it (see blockList below). Watchman is
     * installed on this machine; when it is missing Metro already degrades to
     * the same fallback on its own.
     */
    // @ts-expect-error readonly property
    config.resolver.useWatchman = true

    /*
     * Build output is not part of the app graph, but Metro crawls and watches
     * it anyway. `pnpm build-web` rewrites these trees while the dev server is
     * running; the delete/recreate churn makes Windows report mangled
     * filenames, and every failed stat in the fallback watcher scans its whole
     * directory registry. That pins Metro at 100% CPU until it is restarted.
     *
     * The optional root prefix lets one pattern cover both the absolute paths
     * used to prune directories and the project-relative paths used for
     * crawled and watched files. Anchoring to the root keeps nested `dist`
     * folders in node_modules (e.g. `hls.js/dist`) resolvable.
     */
    const projectRootPattern = projectRoot
      .split(/[\\/]/)
      .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\\\/]')
    config.resolver.blockList = [
      ...(Array.isArray(config.resolver.blockList)
        ? config.resolver.blockList
        : [config.resolver.blockList]),
      new RegExp(
        `^(?:${projectRootPattern}[\\\\/])?(?:app-build|bskyweb[\\\\/]static|dist)(?:[\\\\/]|$)`,
      ),
    ]

    if (config.resolver.resolveRequest) {
      throw Error('Update this override because it is conflicting now.')
    }

    if (process.env.BSKY_PROFILE) {
      // @ts-expect-error readonly property
      config.cacheVersion += ':PROFILE'
    }

    const resolver: CustomResolver = (context, moduleName, platform) => {
      if (
        platform === 'web' &&
        /^react-native-gesture-handler(\/|$)/.test(moduleName)
      ) {
        throw new Error(
          `react-native-gesture-handler must not be imported on web (requested from ${context.originModulePath})`,
        )
      }
      /*
       * react-native-webview has no web implementation (its fallback renders
       * "does not support this platform"), so swap in react-native-web-webview
       * to keep external media embeds working. Mirrors the old webpack alias.
       */
      if (platform === 'web' && moduleName === 'react-native-webview') {
        return context.resolveRequest(
          context,
          'react-native-web-webview',
          platform,
        )
      }
      if (
        process.env.BSKY_PROFILE &&
        moduleName.endsWith('ReactNativeRenderer-prod')
      ) {
        return context.resolveRequest(
          context,
          moduleName.replace('-prod', '-profiling'),
          platform,
        )
      }
      return context.resolveRequest(context, moduleName, platform)
    }

    // @ts-expect-error readonly property
    config.resolver.resolveRequest = resolver

    config.transformer.getTransformOptions = () =>
      Promise.resolve({
        transform: {
          experimentalImportSupport: true,
          inlineRequires: true as false, // ??? typescript why?
        },
      })

    return config as unknown as Record<string, unknown>
  },
})

config = getBundleModeMetroConfig(config)

export default config
