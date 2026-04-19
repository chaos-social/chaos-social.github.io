import path from 'node:path'
import rspack from '@rspack/core'
import {RspackManifestPlugin} from 'rspack-manifest-plugin'
import {sentryWebpackPlugin} from '@sentry/webpack-plugin'
import {version} from './package.json'
import { existsSync, readdirSync } from 'node:fs'

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
// and need to be run through SWC.
const TRANSPILE_MODULES = {
  prefixes: [
    'react-native',
    'react-native-web',
    'expo',
    'unimodules',
    'react-navigation',
  ],
  scopes: [
    '@react-native',
    '@react-native-community',
    '@expo',
    '@unimodules',
    '@bsky.app',
    '@discord',
    '@react-navigation',
  ],
  packages: [
    'native-base',
    'normalize-url',
    '@sentry/react-native',
    'sentry-expo',
    'bcp-47-match',
    'nanoid',
  ],
}

function getTranspileModuleDirs({
  prefixes,
  scopes,
  packages,
}: typeof TRANSPILE_MODULES) {
  const nodeModulesDir = path.resolve(__dirname, 'node_modules')
  const dirs = new Set<string>()

  const readDirNames = (dir: string) => {
    if (!existsSync(dir)) return []
    return readdirSync(dir, {withFileTypes: true})
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  }

  for (const entry of readDirNames(nodeModulesDir)) {
    if (
      prefixes.some(
        prefix => entry === prefix || entry.startsWith(`${prefix}-`),
      )
    ) {
      dirs.add(path.join(nodeModulesDir, entry))
    }
  }

  for (const scope of scopes) {
    const scopeDir = path.join(nodeModulesDir, scope)
    for (const entry of readDirNames(scopeDir)) {
      dirs.add(path.join(scopeDir, entry))
    }
  }

  for (const pkg of packages) {
    const pkgDir = path.join(nodeModulesDir, ...pkg.split('/'))
    if (existsSync(pkgDir)) {
      dirs.add(pkgDir)
    }
  }

  return [...dirs]
}

const transpileModuleDirs = getTranspileModuleDirs(TRANSPILE_MODULES)

/** @type {import('@rspack/core').Configuration} */
module.exports = {
  mode: isProduction ? 'production' : 'development',
  // Avoid eval-based sourcemaps in development. Firefox resolves relative
  // sourcemap URLs from injected devtools scripts like `installHook.js.map`
  // against an `<anonymous code>` URL when the bundle is eval-backed, which
  // produces noisy 404s in the console.
  devtool: isProduction ? 'source-map' : 'cheap-module-source-map',

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
      // Source files: use babel-loader for lingui macros, react-compiler, etc.
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            configFile: false, // Don't look for a babel.config.json to avoid conflicts with the one in the root of the monorepo.
            babelrc: false,
            cacheDirectory: true,
            cacheCompression: false, // let rspack handle it
            sourceType: 'unambiguous',
            // based on babel.config.js but optimized for web and rspack
            presets: [
              [
                'babel-preset-expo',
                {
                  lazyImports: true,
                  native: {
                    // Disable ESM -> CJS compilation because rspack handles it.
                    disableImportExportTransform: true,
                  },
                },
              ],
            ],
            plugins: [
              '@lingui/babel-plugin-lingui-macro',
              ['babel-plugin-react-compiler', {target: '19'}],
              // omitted: react-native-dotenv (we use DefinePlugin instead)
              // omitted: module-resolver (we use rspack's built-in aliasing instead)
              'react-native-reanimated/plugin', // NOTE: this plugin MUST be last
            ],
            env: {
              production: {
                plugins: [], // omitted: transform-remove-console
              },
            },
          },
        },
      },
      // node_modules that ship untranspiled JSX/Flow: use rspack's builtin
      // SWC loader which is much faster than babel for simple transforms.
      {
        test: /\.jsx?$/,
        include: transpileModuleDirs,
        use: {
          loader: 'swc-loader', // rspack swc-loader doesn't support flow yet
          options: {
            jsc: {
              parser: {
                syntax: 'flow',
                jsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
      },
      {
        test: /\.tsx?$/,
        include: transpileModuleDirs,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                jsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
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
      'process.env.EXPO_OS': JSON.stringify('web'),
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
        framework: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-native-web|@react-navigation|expo|@expo)[\\/]/,
          name: 'framework',
          chunks: 'initial',
          priority: 20,
          reuseExistingChunk: true,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'initial',
          priority: -10,
          reuseExistingChunk: true,
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
  node: {
    __filename: false,
  },

  stats: GENERATE_STATS ? 'verbose' : 'normal',

  experiments: {
    css: true,
  },
}
