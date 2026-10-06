const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
const {generateSW} = require('workbox-build')

/** Builds install assets and a conservative offline app shell after Rspack. */
async function buildPwa() {
  const root = path.resolve(__dirname, '..')
  const output = path.join(root, 'web-build')
  const pwa = path.join(output, 'pwa')
  await fs.mkdir(pwa, {recursive: true})
  await fs.copyFile(
    path.join(root, 'web/pwa/manifest.webmanifest'),
    path.join(pwa, 'manifest.webmanifest'),
  )
  for (const size of [180, 192, 512]) {
    await sharp(path.join(root, 'assets/logo.png'))
      .resize(size, size)
      .flatten({background: '#ffffff'})
      .png()
      .toFile(path.join(pwa, `icon-${size}.png`))
  }
  await fs.copyFile(
    path.join(output, 'index.html'),
    path.join(pwa, 'offline.html'),
  )
  const {warnings, count, size} = await generateSW({
    globDirectory: output,
    globPatterns: [
      'pwa/**/*.{html,png,webmanifest}',
      'static/**/*.{js,css,woff2,ttf,png,jpg,webp,svg}',
    ],
    // Download optional emoji fonts only after they are selected.
    globIgnores: [
      'static/media/WitchskyNotoColorEmoji.*.woff2',
      'static/media/WitchskyTwemoji.*.woff2',
    ],
    swDest: path.join(output, 'sw.js'),
    cacheId: 'witchsky',
    inlineWorkboxRuntime: true,
    sourcemap: false,
    cleanupOutdatedCaches: true,
    // Activate updates after existing tabs close, preserving their bundle version.
    skipWaiting: false,
    clientsClaim: true,
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
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
  await fs.cp(
    path.join(output, 'static/fonts'),
    path.join(root, 'bskyweb/static/fonts'),
    {recursive: true},
  )
  await fs.copyFile(
    path.join(output, 'static/style.css'),
    path.join(root, 'bskyweb/static/style.css'),
  )
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
