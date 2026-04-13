import path from 'node:path'
import rspack from '@rspack/core'
import {RspackManifestPlugin} from 'rspack-manifest-plugin'
import {sentryWebpackPlugin} from '@sentry/webpack-plugin'
import {version} from './package.json'

const GENERATE_STATS = process.env.GENERATE_STATS === '1'
const isProduction = process.env.NODE_ENV === 'production'

// Collect all EXPO_PUBLIC_* env vars so they're available at build time,
// mirroring what @expo/webpack-config does automatically.
const expoPublicEnv = Object.fromEntries(
  Object.entries(process.env)
    .filter(([key]) => key.startsWith('EXPO_PUBLIC_'))
    .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
)

// Packages in node_modules that ship untranspiled JSX/Flow/modern syntax
// and need to be run through babel-loader.
const TRANSPILE_MODULES = [
  'react-native',
  'react-native-web',
  '@react-native',
  '@react-native-community',
  'expo',
  '@expo',
  '@unimodules',
  'unimodules',
  '@discord',
  'react-navigation',
  '@react-navigation',
  'native-base',
  'normalize-url',
  'react-native-svg',
  '@sentry/react-native',
  'sentry-expo',
  'bcp-47-match',
  'nanoid',
  'react-native-web-webview',
]

/**
 * Test function for babel-loader include.
 * Transpiles all source files + specific node_modules packages.
 */
function shouldTranspile(filePath: string) {
  // Always transpile source files
  if (!filePath.includes('node_modules')) {
    return true
  }
  // Transpile matching node_modules packages
  return TRANSPILE_MODULES.some(mod => {
    const sep = path.sep === '\\' ? '\\\\' : '/'
    const pattern = new RegExp(`node_modules${sep}${mod.replace('/', sep)}`)
    return pattern.test(filePath)
  })
}

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',

  entry: {
    main: path.resolve(__dirname, 'index.web.js'),
  },

  output: {
    path: path.resolve(__dirname, 'web-build'),
    filename: isProduction
      ? 'static/js/[name].[contenthash:8].js'
      : 'static/js/[name].js',
    chunkFilename: isProduction
      ? 'static/js/[name].[contenthash:8].chunk.js'
      : 'static/js/[name].chunk.js',
    assetModuleFilename: 'static/media/[name].[hash:8][ext]',
    publicPath: isProduction ? 'auto' : '/',
    clean: true,
  },

  resolve: {
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.web.jsx',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    alias: {
      // Path alias for src/
      '#': path.resolve(__dirname, 'src'),
      // React Native Web
      'react-native$': 'react-native-web',
      // Internal RN module mappings for compatibility
      'react-native/Libraries/Components/View/ViewStylePropTypes$':
        'react-native-web/dist/exports/View/ViewStylePropTypes',
      'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
      'react-native/Libraries/vendor/emitter/EventEmitter$':
        'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
      'react-native/Libraries/EventEmitter/NativeEventEmitter$':
        'react-native-web/dist/vendor/react-native/NativeEventEmitter',
      // Webview shim
      'react-native-webview': 'react-native-web-webview',
      // Crypto shim for expo-modules-core
      crypto: path.resolve(__dirname, 'src/platform/crypto.ts'),
      // Force ESM version of unicode-segmenter
      'unicode-segmenter/grapheme': require
        .resolve('unicode-segmenter/grapheme')
        .replace(/\.cjs$/, '.js'),
      // Block packages that should not load on web
      'react-native-gesture-handler': false,
      '@sentry-internal/replay': false,
    },
    mainFields: ['browser', 'module', 'main'],
    // Allow importing without file extensions in ESM packages
    fullySpecified: false,
  },

  module: {
    rules: [
      // Disable fullySpecified for ESM packages that import without extensions
      // (e.g. react-navigation importing react-native-web/dist/exports/Platform)
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.[jt]sx?$/,
        include: shouldTranspile,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            sourceType: 'unambiguous',
          },
        },
      },
      // HTML file loader for react-native-web-webview's postMock.html
      {
        test: /postMock\.html$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/[name][ext]',
        },
      },
      // CSS support — imported from JS/TS files
      {
        test: /\.css$/,
        type: 'css/auto',
      },
      // Image assets
      {
        test: /\.(bmp|gif|jpe?g|png|svg|avif|webp)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8KB
          },
        },
      },
      // Font assets
      {
        test: /\.(woff|woff2|otf|ttf|eot)$/i,
        type: 'asset/resource',
      },
    ],
  },

  plugins: [
    new rspack.HtmlRspackPlugin({
      template: path.resolve(__dirname, 'web/index.html'),
      inject: true,
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        // Serve fonts at /static/fonts/ with stable names
        {from: 'web/static/fonts', to: 'static/fonts'},
        // Serve the global stylesheet
        {from: 'src/style.css', to: 'static/style.css'},
      ],
    }),
    new rspack.DefinePlugin({
      __DEV__: JSON.stringify(!isProduction),
      'process.env.NODE_ENV': JSON.stringify(
        isProduction ? 'production' : 'development',
      ),
      'process.env.JEST_WORKER_ID': JSON.stringify(undefined),
      'process.env.LIVE_EVENTS_DEV_URL': JSON.stringify(
        process.env.LIVE_EVENTS_DEV_URL || '',
      ),
      'process.env.APP_CONFIG_DEV_URL': JSON.stringify(
        process.env.APP_CONFIG_DEV_URL || '',
      ),
      // provide sensible defaults for env vars that the web build expects but aren't defined in the environment
      'process.env.EXPO_PUBLIC_ENV': JSON.stringify(
        isProduction ? 'production' : 'development',
      ),
      'process.env.EAS_BUILD_PLATFORM': JSON.stringify('web'),
      'process.env.SENTRY_AUTH_TOKEN': 'undefined',
      'process.env.EXPO_PUBLIC_RELEASE_VERSION': 'undefined',
      'process.env.EXPO_PUBLIC_LOG_LEVEL': '"debug"',
      'process.env.EXPO_PUBLIC_LOG_DEBUG': '"*"',
      'process.env.EXPO_PUBLIC_OAUTH_BASE_URL': 'undefined',
      'process.env.EXPO_PUBLIC_OAUTH_CLIENT_NAME': 'undefined',
      'process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER': 'undefined',
      'process.env.EXPO_PUBLIC_BUNDLE_DATE': 'undefined',
      'process.env.EXPO_PUBLIC_SENTRY_DSN': 'undefined',
      'process.env.EXPO_PUBLIC_BLUESKY_PROXY_DID': 'undefined',
      'process.env.EXPO_PUBLIC_CHAT_PROXY_DID': 'undefined',
      'process.env.EXPO_PUBLIC_METRICS_API_HOST': 'undefined',
      'process.env.EXPO_PUBLIC_GROWTHBOOK_API_HOST': 'undefined',
      'process.env.EXPO_PUBLIC_GROWTHBOOK_CLIENT_KEY': 'undefined',
      'process.env.EXPO_PUBLIC_BITDRIFT_API_KEY': 'undefined',
      'process.env.EXPO_PUBLIC_GCP_PROJECT_ID': 'undefined',
      'process.env.EXPO_PUBLIC_PUBLIC_BSKY_SERVICE': 'undefined',
      'process.env.EXPO_PUBLIC_APPVIEW_DID_PROXY': 'undefined',
      'process.env.APP_MANIFEST': 'undefined',
      'process.env.__SENTRY_METRO_DEV_SERVER__': 'undefined',
      // Inject all EXPO_PUBLIC_* env vars
      ...expoPublicEnv,
    }),
    // Generate asset-manifest.json matching the format the Go server expects.
    // The post-web-build script reads `entrypoints` from this manifest.
    new RspackManifestPlugin({
      fileName: 'asset-manifest.json',
      generate: (seed, files, entrypoints) => {
        const entrypointFiles = entrypoints.main || []
        return {
          files: files.reduce((manifest, file) => {
            manifest[file.name] = file.path
            return manifest
          }, seed),
          entrypoints: entrypointFiles.filter(f => !f.endsWith('.map')),
        }
      },
    }),
    // Sentry source maps
    isProduction &&
      process.env.SENTRY_AUTH_TOKEN &&
      sentryWebpackPlugin({
        org: 'blueskyweb',
        project: 'app',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.SENTRY_RELEASE || version,
          dist: process.env.SENTRY_DIST,
        },
      }),
  ].filter(Boolean),

  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: -10,
        },
      },
    },
    runtimeChunk: 'single',
    minimize: isProduction,
  },

  devServer: {
    static: {
      directory: path.resolve(__dirname, 'web'),
    },
    port: 19006,
    hot: true,
    historyApiFallback: true,
    compress: true,
  },

  // Don't bundle node built-ins (shouldn't be needed on web)
  externalsPresets: {node: false},

  stats: GENERATE_STATS ? 'verbose' : 'normal',

  experiments: {
    css: true,
  },
}
