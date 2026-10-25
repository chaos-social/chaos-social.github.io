const fs = require('node:fs')
const path = require('node:path')

const output = process.argv[2] || path.join(__dirname, '..', 'dist')
const maps = fs.globSync('**/*.map', {cwd: output})

/*
 * Sentry receives the full maps during post-web-build. Omit embedded source
 * text from the public copies to fit Pages' 25 MiB per-file limit, preserving
 * file names and line/column mappings for debugging.
 */
for (const map of maps) {
  const file = path.join(output, map)
  const contents = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(
    file,
    JSON.stringify(contents, (key, value) =>
      key === 'sourcesContent' ? undefined : value,
    ),
  )
}

console.log(`Prepared ${maps.length} source maps for Cloudflare Pages`)
