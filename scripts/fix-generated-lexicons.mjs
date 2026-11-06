#!/usr/bin/env node
/**
 * Repairs the TypeScript that `lex build` writes into `src/lexicons`.
 *
 * On Windows the generator emits import specifiers with backslash separators
 * (`"./..\\richtext\\facet.defs"`) and, with `--import-ext ''`, a stray pair of
 * single quotes (`"./blue''"`). Neither resolves, so every `#/lexicons` import
 * fails to type check and the web bundle cannot build. The output directory is
 * gitignored and regenerated on install, so the fix has to run after codegen.
 *
 * Usage:  node scripts/fix-generated-lexicons.mjs
 */

import {readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/lexicons')

function walk(dir) {
  const results = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...walk(path))
    else if (entry.name.endsWith('.ts')) results.push(path)
  }
  return results
}

let fixed = 0
for (const path of walk(OUT)) {
  const before = readFileSync(path, 'utf8')
  const after = before.replace(
    /(from\s+")([^"]*)(")/g,
    (_, open, spec, close) =>
      open +
      spec
        .replaceAll('\\', '/')
        .replaceAll("''", '')
        .replace(/\/{2,}/g, '/') +
      close,
  )
  if (after !== before) {
    writeFileSync(path, after)
    fixed++
  }
}

if (fixed > 0) {
  console.log(`Repaired import specifiers in ${fixed} generated lexicon files`)
}
