const path = require('path')
const fs = require('fs')

const projectRoot = path.join(__dirname, '..')
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
