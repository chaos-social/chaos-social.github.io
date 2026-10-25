const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

/** Generates web install icons from the same artwork as the native app. */
async function buildPwaIcons(output) {
  const root = path.resolve(__dirname, '..')
  await fs.mkdir(output, {recursive: true})

  await sharp(path.join(root, 'assets/app-icons/ios_icon_legacy_light.png'))
    .resize(180, 180)
    .removeAlpha()
    .png()
    .toFile(path.join(output, 'icon-180.png'))

  const logo = sharp(path.join(root, 'assets/logo.png'))
  const {width, height} = await logo.metadata()
  const offset = Math.round(height * 0.04)
  // Balance the tip and wide brim against the edge of a circular badge.
  const centeredHat = await logo
    .extract({left: 0, top: offset, width, height: height - offset})
    .extend({bottom: offset, background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toBuffer()

  // Chrome reuses general icons on the splash screen and in Recents.
  for (const size of [192, 512]) {
    await sharp(centeredHat)
      .resize(size, size)
      .png()
      .toFile(path.join(output, `icon-${size}.png`))
  }

  const size = 512
  await sharp(path.join(root, 'assets/icon-android-monochrome.png'))
    .resize(size, size)
    .png()
    .toFile(path.join(output, 'icon-monochrome-512.png'))
}

module.exports = {buildPwaIcons}

if (require.main === module) {
  buildPwaIcons(path.resolve(__dirname, '../public/pwa')).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
