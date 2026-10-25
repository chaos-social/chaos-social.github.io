const path = require('path')
const fs = require('fs')

const projectRoot = path.join(__dirname, '..')
require('dotenv').config({path: path.join(projectRoot, '.env')})
const templateFile = path.join(
  projectRoot,
  'bskyweb',
  'templates',
  'scripts.html',
)

const manifest = require(
  path.join(projectRoot, 'web-build/asset-manifest.json'),
)
const entrypoints = manifest.entrypoints || []

console.log(`Found ${entrypoints.length} entrypoints`)
console.log(`Writing ${templateFile}`)

const outputFile = entrypoints
  .map(name => {
    const file = path.basename(name)
    const ext = path.extname(file)

    if (ext === '.js') {
      return `<script defer="defer" src="{{ staticCDNHost }}/static/js/${file}"></script>`
    }
    if (ext === '.css') {
      return `<link rel="stylesheet" href="{{ staticCDNHost }}/static/css/${file}">`
    }

    return ''
  })
  .join('\n')
fs.writeFileSync(templateFile, outputFile)

function copyPath(source, target) {
  const sourcePath = path.join(projectRoot, source)
  if (!fs.existsSync(sourcePath)) {
    console.log(`Skipping ${source} (does not exist)`)
    return
  }

  const targetPath = path.join(projectRoot, target)
  fs.mkdirSync(path.dirname(targetPath), {recursive: true})
  fs.cpSync(sourcePath, targetPath, {recursive: true})
  console.log(`Copied ${sourcePath} to ${targetPath}`)
}

// Ensure static assets resolve from non-root pages.
const indexFile = path.join(projectRoot, 'web-build', 'index.html')
const indexHtml = fs.readFileSync(indexFile, 'utf8')
fs.writeFileSync(
  indexFile,
  indexHtml.replace(/(src|href)="static\//g, '$1="/static/'),
)

// Copy the static files that are not emitted by the web bundler.
copyPath('bskyweb/static/iframe', 'web-build/iframe')
copyPath('bskyweb/static/.well-known', 'web-build/.well-known')
for (const directory of ['web-build', 'bskyweb/static']) {
  require('./generate-oauth-metadata').generateOAuthMetadata(
    path.join(projectRoot, directory),
  )
}
copyPath('witchsky-static-about', 'web-build/about')
copyPath('src/style.css', 'web-build/style.css')
copyPath('src/style.css', 'web-build/static/style.css')
copyPath('assets/favicon.png', 'web-build/favicon.ico')

function copyFiles(sourceDir, targetDir) {
  const srcPath = path.join(projectRoot, sourceDir)
  if (!fs.existsSync(srcPath)) {
    console.log(`Skipping ${sourceDir} (does not exist)`)
    return
  }
  const tgtPath = path.join(projectRoot, targetDir)
  if (!fs.existsSync(tgtPath)) {
    fs.mkdirSync(tgtPath, {recursive: true})
  }
  const files = fs.readdirSync(srcPath)
  files.forEach(file => {
    const sourcePath = path.join(srcPath, file)
    const targetPath = path.join(tgtPath, file)
    fs.copyFileSync(sourcePath, targetPath)
    console.log(`Copied ${sourcePath} to ${targetPath}`)
  })
}

copyFiles('web-build/static/js', 'bskyweb/static/js')
copyFiles('web-build/static/css', 'bskyweb/static/css')
copyFiles('web-build/static/media', 'bskyweb/static/media')
