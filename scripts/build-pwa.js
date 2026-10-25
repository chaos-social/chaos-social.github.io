const fs = require('node:fs/promises')
const path = require('node:path')
const {generateSW} = require('workbox-build')

const {buildPwaIcons} = require('./build-pwa-icons')

/** Builds install assets and a conservative offline app shell after the web export. */
async function buildPwa() {
  const root = path.resolve(__dirname, '..')
  const output = path.join(root, 'dist')
  const pwa = path.join(output, 'pwa')
  await buildPwaIcons(pwa)
  await fs.copyFile(
    path.join(root, 'public/pwa/manifest.webmanifest'),
    path.join(pwa, 'manifest.webmanifest'),
  )
  await fs.copyFile(
    path.join(output, 'index.html'),
    path.join(pwa, 'offline.html'),
  )
  const {warnings, count, size} = await generateSW({
    globDirectory: output,
    globPatterns: [
      'pwa/**/*.{html,png,webmanifest}',
      'static/**/*.{js,css,woff2,ttf,png,jpg,webp,svg,avif}',
    ],
    // Download optional emoji fonts only after they are selected.
    globIgnores: [
      'static/assets/**/WitchskyNotoColorEmoji*.woff2',
      'static/assets/**/WitchskyTwemoji*.woff2',
    ],
    swDest: path.join(output, 'sw.js'),
    cacheId: 'witchsky',
    inlineWorkboxRuntime: true,
    sourcemap: false,
    cleanupOutdatedCaches: true,
    // Activate updates after existing tabs close, preserving their bundle version.
    skipWaiting: false,
    clientsClaim: true,
    maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
    runtimeCaching: [
      {
        // Online navigations always reach the server, including its page metadata.
        urlPattern: ({request, url}) =>
          request.mode === 'navigate' &&
          !/^\/(auth|oauth|\.well-known|iframe|about|__embed)(\/|$)/.test(
            url.pathname,
          ),
        handler: 'NetworkOnly',
        options: {precacheFallback: {fallbackURL: '/pwa/offline.html'}},
      },
    ],
  })
  if (warnings.length) throw new Error(warnings.join('\n'))
  await fs.cp(pwa, path.join(root, 'bskyweb/static/pwa'), {recursive: true})
  await fs.copyFile(
    path.join(output, 'sw.js'),
    path.join(root, 'bskyweb/static/sw.js'),
  )
  console.log(
    `PWA: precached ${count} assets (${(size / 1024 / 1024).toFixed(1)} MiB)`,
  )
}

buildPwa().catch(error => {
  console.error(error)
  process.exitCode = 1
})
